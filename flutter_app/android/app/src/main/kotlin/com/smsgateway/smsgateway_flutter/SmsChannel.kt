package com.smsgateway.app

import android.content.ContentValues
import android.content.Context
import android.net.Uri
import android.os.Build
import android.provider.Settings
import android.provider.Telephony
import android.telephony.SmsManager
import android.telephony.SubscriptionManager
import android.util.Log
import io.flutter.plugin.common.BinaryMessenger
import io.flutter.plugin.common.MethodCall
import io.flutter.plugin.common.MethodChannel

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

    // Envoi d'un SMS en fire-and-forget: on confie le message a la pile telephony
    // d'Android et on fait confiance a l'OS pour la livraison. On n'attend PAS de
    // retour de livraison (PendingIntent) car cela pouvait bloquer toute la
    // campagne (SMS_TIMEOUT, messages coinces en "sending").
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

            val parts = resolved.manager.divideMessage(body)
            resolved.manager.sendMultipartTextMessage(to, null, parts, null, null)

            // Ecrit une copie dans la boite "Envoyes" du systeme pour que le SMS
            // apparaisse dans l'application Messages du telephone (comme les apps
            // concurrentes). Best-effort: si l'OS refuse l'ecriture (app non
            // definie comme app SMS par defaut sur Android stock), on ignore
            // silencieusement sans faire echouer l'envoi.
            // IMPORTANT: on enregistre la subscription REELLEMENT utilisee (et pas
            // l'argument brut, souvent null en routage par slot) pour que l'app
            // Messages affiche la bonne SIM (SIM 2 et non la SIM par defaut).
            saveToSentBox(context, to, body, resolved.subscriptionId ?: subscriptionId)

            result.success(true)
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
