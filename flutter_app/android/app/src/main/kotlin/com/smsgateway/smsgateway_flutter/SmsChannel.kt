package com.smsgateway.app

import android.app.Activity
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.ContentValues
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.net.Uri
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.provider.Settings
import android.provider.Telephony
import android.telephony.SmsManager
import android.telephony.SubscriptionManager
import android.util.Log
import io.flutter.plugin.common.BinaryMessenger
import io.flutter.plugin.common.MethodCall
import io.flutter.plugin.common.MethodChannel
import java.util.concurrent.atomic.AtomicInteger

/**
 * Handler du MethodChannel natif d'envoi de SMS.
 *
 * IMPORTANT: ce canal doit etre enregistre sur CHAQUE FlutterEngine qui en a
 * besoin. Il y en a deux dans cette app:
 *   1. Le moteur de [MainActivity] (envoi manuel "Synchroniser et envoyer").
 *   2. Le moteur cree par flutter_foreground_task pour le service d'arriere-plan
 *      (envoi automatique des campagnes). Ce moteur est totalement separe et ne
 *      connait AUCUN canal declare dans MainActivity.
 *
 * Avant cette factorisation, le canal n'etait enregistre que dans MainActivity,
 * donc les envois faits depuis le service d'arriere-plan echouaient avec
 * MissingPluginException et aucun SMS n'etait reellement envoye.
 */
object SmsChannel {
    const val CHANNEL = "com.smsgateway.app/sms"
    private const val TAG = "SMS_GATEWAY"
    private const val SEND_TIMEOUT_MS = 75_000L
    private val sendSequence = AtomicInteger(10_000)

    fun register(context: Context, messenger: BinaryMessenger) {
        val appContext = context.applicationContext
        MethodChannel(messenger, CHANNEL).setMethodCallHandler { call, result ->
            when (call.method) {
                "sendSms" -> handleSendSms(appContext, call, result)
                "getSimCards" -> handleGetSimCards(appContext, result)
                "getAndroidId" -> handleGetAndroidId(appContext, result)
                else -> result.notImplemented()
            }
        }
    }

    @Suppress("DEPRECATION")
    private fun handleGetSimCards(context: Context, result: MethodChannel.Result) {
        try {
            val subMgr =
                context.getSystemService(Context.TELEPHONY_SUBSCRIPTION_SERVICE) as SubscriptionManager
            val infos = subMgr.activeSubscriptionInfoList ?: emptyList()

            val sims = infos.map { info ->
                mapOf(
                    "subscriptionId" to info.subscriptionId,
                    "simSlotIndex" to info.simSlotIndex,
                    "displayName" to (info.displayName?.toString() ?: ""),
                    "carrierName" to (info.carrierName?.toString() ?: ""),
                )
            }
            result.success(sims)
        } catch (e: SecurityException) {
            Log.w(TAG, "getSimCards permission denied", e)
            result.success(emptyList<Map<String, Any>>())
        } catch (e: Exception) {
            Log.e(TAG, "getSimCards failed", e)
            result.success(emptyList<Map<String, Any>>())
        }
    }

    private fun handleGetAndroidId(context: Context, result: MethodChannel.Result) {
        try {
            val androidId =
                Settings.Secure.getString(context.contentResolver, Settings.Secure.ANDROID_ID)
            result.success(androidId)
        } catch (e: Exception) {
            Log.e(TAG, "getAndroidId failed", e)
            result.success(null)
        }
    }

