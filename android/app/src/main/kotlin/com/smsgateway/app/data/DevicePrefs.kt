package com.smsgateway.app.data

import android.content.Context
import android.content.SharedPreferences
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey

class DevicePrefs(context: Context) {
    
    private val masterKey = MasterKey.Builder(context)
        .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
        .build()
    
    private val prefs: SharedPreferences = EncryptedSharedPreferences.create(
        context,
        "device_prefs",
        masterKey,
        EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
        EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
    )
    
    fun saveDeviceInfo(deviceId: String, deviceToken: String, apiUrl: String) {
        prefs.edit()
            .putString(KEY_DEVICE_ID, deviceId)
            .putString(KEY_DEVICE_TOKEN, deviceToken)
            .putString(KEY_API_URL, apiUrl)
            .apply()
    }
    
    fun getDeviceId(): String? = prefs.getString(KEY_DEVICE_ID, null)
    fun getDeviceToken(): String? = prefs.getString(KEY_DEVICE_TOKEN, null)
    fun getApiUrl(): String? = prefs.getString(KEY_API_URL, null)
    
    fun saveSelectedSim(subscriptionId: String) {
        prefs.edit().putString(KEY_SELECTED_SIM, subscriptionId).apply()
    }
    
    fun getSelectedSim(): String? = prefs.getString(KEY_SELECTED_SIM, null)
    
    fun isConfigured(): Boolean {
        return getDeviceId() != null && getDeviceToken() != null
    }
    
    fun clear() {
        prefs.edit().clear().apply()
    }
    
    companion object {
        private const val KEY_DEVICE_ID = "device_id"
        private const val KEY_DEVICE_TOKEN = "device_token"
        private const val KEY_API_URL = "api_url"
        private const val KEY_SELECTED_SIM = "selected_sim"
    }
}








