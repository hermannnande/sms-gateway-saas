package com.smsgateway.app.data

import com.google.gson.annotations.SerializedName

// QR Code payload
data class QrPayload(
    @SerializedName("device_id") val deviceId: String,
    @SerializedName("device_token") val deviceToken: String,
    @SerializedName("api_url") val apiUrl: String
)

// Claim messages request
data class ClaimMessagesRequest(
    @SerializedName("device_token") val deviceToken: String,
    @SerializedName("limit") val limit: Int = 20,
    @SerializedName("sim_subscription_id") val simSubscriptionId: String?
)

// Claim messages response
data class ClaimMessagesResponse(
    @SerializedName("success") val success: Boolean,
    @SerializedName("messages") val messages: List<Message>,
    @SerializedName("count") val count: Int,
    @SerializedName("quota_remaining") val quotaRemaining: Int?,
    @SerializedName("campaign_running") val campaignRunning: Boolean? = null,
)

data class Message(
    @SerializedName("id") val id: String,
    @SerializedName("to_phone_e164") val toPhone: String,
    @SerializedName("body_final") val body: String,
    @SerializedName("campaign_id") val campaignId: String? = null,
)

// Update status request
data class UpdateStatusRequest(
    @SerializedName("device_token") val deviceToken: String,
    @SerializedName("message_id") val messageId: String,
    @SerializedName("status") val status: String,
    @SerializedName("error") val error: String? = null
)

// Update status response
data class UpdateStatusResponse(
    @SerializedName("success") val success: Boolean,
    @SerializedName("status") val status: String
)

// Campaign control
data class CampaignControlRequest(
    @SerializedName("action") val action: String, // pause | resume | cancel
    @SerializedName("campaign_id") val campaignId: String,
)

data class CampaignControlResponse(
    @SerializedName("success") val success: Boolean,
    @SerializedName("campaign_id") val campaignId: String,
    @SerializedName("action") val action: String,
)

// Update SIM request
data class UpdateSimRequest(
    @SerializedName("device_token") val deviceToken: String,
    @SerializedName("sim_subscription_id") val simSubscriptionId: String
)




