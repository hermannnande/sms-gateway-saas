package com.smsgateway.app

import android.content.Context
import android.provider.Settings
import android.telephony.SmsManager
import android.telephony.SubscriptionManager
import android.util.Log
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel

class MainActivity : FlutterActivity() {
    private val channelName = "com.smsgateway.app/sms"

    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)

        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, channelName)
            .setMethodCallHandler { call, result ->
                when (call.method) {
                    "sendSms" -> {
                        val to = call.argument<String>("to")
                        val body = call.argument<String>("body")
                        val subscriptionId = call.argument<Int>("subscriptionId")

                        if (to.isNullOrBlank() || body.isNullOrBlank()) {
                            result.error("SMS_ERROR", "Destinataire ou message vide", null)
                            return@setMethodCallHandler
                        }

                        try {
                            val smsManager = if (subscriptionId != null) {
                                SmsManager.getSmsManagerForSubscriptionId(subscriptionId)
                            } else {
                                SmsManager.getDefault()
                            }

                            val parts = smsManager.divideMessage(body)
                            smsManager.sendMultipartTextMessage(to, null, parts, null, null)
                            result.success(true)
                        } catch (e: Exception) {
                            Log.e("SMS_GATEWAY", "Send SMS failed", e)
                            result.error("SMS_ERROR", e.localizedMessage ?: "Erreur inconnue", null)
                        }
                    }

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
                            Log.w("SMS_GATEWAY", "getSimCards permission denied", e)
                            result.success(emptyList<Map<String, Any>>())
                        } catch (e: Exception) {
                            Log.e("SMS_GATEWAY", "getSimCards failed", e)
                            result.success(emptyList<Map<String, Any>>())
                        }
                    }

                    "getAndroidId" -> {
                        try {
                            val androidId = Settings.Secure.getString(contentResolver, Settings.Secure.ANDROID_ID)
                            result.success(androidId)
                        } catch (e: Exception) {
                            Log.e("SMS_GATEWAY", "getAndroidId failed", e)
                            result.success(null)
                        }
                    }

                    else -> result.notImplemented()
                }
            }
    }
}
