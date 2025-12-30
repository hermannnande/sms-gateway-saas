package com.smsgateway.app

import android.telephony.SmsManager
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

                    else -> result.notImplemented()
                }
            }
    }
}
