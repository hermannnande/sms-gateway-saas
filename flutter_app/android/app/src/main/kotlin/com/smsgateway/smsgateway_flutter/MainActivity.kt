package com.smsgateway.app

import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.provider.Settings
import android.telephony.SmsManager
import android.telephony.SubscriptionManager
import android.util.Log
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel
import java.util.UUID
import java.util.concurrent.atomic.AtomicBoolean

class MainActivity : FlutterActivity() {
    private val channelName = "com.smsgateway.app/sms"
    private val tag = "SMS_GATEWAY"

    @Suppress("DEPRECATION")
    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)

        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, channelName)
            .setMethodCallHandler { call, result ->
                when (call.method) {
                    "sendSms" -> handleSendSms(call, result)

                    "getSimCards" -> {
                        try {
                            val subMgr =
                                getSystemService(Context.TELEPHONY_SUBSCRIPTION_SERVICE) as SubscriptionManager
                            val infos = subMgr.activeSubscriptionInfoList ?: emptyList()

                            val sims = infos.map { info ->
                                mapOf(
                                    "subscriptionId" to info.subscriptionId,
                                    "simSlotIndex" to info.simSlotIndex,
                                    "displayName" to (info.displayName?.toString() ?: ""),
                                    "carrierName" to (info.carrierName?.toString() ?: "")
                                )
                            }
                            result.success(sims)
                        } catch (e: SecurityException) {
                            Log.w(tag, "getSimCards permission denied", e)
                            result.success(emptyList<Map<String, Any>>())
                        } catch (e: Exception) {
                            Log.e(tag, "getSimCards failed", e)
                            result.success(emptyList<Map<String, Any>>())
                        }
                    }

                    "getAndroidId" -> {
                        try {
                            val androidId = Settings.Secure.getString(contentResolver, Settings.Secure.ANDROID_ID)
                            result.success(androidId)
                        } catch (e: Exception) {
                            Log.e(tag, "getAndroidId failed", e)
                            result.success(null)
                        }
                    }

                    else -> result.notImplemented()
                }
            }
    }

    private fun handleSendSms(
        call: io.flutter.plugin.common.MethodCall,
        result: MethodChannel.Result,
    ) {
        val to = call.argument<String>("to")
        val body = call.argument<String>("body")
        val subscriptionId = call.argument<Int>("subscriptionId")

        if (to.isNullOrBlank() || body.isNullOrBlank()) {
            result.error("SMS_INVALID_INPUT", "Destinataire ou message vide", null)
            return
        }

        try {
            val smsManager = resolveSmsManager(subscriptionId)
            if (smsManager == null) {
                result.error(
                    "SMS_NO_MANAGER",
                    "Aucun SmsManager disponible (SIM absente ou subscriptionId invalide)",
                    null,
                )
                return
            }

            val parts = smsManager.divideMessage(body)
            val txId = UUID.randomUUID().toString()
            val sentAction = "com.smsgateway.app.SMS_SENT_$txId"
            val expectedCount = parts.size

            // Build a list of identical PendingIntents (one per SMS part), so we
            // can receive a per-part delivery status from the OS.
            val sentIntents = ArrayList<PendingIntent>(expectedCount)
            val flags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
            } else {
                PendingIntent.FLAG_UPDATE_CURRENT
            }
            for (i in 0 until expectedCount) {
                val intent = Intent(sentAction).setPackage(packageName)
                intent.putExtra("partIndex", i)
                // Each part needs a distinct requestCode so the PendingIntent
                // is not collapsed into the same one by the OS.
                val pi = PendingIntent.getBroadcast(this, (sentAction + i).hashCode(), intent, flags)
                sentIntents.add(pi)
            }

            val replied = AtomicBoolean(false)
            var receivedCount = 0
            var failureReason: String? = null

            val receiver = object : BroadcastReceiver() {
                override fun onReceive(context: Context?, intent: Intent?) {
                    if (replied.get()) return
                    receivedCount += 1
                    val code = resultCode
                    if (code != android.app.Activity.RESULT_OK && failureReason == null) {
                        failureReason = describeSmsError(code)
                    }
                    if (receivedCount >= expectedCount) {
                        if (replied.compareAndSet(false, true)) {
                            try { unregisterReceiver(this) } catch (_: Throwable) {}
                            if (failureReason == null) {
                                result.success(true)
                            } else {
                                result.error("SMS_SEND_FAILED", failureReason, null)
                            }
                        }
                    }
                }
            }

            // Register the receiver. On Android 13+ we must specify the export
            // flag explicitly (private to our app since the action is namespaced).
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                registerReceiver(receiver, IntentFilter(sentAction), Context.RECEIVER_NOT_EXPORTED)
            } else {
                @Suppress("UnspecifiedRegisterReceiverFlag")
                registerReceiver(receiver, IntentFilter(sentAction))
            }

            // Watchdog: if the OS never reports back within 25s, return a
            // friendly timeout error rather than hanging Flutter forever.
            Handler(Looper.getMainLooper()).postDelayed({
                if (replied.compareAndSet(false, true)) {
                    try { unregisterReceiver(receiver) } catch (_: Throwable) {}
                    result.error(
                        "SMS_TIMEOUT",
                        "L'OS n'a pas confirmé l'envoi dans les 25 secondes (parts reçues: $receivedCount/$expectedCount)",
                        null,
                    )
                }
            }, 25_000L)

            smsManager.sendMultipartTextMessage(to, null, parts, sentIntents, null)
        } catch (e: SecurityException) {
            Log.e(tag, "SMS permission denied", e)
            result.error("SMS_PERMISSION", "Permission SEND_SMS refusée. Active-la dans les paramètres.", null)
        } catch (e: IllegalArgumentException) {
            Log.e(tag, "SMS invalid argument", e)
            result.error("SMS_INVALID", e.localizedMessage ?: "Argument invalide (numéro ou message)", null)
        } catch (e: Exception) {
            Log.e(tag, "Send SMS failed", e)
            result.error("SMS_ERROR", e.localizedMessage ?: "Erreur inconnue", null)
        }
    }

    @Suppress("DEPRECATION")
    private fun resolveSmsManager(subscriptionId: Int?): SmsManager? {
        return try {
            if (subscriptionId != null && subscriptionId >= 0) {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                    val sysMgr = getSystemService(SmsManager::class.java)
                    sysMgr?.createForSubscriptionId(subscriptionId)
                } else {
                    SmsManager.getSmsManagerForSubscriptionId(subscriptionId)
                }
            } else {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                    getSystemService(SmsManager::class.java)
                } else {
                    SmsManager.getDefault()
                }
            }
        } catch (e: Exception) {
            Log.w(tag, "resolveSmsManager fallback to default (sub=$subscriptionId): $e")
            try {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                    getSystemService(SmsManager::class.java)
                } else {
                    SmsManager.getDefault()
                }
            } catch (e2: Exception) {
                Log.e(tag, "resolveSmsManager fallback failed: $e2")
                null
            }
        }
    }

    private fun describeSmsError(code: Int): String {
        return when (code) {
            SmsManager.RESULT_ERROR_GENERIC_FAILURE -> "Echec generique (operateur a refuse / pas de credit / numero invalide)"
            SmsManager.RESULT_ERROR_NO_SERVICE -> "Aucun service mobile (verifie le reseau / pas de signal)"
            SmsManager.RESULT_ERROR_NULL_PDU -> "PDU nulle (message vide ou mal forme)"
            SmsManager.RESULT_ERROR_RADIO_OFF -> "Radio coupee (mode avion ou SIM desactivee)"
            else -> "Erreur OS (code=$code)"
        }
    }
}
