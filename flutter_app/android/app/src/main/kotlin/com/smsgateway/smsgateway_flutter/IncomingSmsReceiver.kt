package com.smsgateway.app

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import android.provider.Telephony
import android.util.Log
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import java.net.HttpURLConnection
import java.net.URL

class IncomingSmsReceiver : BroadcastReceiver() {

    companion object {
        const val TAG = "IncomingSmsReceiver"
        const val PREFS_NAME = "FlutterSharedPreferences"
    }

    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != Telephony.Sms.Intents.SMS_RECEIVED_ACTION) return

        val messages = Telephony.Sms.Intents.getMessagesFromIntent(intent) ?: return

        val grouped = mutableMapOf<String, StringBuilder>()
        for (msg in messages) {
            val sender = msg.originatingAddress ?: continue
            grouped.getOrPut(sender) { StringBuilder() }.append(msg.messageBody ?: "")
        }

        val prefs: SharedPreferences = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val deviceToken = prefs.getString("flutter.device_token", null)

        if (deviceToken.isNullOrBlank()) {
            Log.w(TAG, "No device_token in SharedPreferences, skipping report")
            return
        }

        for ((sender, bodyBuilder) in grouped) {
            val body = bodyBuilder.toString().trim()
            Log.d(TAG, "Incoming SMS from $sender: $body")

            CoroutineScope(Dispatchers.IO).launch {
                reportIncomingSms(deviceToken, sender, body)
            }
        }
    }

    private fun reportIncomingSms(deviceToken: String, fromPhone: String, body: String) {
        try {
            val apiUrl = "https://smsenvoie.com/api/mobile/report-incoming"
            val url = URL(apiUrl)
            val conn = url.openConnection() as HttpURLConnection
            conn.requestMethod = "POST"
            conn.setRequestProperty("Content-Type", "application/json")
            conn.doOutput = true
            conn.connectTimeout = 15000
            conn.readTimeout = 15000

            val json = """{"device_token":"$deviceToken","from_phone":"$fromPhone","body":"$body"}"""
            conn.outputStream.bufferedWriter().use { it.write(json) }

            val responseCode = conn.responseCode
            val response = try { conn.inputStream.bufferedReader().readText() } catch (_: Exception) { "" }
            Log.d(TAG, "Report response ($responseCode): $response")
            conn.disconnect()
        } catch (e: Exception) {
            Log.e(TAG, "Failed to report incoming SMS", e)
        }
    }
}