    // L'envoi reste asynchrone, mais le Result Flutter n'est termine qu'apres le
    // retour SENT de la pile telephony pour chaque partie. Cela distingue enfin
    // "Android a accepte la demande" de "le reseau a accepte le SMS". Un timeout
    // borne empeche tout message de rester indefiniment en "sending".
    private fun handleSendSms(
        context: Context,
        call: MethodCall,
        result: MethodChannel.Result,
    ) {
        val to = call.argument<String>("to")
        val body = call.argument<String>("body")
        val subscriptionId = call.argument<Int>("subscriptionId")
        val simSlotIndex = call.argument<Int>("simSlotIndex")
        val strictSimRouting = (subscriptionId != null && subscriptionId > 0) ||
            (simSlotIndex != null && simSlotIndex >= 0)

        if (to.isNullOrBlank() || body.isNullOrBlank()) {
            result.error("SMS_INVALID_INPUT", "Destinataire ou message vide", null)
            return
        }

        try {
            val resolved = resolveSmsTarget(context, subscriptionId, simSlotIndex, strictSimRouting)
            if (resolved == null) {
                val detail = when {
                    simSlotIndex != null && simSlotIndex >= 0 ->
                        "SIM ${simSlotIndex + 1} introuvable ou inactive"
                    subscriptionId != null && subscriptionId > 0 ->
                        "Subscription $subscriptionId introuvable"
                    else -> "Aucun SmsManager disponible (SIM absente / desactivee)"
                }
                result.error("SMS_NO_MANAGER", detail, null)
                return
            }

            sendWithNetworkResult(
                context = context,
                resolved = resolved,
                to = to,
                body = body,
                simSlotIndex = simSlotIndex,
                result = result,
            )
        } catch (e: SecurityException) {
            Log.e(TAG, "SMS permission denied", e)
            result.error(
                "SMS_PERMISSION",
                "Permission SEND_SMS refusee. Active-la dans les parametres Android.",
                null,
            )
        } catch (e: IllegalArgumentException) {
            Log.e(TAG, "SMS invalid argument", e)
            result.error(
                "SMS_INVALID",
                e.localizedMessage ?: "Numero ou message invalide",
                null,
            )
        } catch (e: Exception) {
            Log.e(TAG, "Send SMS failed", e)
            result.error("SMS_ERROR", e.localizedMessage ?: "Erreur inconnue", null)
        }
    }

    private data class SmsFailure(val code: String, val message: String)

