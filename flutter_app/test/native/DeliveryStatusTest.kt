package com.smsgateway.app

fun main() {
    check(DeliveryStatus.fromNetwork(0, "3gpp") == "delivered")
    check(DeliveryStatus.fromNetwork(1, "3gpp") == "pending") // forwarded, not confirmed received
    check(DeliveryStatus.fromNetwork(0x20, "3gpp") == "pending") // retrying at SMSC
    check(DeliveryStatus.fromNetwork(0x40, "3gpp") == "failed")
    check(DeliveryStatus.fromNetwork(0x60, "3gpp") == "failed")
    check(DeliveryStatus.fromNetwork(-1, "3gpp") == "pending")
    check(DeliveryStatus.fromNetwork(0, "unknown") == "pending")
    check(DeliveryStatus.fromNetwork(2 shl 16, "3gpp2") == "delivered")
    check(DeliveryStatus.fromNetwork(0, "3gpp2") == "pending")
    check(DeliveryStatus.fromNetwork(3 shl 24, "3gpp2") == "failed")
    check(DeliveryStatus.aggregate(emptyList()) == "pending")
    check(DeliveryStatus.aggregate(listOf("delivered", "pending")) == "pending")
    check(DeliveryStatus.aggregate(listOf("delivered", "delivered")) == "delivered")
    check(DeliveryStatus.aggregate(listOf("delivered", "failed")) == "failed")
    check(DeliveryStatus.merge("delivered", "failed") == "delivered")
    check(DeliveryStatus.merge("failed", "pending") == "failed")
    check(DeliveryStatus.merge("failed", "delivered") == "delivered")
    println("17 native delivery assertions passed")
}
