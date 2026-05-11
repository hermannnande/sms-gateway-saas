package com.smsgateway.app

import android.content.Context
import android.os.Build
import android.provider.Settings
import android.telephony.SmsManager
import android.telephony.SubscriptionManager
import android.util.Log
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel

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
                                    "carrierName" to (info.carrierName?.toString() ?: ""),
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
                            val androidId =
                                Settings.Secure.getString(contentResolver, Settings.Secure.ANDROID_ID)
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

    // Send an SMS in fire-and-forget mode: this is the behavior that was
    // working historically in this app. We hand the message to the Android
    // telephony stack and trust the OS to deliver it. Delivery feedback (if
    // ever needed) is intentionally NOT awaited here because the previous
    // implementation that did so could hang and cause the whole campaign to
    // stall (SMS_TIMEOUT, messages stuck in "sending").
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
                    "Aucun SmsManager disponible (SIM absente / désactivée)",
                    null,
                )
                return
            }

            val parts = smsManager.divideMessage(body)
            smsManager.sendMultipartTextMessage(to, null, parts, null, null)
            result.success(true)
        } catch (e: SecurityException) {
            Log.e(tag, "SMS permission denied", e)
            result.error(
                "SMS_PERMISSION",
                "Permission SEND_SMS refusée. Active-la dans les paramètres Android.",
                null,
            )
        } catch (e: IllegalArgumentException) {
            Log.e(tag, "SMS invalid argument", e)
            result.error(
                "SMS_INVALID",
                e.localizedMessage ?: "Numéro ou message invalide",
                null,
            )
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
}
