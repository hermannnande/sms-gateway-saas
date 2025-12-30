package com.smsgateway.app.sms

import android.app.Activity
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.telephony.SmsManager
import android.util.Log
import com.smsgateway.app.data.ApiClient
import com.smsgateway.app.data.DevicePrefs
import com.smsgateway.app.data.UpdateStatusRequest
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

class SmsBroadcastReceiver : BroadcastReceiver() {
    
    companion object {
        const val TAG = "SmsBroadcastReceiver"
    }
    
    override fun onReceive(context: Context, intent: Intent) {
        val messageId = intent.getStringExtra(SmsManagerHelper.EXTRA_MESSAGE_ID) ?: return
        
        when (intent.action) {
            SmsManagerHelper.ACTION_SMS_SENT -> {
                handleSmsSent(context, messageId, resultCode)
            }
            SmsManagerHelper.ACTION_SMS_DELIVERED -> {
                handleSmsDelivered(context, messageId)
            }
        }
    }
    
    private fun handleSmsSent(context: Context, messageId: String, resultCode: Int) {
        val prefs = DevicePrefs(context)
        val deviceToken = prefs.getDeviceToken() ?: return
        val apiUrl = prefs.getApiUrl() ?: return
        
        val status: String
        val error: String?
        
        when (resultCode) {
            Activity.RESULT_OK -> {
                status = "sent"
                error = null
                Log.d(TAG, "SMS sent successfully: $messageId")
            }
            SmsManager.RESULT_ERROR_GENERIC_FAILURE -> {
                status = "failed"
                error = "Generic failure"
                Log.e(TAG, "SMS failed (generic): $messageId")
            }
            SmsManager.RESULT_ERROR_NO_SERVICE -> {
                status = "failed"
                error = "No service"
                Log.e(TAG, "SMS failed (no service): $messageId")
            }
            SmsManager.RESULT_ERROR_NULL_PDU -> {
                status = "failed"
                error = "Null PDU"
                Log.e(TAG, "SMS failed (null PDU): $messageId")
            }
            SmsManager.RESULT_ERROR_RADIO_OFF -> {
                status = "failed"
                error = "Radio off"
                Log.e(TAG, "SMS failed (radio off): $messageId")
            }
            else -> {
                status = "failed"
                error = "Unknown error: $resultCode"
                Log.e(TAG, "SMS failed (unknown): $messageId")
            }
        }
        
        // Update status via API
        CoroutineScope(Dispatchers.IO).launch {
            try {
                val apiClient = ApiClient(apiUrl)
                val request = UpdateStatusRequest(
                    deviceToken = deviceToken,
                    messageId = messageId,
                    status = status,
                    error = error
                )
                
                val result = apiClient.updateMessageStatus(request)
                
                if (result.isSuccess) {
                    Log.d(TAG, "Status updated successfully: $messageId -> $status")
                } else {
                    Log.e(TAG, "Failed to update status: ${result.exceptionOrNull()?.message}")
                }
            } catch (e: Exception) {
                Log.e(TAG, "Error updating status", e)
            }
        }
    }
    
    private fun handleSmsDelivered(context: Context, messageId: String) {
        Log.d(TAG, "SMS delivered: $messageId")
        // Optionally track delivery separately
    }
}




