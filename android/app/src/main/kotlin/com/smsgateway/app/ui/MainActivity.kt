package com.smsgateway.app.ui

import android.Manifest
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import com.google.gson.Gson
import com.google.zxing.integration.android.IntentIntegrator
import com.smsgateway.app.R
import com.smsgateway.app.data.ApiClient
import com.smsgateway.app.data.DevicePrefs
import com.smsgateway.app.data.QrPayload
import com.smsgateway.app.data.UpdateSimRequest
import com.smsgateway.app.databinding.ActivityMainBinding
import com.smsgateway.app.service.SmsGatewayService
import com.smsgateway.app.sms.SmsBroadcastReceiver
import com.smsgateway.app.sms.SmsManagerHelper
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

class MainActivity : AppCompatActivity() {
    
    private lateinit var binding: ActivityMainBinding
    private lateinit var prefs: DevicePrefs
    private lateinit var smsManager: SmsManagerHelper
    private var smsBroadcastReceiver: SmsBroadcastReceiver? = null
    
    private val permissionsLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { permissions ->
        val allGranted = permissions.values.all { it }
        if (allGranted) {
            checkSetupStatus()
        } else {
            Toast.makeText(this, "Permissions requises refusées", Toast.LENGTH_LONG).show()
        }
    }
    
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)
        
        prefs = DevicePrefs(this)
        smsManager = SmsManagerHelper(this)
        
        setupUI()
        requestPermissions()
        registerSmsReceiver()
    }
    
    private fun setupUI() {
        binding.btnScanQr.setOnClickListener {
            scanQrCode()
        }
        
        binding.btnSelectSim.setOnClickListener {
            selectSim()
        }
        
        binding.btnStartService.setOnClickListener {
            startGatewayService()
        }
        
        binding.btnStopService.setOnClickListener {
            stopGatewayService()
        }
        
        checkSetupStatus()
    }
    
    private fun requestPermissions() {
        val permissions = mutableListOf(
            Manifest.permission.SEND_SMS,
            Manifest.permission.READ_PHONE_STATE,
            Manifest.permission.CAMERA
        )
        
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            permissions.add(Manifest.permission.POST_NOTIFICATIONS)
        }
        
        val toRequest = permissions.filter {
            ContextCompat.checkSelfPermission(this, it) != PackageManager.PERMISSION_GRANTED
        }
        
        if (toRequest.isNotEmpty()) {
            permissionsLauncher.launch(toRequest.toTypedArray())
        }
    }
    
    private fun checkSetupStatus() {
        val isConfigured = prefs.isConfigured()
        val selectedSim = prefs.getSelectedSim()
        
        binding.tvStatus.text = buildString {
            append("Statut: ")
            if (!isConfigured) {
                append("⚠️ Non configuré\n")
                append("Scannez le QR code depuis le dashboard web")
            } else {
                append("✅ Configuré\n")
                append("Device ID: ${prefs.getDeviceId()?.take(8)}...\n")
                if (selectedSim != null) {
                    append("SIM: $selectedSim\n")
                    append("Prêt à envoyer des SMS")
                } else {
                    append("⚠️ Veuillez sélectionner une SIM")
                }
            }
        }
        
        binding.btnScanQr.isEnabled = !isConfigured
        binding.btnSelectSim.isEnabled = isConfigured
        binding.btnStartService.isEnabled = isConfigured && selectedSim != null
    }
    
    private fun scanQrCode() {
        IntentIntegrator(this).apply {
            setPrompt("Scannez le QR code depuis le dashboard")
            setBeepEnabled(true)
            setOrientationLocked(false)
            initiateScan()
        }
    }
    
    @Deprecated("Deprecated in Java")
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        val result = IntentIntegrator.parseActivityResult(requestCode, resultCode, data)
        if (result != null) {
            if (result.contents != null) {
                handleQrCode(result.contents)
            }
        } else {
            super.onActivityResult(requestCode, resultCode, data)
        }
    }
    
    private fun handleQrCode(qrContent: String) {
        try {
            val gson = Gson()
            val payload = gson.fromJson(qrContent, QrPayload::class.java)
            
            prefs.saveDeviceInfo(
                deviceId = payload.deviceId,
                deviceToken = payload.deviceToken,
                apiUrl = payload.apiUrl
            )
            
            Toast.makeText(this, "Appareil configuré avec succès!", Toast.LENGTH_SHORT).show()
            checkSetupStatus()
            
        } catch (e: Exception) {
            Toast.makeText(this, "QR code invalide: ${e.message}", Toast.LENGTH_LONG).show()
        }
    }
    
    private fun selectSim() {
        val simCards = smsManager.getAvailableSimCards()
        
        if (simCards.isEmpty()) {
            Toast.makeText(this, "Aucune carte SIM trouvée", Toast.LENGTH_SHORT).show()
            return
        }
        
        val simNames = simCards.map { "${it.displayName} (${it.carrierName})" }.toTypedArray()
        
        android.app.AlertDialog.Builder(this)
            .setTitle("Sélectionner une SIM")
            .setItems(simNames) { _, which ->
                val selectedSim = simCards[which]
                prefs.saveSelectedSim(selectedSim.subscriptionId.toString())
                
                // Update via API
                updateSimOnServer(selectedSim.subscriptionId.toString())
                
                Toast.makeText(this, "SIM sélectionnée: ${selectedSim.displayName}", Toast.LENGTH_SHORT).show()
                checkSetupStatus()
            }
            .show()
    }
    
    private fun updateSimOnServer(simId: String) {
        val deviceToken = prefs.getDeviceToken() ?: return
        val apiUrl = prefs.getApiUrl() ?: return
        
        CoroutineScope(Dispatchers.IO).launch {
            try {
                val apiClient = ApiClient(apiUrl)
                val request = UpdateSimRequest(
                    deviceToken = deviceToken,
                    simSubscriptionId = simId
                )
                
                val result = apiClient.updateSim(request)
                
                withContext(Dispatchers.Main) {
                    if (result.isSuccess) {
                        Toast.makeText(this@MainActivity, "SIM mise à jour sur le serveur", Toast.LENGTH_SHORT).show()
                    } else {
                        Toast.makeText(this@MainActivity, "Erreur API: ${result.exceptionOrNull()?.message}", Toast.LENGTH_SHORT).show()
                    }
                }
            } catch (e: Exception) {
                withContext(Dispatchers.Main) {
                    Toast.makeText(this@MainActivity, "Erreur: ${e.message}", Toast.LENGTH_SHORT).show()
                }
            }
        }
    }
    
    private fun startGatewayService() {
        val intent = Intent(this, SmsGatewayService::class.java).apply {
            action = SmsGatewayService.ACTION_START
        }
        
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            startForegroundService(intent)
        } else {
            startService(intent)
        }
        
        Toast.makeText(this, "Service démarré", Toast.LENGTH_SHORT).show()
        binding.tvStatus.append("\n\n🟢 Service actif")
    }
    
    private fun stopGatewayService() {
        val intent = Intent(this, SmsGatewayService::class.java)
        stopService(intent)
        
        Toast.makeText(this, "Service arrêté", Toast.LENGTH_SHORT).show()
        checkSetupStatus()
    }
    
    private fun registerSmsReceiver() {
        smsBroadcastReceiver = SmsBroadcastReceiver()
        val filter = IntentFilter().apply {
            addAction(SmsManagerHelper.ACTION_SMS_SENT)
            addAction(SmsManagerHelper.ACTION_SMS_DELIVERED)
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            registerReceiver(smsBroadcastReceiver, filter, RECEIVER_NOT_EXPORTED)
        } else {
            registerReceiver(smsBroadcastReceiver, filter)
        }
    }
    
    override fun onDestroy() {
        super.onDestroy()
        try {
            unregisterReceiver(smsBroadcastReceiver)
        } catch (e: Exception) {
            // Receiver not registered
        }
    }
}