    private fun sendWithNetworkResult(
        context: Context,
        resolved: ResolvedSmsTarget,
        to: String,
        body: String,
        simSlotIndex: Int?,
        result: MethodChannel.Result,
    ) {
        val parts = resolved.manager.divideMessage(body).ifEmpty { arrayListOf(body) }
        val action = "${context.packageName}.SMS_SENT.${System.currentTimeMillis()}.${sendSequence.incrementAndGet()}"
        val handler = Handler(Looper.getMainLooper())
        val completedParts = mutableSetOf<Int>()
        var completed = false
        lateinit var receiver: BroadcastReceiver
        lateinit var timeout: Runnable

        fun cleanup() {
            handler.removeCallbacks(timeout)
            try {
                context.unregisterReceiver(receiver)
            } catch (_: Exception) {
                // Receiver deja libere ou contexte en cours d'arret.
            }
        }

        fun finishSuccess() {
            if (completed) return
            completed = true
            cleanup()
            Log.i(
                TAG,
                "SMS accepted by network (parts=${parts.size}, sub=${resolved.subscriptionId}, slot=$simSlotIndex)",
            )
            // La copie systeme n'est creee qu'apres confirmation reseau. Un SMS
            // rejete ne sera donc plus affiche a tort comme envoye.
            saveToSentBox(context, to, body, resolved.subscriptionId)
            result.success(true)
        }

        fun finishError(
            code: String,
            message: String,
            androidResultCode: Int? = null,
            networkErrorCode: Int? = null,
            partIndex: Int? = null,
        ) {
            if (completed) return
            completed = true
            cleanup()
            Log.e(
                TAG,
                "SMS rejected (code=$code, android=$androidResultCode, network=$networkErrorCode, " +
                    "part=$partIndex, sub=${resolved.subscriptionId}, slot=$simSlotIndex)",
            )
            result.error(
                code,
                message,
                mapOf(
                    "androidResultCode" to androidResultCode,
                    "networkErrorCode" to networkErrorCode,
                    "partIndex" to partIndex,
                    "partsCount" to parts.size,
                    "subscriptionId" to resolved.subscriptionId,
                    "simSlotIndex" to simSlotIndex,
                ),
            )
        }

        receiver = object : BroadcastReceiver() {
            override fun onReceive(receiverContext: Context?, intent: Intent?) {
                if (completed || intent?.action != action) return
                val partIndex = intent.getIntExtra("partIndex", -1)
                if (!completedParts.add(partIndex)) return

                val androidCode = resultCode
                val networkCode = intent.getIntExtra("errorCode", 0)
                if (androidCode == Activity.RESULT_OK) {
                    if (completedParts.size >= parts.size) finishSuccess()
                    return
                }

                val failure = mapSendFailure(androidCode, networkCode)
                finishError(
                    code = failure.code,
                    message = failure.message,
                    androidResultCode = androidCode,
                    networkErrorCode = networkCode,
                    partIndex = partIndex,
                )
            }
        }

        timeout = Runnable {
            finishError(
                code = "SMS_TIMEOUT",
                message = "Aucune confirmation du réseau après ${SEND_TIMEOUT_MS / 1000} secondes",
            )
        }

        try {
            val filter = IntentFilter(action)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                context.registerReceiver(receiver, filter, Context.RECEIVER_NOT_EXPORTED)
            } else {
                @Suppress("DEPRECATION")
                context.registerReceiver(receiver, filter)
            }

            val sentIntents = ArrayList<PendingIntent>(parts.size)
            for (partIndex in parts.indices) {
                val intent = Intent(action)
                    .setPackage(context.packageName)
                    .putExtra("partIndex", partIndex)
                val requestCode = sendSequence.incrementAndGet()
                sentIntents.add(
                    PendingIntent.getBroadcast(
                        context,
                        requestCode,
                        intent,
                        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
                    ),
                )
            }

            handler.postDelayed(timeout, SEND_TIMEOUT_MS)
            resolved.manager.sendMultipartTextMessage(to, null, parts, sentIntents, null)
        } catch (e: Exception) {
            if (completed) return
            completed = true
            cleanup()
            throw e
        }
    }

    private fun mapSendFailure(androidResultCode: Int, networkErrorCode: Int): SmsFailure {
        return when (androidResultCode) {
            SmsManager.RESULT_RIL_NETWORK_ERR -> SmsFailure(
                "SMS_NETWORK_REJECTED",
                "Le réseau ou l'opérateur a refusé le SMS (code Android $androidResultCode)",
            )
            SmsManager.RESULT_ERROR_NO_SERVICE -> SmsFailure(
                "SMS_NO_SERVICE",
                "Aucun service mobile disponible pour envoyer le SMS",
            )
            SmsManager.RESULT_ERROR_RADIO_OFF -> SmsFailure(
                "SMS_RADIO_OFF",
                "La radio mobile est désactivée (mode avion ou SIM inactive)",
            )
            SmsManager.RESULT_ERROR_LIMIT_EXCEEDED -> SmsFailure(
                "SMS_ANDROID_LIMIT",
                "Android a bloqué l'envoi car sa limite SMS locale est atteinte",
            )
            SmsManager.RESULT_ERROR_FDN_CHECK_FAILURE -> SmsFailure(
                "SMS_FDN_BLOCKED",
                "Le numéro est bloqué par la liste de numéros autorisés de la SIM",
            )
            SmsManager.RESULT_RIL_MODEM_ERR -> SmsFailure(
                "SMS_MODEM_ERROR",
                "Le modem a refusé la demande d'envoi SMS",
            )
            Activity.RESULT_CANCELED -> SmsFailure(
                "SMS_CANCELLED",
                "L'envoi du SMS a été annulé par Android ou le réseau",
            )
            else -> SmsFailure(
                "SMS_SEND_FAILED",
                "Échec d'envoi SMS (code Android $androidResultCode, réseau $networkErrorCode)",
            )
        }
    }

    // Enregistre le message dans le fournisseur SMS (content://sms/sent) afin
    // qu'il soit visible dans l'app Messages. Non bloquant.
    private fun saveToSentBox(
        context: Context,
        address: String,
        body: String,
        subscriptionId: Int?,
    ) {
        try {
            val values = ContentValues().apply {
                put(Telephony.Sms.ADDRESS, address)
                put(Telephony.Sms.BODY, body)
                put(Telephony.Sms.DATE, System.currentTimeMillis())
                put(Telephony.Sms.READ, 1)
                put(Telephony.Sms.SEEN, 1)
                put(Telephony.Sms.TYPE, Telephony.Sms.MESSAGE_TYPE_SENT)
                if (subscriptionId != null && subscriptionId >= 0) {
                    put(Telephony.Sms.SUBSCRIPTION_ID, subscriptionId)
                }
            }
            val uri: Uri = Telephony.Sms.Sent.CONTENT_URI
            context.contentResolver.insert(uri, values)
        } catch (e: Exception) {
            Log.w(TAG, "saveToSentBox failed (non-blocking): $e")
        }
    }

    /** SmsManager pret a l'emploi + subscription reellement ciblee (null si inconnue). */
    private class ResolvedSmsTarget(val manager: SmsManager, val subscriptionId: Int?)

    @Suppress("DEPRECATION")
    private fun resolveSmsTarget(
        context: Context,
        subscriptionId: Int?,
        simSlotIndex: Int?,
        strictRouting: Boolean,
    ): ResolvedSmsTarget? {
        if (subscriptionId != null && subscriptionId > 0) {
            managerForSubscriptionId(context, subscriptionId)?.let {
                return ResolvedSmsTarget(it, subscriptionId)
            }
            if (strictRouting) {
                Log.e(TAG, "resolveSmsTarget: subscription $subscriptionId unavailable")
                return null
            }
        }

        if (simSlotIndex != null && simSlotIndex >= 0) {
            try {
                val subMgr =
                    context.getSystemService(Context.TELEPHONY_SUBSCRIPTION_SERVICE) as SubscriptionManager
                val info = subMgr.activeSubscriptionInfoList
                    ?.firstOrNull { it.simSlotIndex == simSlotIndex }
                if (info != null) {
                    managerForSubscriptionId(context, info.subscriptionId)?.let {
                        return ResolvedSmsTarget(it, info.subscriptionId)
                    }
                }
                Log.e(TAG, "resolveSmsTarget: no active subscription for slot $simSlotIndex")
            } catch (e: SecurityException) {
                Log.e(TAG, "resolveSmsTarget: permission denied reading SIM slot $simSlotIndex", e)
            } catch (e: Exception) {
                Log.e(TAG, "resolveSmsTarget: slot lookup failed for $simSlotIndex", e)
            }
            if (strictRouting) return null
        }

        if (strictRouting) return null
        val defaultMgr = defaultSmsManager(context) ?: return null
        val defaultSub = try {
            SubscriptionManager.getDefaultSmsSubscriptionId()
        } catch (_: Exception) {
            -1
        }
        return ResolvedSmsTarget(defaultMgr, if (defaultSub >= 0) defaultSub else null)
    }

    @Suppress("DEPRECATION")
    private fun managerForSubscriptionId(context: Context, subscriptionId: Int): SmsManager? {
        return try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                val sysMgr = context.getSystemService(SmsManager::class.java)
                sysMgr?.createForSubscriptionId(subscriptionId)
            } else {
                SmsManager.getSmsManagerForSubscriptionId(subscriptionId)
            }
        } catch (e: Exception) {
            Log.w(TAG, "managerForSubscriptionId failed (sub=$subscriptionId): $e")
            null
        }
    }

    @Suppress("DEPRECATION")
    private fun defaultSmsManager(context: Context): SmsManager? {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            context.getSystemService(SmsManager::class.java)
        } else {
            SmsManager.getDefault()
        }
    }
}
