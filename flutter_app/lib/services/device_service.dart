import 'dart:convert';

import 'package:logger/logger.dart';
import 'package:smsgateway_flutter/models/message.dart';
import 'package:supabase/supabase.dart';

class DeviceService {
  DeviceService(this.client, this._logger);

  final SupabaseClient client;
  final Logger _logger;

  Future<List<Message>> claimMessages({
    required String deviceToken,
    int limit = 10,
    int? simSubscriptionId,
  }) async {
    final response = await client.functions.invoke(
      'claim_messages',
      body: {
        'device_token': deviceToken,
        'limit': limit,
        'sim_subscription_id': simSubscriptionId,
      },
    );

    if (response.status >= 400) {
      throw Exception('claim_messages a échoué (${response.status})');
    }

    final data = response.data;
    if (data == null) return [];

    // L’API peut renvoyer un Map ou un JSON string.
    final payload = data is String ? jsonDecode(data) : data;
    final rawList = (payload['messages'] as List?) ?? [];

    return rawList.map((e) => Message.fromJson(e as Map<String, dynamic>)).toList();
  }

  Future<void> updateMessageStatus({
    required String deviceToken,
    required Message message,
    required bool success,
    String? error,
  }) async {
    final response = await client.functions.invoke(
      'update_message_status',
      body: {
        'device_token': deviceToken,
        'message_id': message.id,
        'status': success ? 'sent' : 'failed',
        'error': error,
      },
    );

    if (response.status >= 400) {
      _logger.w('update_message_status failed: ${response.status} / ${response.data}');
      throw Exception('update_message_status a échoué (${response.status})');
    }
  }

  Future<Map<String, dynamic>> sendHeartbeatVerbose({required String deviceToken}) async {
    final response = await client.functions.invoke(
      'heartbeat',
      body: {
        'device_token': deviceToken,
      },
    );

    if (response.status >= 400) {
      throw Exception('heartbeat a échoué (${response.status}): ${response.data}');
    }

    final data = response.data;
    final payload = data is String ? jsonDecode(data) : data;
    if (payload is! Map<String, dynamic>) {
      throw Exception('heartbeat: réponse inattendue');
    }

    return payload;
  }

  /// Send heartbeat to keep device status "online"
  Future<void> sendHeartbeat({required String deviceToken}) async {
    try {
      final response = await client.functions.invoke(
        'heartbeat',
        body: {
          'device_token': deviceToken,
        },
      );

      if (response.status >= 400) {
        _logger.w('heartbeat failed: ${response.status} / ${response.data}');
      } else {
        _logger.d('Heartbeat sent successfully');
      }
    } catch (e) {
      _logger.w('Heartbeat error (ignored): $e');
      // Ignore heartbeat errors (non-critical)
    }
  }
}

