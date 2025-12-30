package com.smsgateway.app.data

import com.google.gson.Gson
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import java.util.concurrent.TimeUnit

class ApiClient(private val baseUrl: String) {
    
    private val client = OkHttpClient.Builder()
        .connectTimeout(30, TimeUnit.SECONDS)
        .readTimeout(30, TimeUnit.SECONDS)
        .build()
    
    private val gson = Gson()
    private val jsonMediaType = "application/json; charset=utf-8".toMediaType()
    
    fun claimMessages(request: ClaimMessagesRequest): Result<ClaimMessagesResponse> {
        return try {
            val json = gson.toJson(request)
            val body = json.toRequestBody(jsonMediaType)
            
            val httpRequest = Request.Builder()
                .url("$baseUrl/functions/v1/claim_messages")
                .post(body)
                .build()
            
            val response = client.newCall(httpRequest).execute()
            val responseBody = response.body?.string()
            
            if (response.isSuccessful && responseBody != null) {
                val data = gson.fromJson(responseBody, ClaimMessagesResponse::class.java)
                Result.success(data)
            } else {
                Result.failure(Exception("HTTP ${response.code}: $responseBody"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
    
    fun updateMessageStatus(request: UpdateStatusRequest): Result<UpdateStatusResponse> {
        return try {
            val json = gson.toJson(request)
            val body = json.toRequestBody(jsonMediaType)
            
            val httpRequest = Request.Builder()
                .url("$baseUrl/functions/v1/update_message_status")
                .post(body)
                .build()
            
            val response = client.newCall(httpRequest).execute()
            val responseBody = response.body?.string()
            
            if (response.isSuccessful && responseBody != null) {
                val data = gson.fromJson(responseBody, UpdateStatusResponse::class.java)
                Result.success(data)
            } else {
                Result.failure(Exception("HTTP ${response.code}: $responseBody"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
    
    fun updateSim(request: UpdateSimRequest): Result<Boolean> {
        return try {
            val json = gson.toJson(request)
            val body = json.toRequestBody(jsonMediaType)
            
            val httpRequest = Request.Builder()
                .url("$baseUrl/functions/v1/device_update_sim")
                .post(body)
                .build()
            
            val response = client.newCall(httpRequest).execute()
            
            if (response.isSuccessful) {
                Result.success(true)
            } else {
                Result.failure(Exception("HTTP ${response.code}"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    fun campaignControl(request: CampaignControlRequest): Result<CampaignControlResponse> {
        return try {
            val json = gson.toJson(request)
            val body = json.toRequestBody(jsonMediaType)

            val httpRequest = Request.Builder()
                .url("$baseUrl/functions/v1/campaign_control")
                .post(body)
                .build()

            val response = client.newCall(httpRequest).execute()
            val responseBody = response.body?.string()

            if (response.isSuccessful && responseBody != null) {
                val data = gson.fromJson(responseBody, CampaignControlResponse::class.java)
                Result.success(data)
            } else {
                Result.failure(Exception("HTTP ${response.code}: $responseBody"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
}




