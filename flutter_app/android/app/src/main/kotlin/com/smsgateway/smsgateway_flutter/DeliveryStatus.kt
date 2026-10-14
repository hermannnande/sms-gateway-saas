package com.smsgateway.app

/** Only explicit terminal network evidence counts as delivery. */
object DeliveryStatus {
    fun fromNetwork(status: Int, format: String): String = when {
        format == "3gpp" && status == 0 -> "delivered"
        format == "3gpp" && status in 0x40..0x7f -> "failed"
        format == "3gpp2" && status == (2 shl 16) -> "delivered"
        format == "3gpp2" && ((status ushr 24) and 3) == 3 -> "failed"
        else -> "pending"
    }

    fun merge(previous: String, incoming: String): String = when {
        previous == "delivered" || incoming == "delivered" -> "delivered"
        previous == "failed" -> "failed"
        else -> incoming
    }

    fun aggregate(parts: List<String>): String = when {
        parts.isNotEmpty() && parts.all { it == "delivered" } -> "delivered"
        parts.any { it == "failed" } -> "failed"
        else -> "pending"
    }
}
