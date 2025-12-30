package com.smsgateway.app.service

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Intent
import android.os.Build
import android.os.IBinder
import android.util.Log
import androidx.core.app.NotificationCompat
import com.smsgateway.app.GatewayApplication
import com.smsgateway.app.R
import com.smsgateway.app.data.ApiClient
import com.smsgateway.app.data.CampaignControlRequest
import com.smsgateway.app.data.ClaimMessagesRequest
import com.smsgateway.app.data.DevicePrefs
import com.smsgateway.app.sms.SmsManagerHelper
import kotlinx.coroutines.*

class SmsGatewayService : Service() {
    
    companion object {
        const val TAG = "SmsGatewayService"
        const val ACTION_START = "START"
        const val ACTION_STOP = "STOP"
        const val ACTION_PAUSE = "PAUSE"
        const val ACTION_RESUME = "RESUME"
        const val ACTION_CANCEL = "CANCEL"
        private const val NOTIFICATION_ID = 1
        private const val POLL_INTERVAL_MS = 10_000L // 10 seconds
        private const val SMS_DELAY_MS = 3_000L // 3 seconds between SMS
    }
    
    private val serviceScope = CoroutineScope(Dispatchers.IO + SupervisorJob())
    private var pollingJob: Job? = null
    
    private lateinit var prefs: DevicePrefs
    private lateinit var smsManager: SmsManagerHelper
    
    private var messagesSent = 0
    private var messagesQueued = 0
    private var currentCampaignId: String? = null
    
    override fun onCreate() {
        super.onCreate()
        prefs = DevicePrefs(this)
        smsManager = SmsManagerHelper(this)
        
        startForeground(NOTIFICATION_ID, createNotification("Démarrage..."))
        Log.d(TAG, "Service created")
    }
    
    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_START -> startPolling()
            ACTION_STOP -> stopPolling()
            ACTION_PAUSE -> handleCampaignControl("pause")
            ACTION_RESUME -> handleCampaignControl("resume")
            ACTION_CANCEL -> handleCampaignControl("cancel")
        }
        return START_STICKY
    }
    
    private fun startPolling() {
        if (pollingJob?.isActive == true) {
            Log.d(TAG, "Polling already active")
            return
        }
        
        if (!prefs.isConfigured()) {
            Log.e(TAG, "Device not configured")
            updateNotification("Erreur: appareil non configuré")
            stopSelf()
            return
        }
        
        val selectedSim = prefs.getSelectedSim()
        if (selectedSim == null) {
            Log.e(TAG, "No SIM selected")
            updateNotification("Erreur: aucune SIM sélectionnée")
            stopSelf()
            return
        }
        
        Log.d(TAG, "Starting polling loop")
        updateNotification("En attente de messages...")
        
        pollingJob = serviceScope.launch {
            while (isActive) {
                try {
                    processMessages()
                } catch (e: Exception) {
                    Log.e(TAG, "Error in polling loop", e)
                }
                
                delay(POLL_INTERVAL_MS)
            }
        }
    }
    
    private fun stopPolling() {
        Log.d(TAG, "Stopping polling")
        pollingJob?.cancel()
        pollingJob = null
        updateNotification("Service arrêté")
    }
    
    private suspend fun processMessages() {
        val deviceToken = prefs.getDeviceToken() ?: return
        val apiUrl = prefs.getApiUrl() ?: return
        val selectedSim = prefs.getSelectedSim() ?: return
        
        val apiClient = ApiClient(apiUrl)
        
        // Claim messages
        val request = ClaimMessagesRequest(
            deviceToken = deviceToken,
            limit = 20,
            simSubscriptionId = selectedSim
        )
        
        val result = apiClient.claimMessages(request)
        
        if (result.isFailure) {
            Log.e(TAG, "Failed to claim messages: ${result.exceptionOrNull()?.message}")
            updateNotification("Erreur API: ${result.exceptionOrNull()?.message}")
            return
        }
        
        val response = result.getOrNull() ?: return
        messagesQueued = response.count
        if (response.messages.isNotEmpty()) {
            currentCampaignId = response.messages.first().campaignId
        }
        
        if (response.messages.isEmpty()) {
            updateNotification("En attente... (${messagesSent} envoyés)")
            return
        }
        
        Log.d(TAG, "Claimed ${response.messages.size} messages")
        updateNotification("Envoi de ${response.messages.size} SMS...")
        
        // Send each message
        response.messages.forEach { message ->
            try {
                val simId = selectedSim.toIntOrNull() ?: 0
                
                val sendResult = smsManager.sendSms(
                    subscriptionId = simId,
                    destinationNumber = message.toPhone,
                    message = message.body,
                    messageId = message.id
                )
                
                if (sendResult.isSuccess) {
                    messagesSent++
                    Log.d(TAG, "SMS queued: ${message.id}")
                } else {
                    Log.e(TAG, "Failed to send SMS: ${sendResult.exceptionOrNull()?.message}")
                }
                
                // Delay between SMS
                delay(SMS_DELAY_MS)
                
            } catch (e: Exception) {
                Log.e(TAG, "Error sending message ${message.id}", e)
            }
        }
        
        updateNotification("Campagne ${currentCampaignId ?: ""} • ${messagesSent} envoyés")
    }
    
    private fun updateNotification(text: String) {
        val notification = createNotification(text)
        val notificationManager = getSystemService(NotificationManager::class.java)
        notificationManager.notify(NOTIFICATION_ID, notification)
    }
    
    private fun createNotification(text: String): Notification {
        val pauseIntent = Intent(this, SmsGatewayService::class.java).apply { action = ACTION_PAUSE }
        val resumeIntent = Intent(this, SmsGatewayService::class.java).apply { action = ACTION_RESUME }
        val cancelIntent = Intent(this, SmsGatewayService::class.java).apply { action = ACTION_CANCEL }

        val pausePending = PendingIntent.getService(
            this, 1, pauseIntent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        val resumePending = PendingIntent.getService(
            this, 2, resumeIntent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        val cancelPending = PendingIntent.getService(
            this, 3, cancelIntent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val builder = NotificationCompat.Builder(this, GatewayApplication.CHANNEL_ID)
            .setContentTitle("SMS Gateway")
            .setContentText(text)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setOngoing(true)
            .setOnlyAlertOnce(true)

        currentCampaignId?.let {
            builder.addAction(0, "Pause", pausePending)
            builder.addAction(0, "Reprendre", resumePending)
            builder.addAction(0, "Annuler", cancelPending)
        }

        return builder.build()
    }
    
    override fun onBind(intent: Intent?): IBinder? = null
    
    override fun onDestroy() {
        super.onDestroy()
        pollingJob?.cancel()
        serviceScope.cancel()
        Log.d(TAG, "Service destroyed")
    }

    private fun handleCampaignControl(action: String) {
        val campaignId = currentCampaignId ?: run {
            Log.w(TAG, "No campaign in context for action $action")
            return
        }
        val apiUrl = prefs.getApiUrl() ?: return
        serviceScope.launch {
            try {
                val client = ApiClient(apiUrl)
                val result = client.campaignControl(
                    CampaignControlRequest(action = action, campaignId = campaignId)
                )
                if (result.isSuccess) {
                    Log.d(TAG, "Campaign $action sent")
                    updateNotification("Campagne $campaignId : $action")
                } else {
                    Log.e(TAG, "Campaign $action failed: ${result.exceptionOrNull()?.message}")
                    updateNotification("Erreur $action")
                }
            } catch (e: Exception) {
                Log.e(TAG, "Error sending campaign $action", e)
                updateNotification("Erreur $action")
            }
        }
    }
}
