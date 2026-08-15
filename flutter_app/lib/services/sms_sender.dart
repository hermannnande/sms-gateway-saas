import 'dart:async';

import 'package:flutter/services.dart';
import 'package:logger/logger.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:smsgateway_flutter/models/message.dart';

class SmsSendResult {
  SmsSendResult(this.success, {this.error, this.code});

  final bool success;
  final String? error;
  final String? code;
}

class SmsSender {
  SmsSender(this._logger);

  static const _channel = MethodChannel('com.smsgateway.app/sms');
  final Logger _logger;

  Future<List<SimCard>> getSimCards() async {
    try {
      final raw = await _channel.invokeMethod<List<dynamic>>('getSimCards');
      final list = raw ?? const [];
      return list
          .whereType<Map>()
          .map((m) => SimCard.fromJson(Map<String, dynamic>.from(m)))
          .toList();
    } catch (e) {
      _logger.w('Impossible de lire les SIMs: $e');
      return const [];
    }
  }

  Future<bool> ensurePermissions() async {
    final statuses = await [
      Permission.sms,
      Permission.phone,
    ].request();

    final granted = statuses.values.every((s) => s.isGranted);
    if (!granted) {
      _logger.w('Permissions SMS/Phone refusées: $statuses');
    }
    return granted;
  }

  Future<SmsSendResult> send(
    Message message, {
    int? subscriptionIdOverride,
    int? simSlotIndexOverride,
  }) async {
    try {
      final subId = subscriptionIdOverride ?? message.simSubscriptionId;
      final slotIdx = simSlotIndexOverride ?? message.simSlotIndex;
      final ok = await _channel.invokeMethod<bool>('sendSms', {
            'to': message.to,
            'body': message.content,
            'subscriptionId': subId,
            'simSlotIndex': slotIdx,
          }) ??
          false;

      return SmsSendResult(ok,
          error: ok ? null : 'Echec natif (pas de retour OS)');
    } on PlatformException catch (e) {
      _logger.e('Erreur envoi SMS (platform)', error: e);
      // Code natif: SMS_NETWORK_REJECTED / SMS_ANDROID_LIMIT / SMS_NO_SERVICE /
      // SMS_PERMISSION / SMS_NO_MANAGER / SMS_SEND_FAILED / SMS_TIMEOUT / etc.
      final code = e.code;
      final msg = (e.message ?? '').trim();
      final composed = msg.isEmpty ? code : '[$code] $msg';
      return SmsSendResult(false, error: composed, code: code);
    } catch (e, st) {
      _logger.e('Erreur envoi SMS', error: e, stackTrace: st);
      return SmsSendResult(false, error: e.toString());
    }
  }
}

class SimCard {
  const SimCard({
    required this.subscriptionId,
    required this.simSlotIndex,
    required this.displayName,
    required this.carrierName,
  });

  final int subscriptionId;
  final int simSlotIndex;
  final String displayName;
  final String carrierName;

  factory SimCard.fromJson(Map<String, dynamic> json) {
    int safeInt(dynamic v, {int fallback = -1}) {
      if (v == null) return fallback;
      if (v is int) return v;
      if (v is double) return v.toInt();
      return int.tryParse(v.toString()) ?? fallback;
    }

    return SimCard(
      subscriptionId: safeInt(json['subscriptionId'], fallback: -1),
      simSlotIndex: safeInt(json['simSlotIndex'], fallback: -1),
      displayName: (json['displayName'] ?? '').toString(),
      carrierName: (json['carrierName'] ?? '').toString(),
    );
  }

  String label() {
    final slot = simSlotIndex >= 0 ? 'SIM ${simSlotIndex + 1}' : 'SIM';
    final carrier = carrierName.isNotEmpty ? carrierName : displayName;
    final carrierPart = carrier.isNotEmpty ? ' • $carrier' : '';
    return '$slot$carrierPart';
  }
}
