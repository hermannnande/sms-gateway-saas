import 'dart:convert';
import 'dart:async';

import 'package:logger/logger.dart';
import 'package:http/http.dart' as http;
import 'package:smsgateway_flutter/config.dart';
import 'package:smsgateway_flutter/models/message.dart';
import 'package:supabase/supabase.dart';

class DeviceService {
  DeviceService(this.client, this._logger);

  final SupabaseClient client;
  final Logger _logger;
  final http.Client _http = http.Client();

  Uri _proxyUri(String path) => Uri.parse('${AppConfig.webApiBaseUrl}$path');

  Future<Map<String, dynamic>> _postProxy(String path, Map<String, dynamic> body) async {
    final res = await _http.post(
      _proxyUri(path),
      headers: const {'Content-Type': 'application/json'},
      body: jsonEncode(body),
    );
    final decoded = jsonDecode(res.body.isEmpty ? '{}' : res.body);
    if (decoded is! Map<String, dynamic>) {
      throw Exception('Réponse proxy inattendue');
    }
    if (res.statusCode >= 400) {
      throw Exception(decoded['error']?.toString() ?? 'Erreur proxy (${res.statusCode})');
    }
    return decoded;
  }

  Exception _humanizeNetworkError(Object e) {
    final s = e.toString();
    if (s.contains('Failed host lookup') || s.contains('No address associated with hostname')) {
      return Exception(
        'Problème réseau/DNS: impossible de résoudre Supabase. Désactive VPN/DNS privé et change de réseau (Wi‑Fi/4G).',
      );
    }
    return Exception(s);
  }

  Future<List<Message>> claimMessages({
    required String deviceToken,
    int limit = 10,
    int? simSubscriptionId,
  }) async {
    try {
      final payload = await _postProxy('/api/mobile/claim-messages', {
        'device_token': deviceToken,
        'limit': limit,
        'sim_subscription_id': simSubscriptionId,
      });
      final rawList = (payload['messages'] as List?) ?? [];
      return rawList.map((e) => Message.fromJson(e as Map<String, dynamic>)).toList();
    } catch (e) {
      // Fallback Supabase direct (au cas où Vercel est inaccessible)
      _logger.w('Proxy claim-messages failed, fallback to Supabase: $e');
      Future<FunctionResponse> call() {
        return client.functions.invoke(
          'claim_messages',
          body: {
            'device_token': deviceToken,
            'limit': limit,
            'sim_subscription_id': simSubscriptionId,
          },
        );
      }

      FunctionResponse response;
      try {
        response = await call();
      } on FunctionException catch (e) {
        if (e.status == 503 && (e.details?['code'] == 'BOOT_ERROR')) {
          await Future<void>.delayed(const Duration(seconds: 2));
          response = await call();
        } else {
          throw _humanizeNetworkError(e);
        }
      } catch (e) {
        throw _humanizeNetworkError(e);
      }

      if (response.status >= 400) {
        throw Exception('claim_messages a échoué (${response.status})');
      }

      final data = response.data;
      if (data == null) return [];
      final payload2 = data is String ? jsonDecode(data) : data;
      final rawList2 = (payload2['messages'] as List?) ?? [];
      return rawList2.map((e) => Message.fromJson(e as Map<String, dynamic>)).toList();
    }
  }

  Future<void> updateMessageStatus({
    required String deviceToken,
    required Message message,
    required bool success,
    String? error,
  }) async {
    try {
      await _postProxy('/api/mobile/update-message-status', {
        'device_token': deviceToken,
        'message_id': message.id,
        'status': success ? 'sent' : 'failed',
        'error': error,
      });
      return;
    } catch (e) {
      _logger.w('Proxy update-message-status failed, fallback to Supabase: $e');
      try {
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
      } catch (e2) {
        throw _humanizeNetworkError(e2);
      }
    }
  }

  Future<Map<String, dynamic>> sendHeartbeatVerbose({required String deviceToken}) async {
    try {
      return await _postProxy('/api/mobile/heartbeat', {'device_token': deviceToken});
    } catch (e) {
      _logger.w('Proxy heartbeat failed, fallback to Supabase: $e');
      try {
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
      } catch (e2) {
        throw _humanizeNetworkError(e2);
      }
    }
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

