package com.smsgateway.app.sms

import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.telephony.SmsManager as AndroidSmsManager
import android.telephony.SubscriptionManager
import android.util.Log

class SmsManagerHelper(private val context: Context) {
    
    companion object {
        const val TAG = "SmsManagerHelper"
        const val ACTION_SMS_SENT = "com.smsgateway.app.SMS_SENT"
        const val ACTION_SMS_DELIVERED = "com.smsgateway.app.SMS_DELIVERED"
        const val EXTRA_MESSAGE_ID = "message_id"
    }
    
    /**
     * Get list of available SIM cards
     */
    fun getAvailableSimCards(): List<SimInfo> {
        val subscriptionManager = context.getSystemService(Context.TELEPHONY_SUBSCRIPTION_SERVICE) as? SubscriptionManager
        val simList = mutableListOf<SimInfo>()
        
        try {
            val subscriptions = subscriptionManager?.activeSubscriptionInfoList
            
            subscriptions?.forEach { subInfo ->
                simList.add(
                    SimInfo(
                        subscriptionId = subInfo.subscriptionId,
                        displayName = subInfo.displayName?.toString() ?: "SIM ${subInfo.simSlotIndex + 1}",
                        simSlotIndex = subInfo.simSlotIndex,
                        carrierName = subInfo.carrierName?.toString() ?: "Unknown"
                    )
                )
            }
        } catch (e: SecurityException) {
            Log.e(TAG, "Permission denied to read SIM info", e)
        }
        
        return simList
    }
    
    /**
     * Send SMS via specific SIM (subscriptionId)
     */
    fun sendSms(
        subscriptionId: Int,
        destinationNumber: String,
        message: String,
        messageId: String
    ): Result<Unit> {
        return try {
            val smsManager = if (subscriptionId >= 0) {
                AndroidSmsManager.getSmsManagerForSubscriptionId(subscriptionId)
            } else {
                AndroidSmsManager.getDefault()
            }
            
            // Create pending intents for sent/delivered
            val sentIntent = PendingIntent.getBroadcast(
                context,
                messageId.hashCode(),
                Intent(ACTION_SMS_SENT).apply {
                    putExtra(EXTRA_MESSAGE_ID, messageId)
                },
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
            
            val deliveredIntent = PendingIntent.getBroadcast(
                context,
                messageId.hashCode() + 1,
                Intent(ACTION_SMS_DELIVERED).apply {
                    putExtra(EXTRA_MESSAGE_ID, messageId)
                },
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
            
            // Send SMS
            if (message.length > 160) {
                // Split long messages
                val parts = smsManager.divideMessage(message)
                val sentIntents = ArrayList<PendingIntent>()
                val deliveredIntents = ArrayList<PendingIntent>()
                
                parts.indices.forEach { _ ->
                    sentIntents.add(sentIntent)
                    deliveredIntents.add(deliveredIntent)
                }
                
                smsManager.sendMultipartTextMessage(
                    destinationNumber,
                    null,
                    parts,
                    sentIntents,
                    deliveredIntents
                )
            } else {
                smsManager.sendTextMessage(
                    destinationNumber,
                    null,
                    message,
                    sentIntent,
                    deliveredIntent
                )
            }
            
            Log.d(TAG, "SMS sent to $destinationNumber via SIM $subscriptionId")
            Result.success(Unit)
            
        } catch (e: Exception) {
            Log.e(TAG, "Error sending SMS", e)
            Result.failure(e)
        }
    }
}

data class SimInfo(
    val subscriptionId: Int,
    val displayName: String,
    val simSlotIndex: Int,
    val carrierName: String
)








