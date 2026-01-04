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
      // Client-proof: on évite de retomber sur Supabase direct (souvent bloqué par DNS/VPN).
      _logger.w('Proxy claim-messages failed: $e');
      throw Exception('Problème réseau: impossible de contacter le serveur. Réessaie dans 10 secondes.');
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
      _logger.w('Proxy update-message-status failed: $e');
      // Non bloquant: on ne veut pas interrompre l'envoi local si juste le reporting échoue
      return;
    }
  }

  Future<Map<String, dynamic>> sendHeartbeatVerbose({required String deviceToken}) async {
    try {
      return await _postProxy('/api/mobile/heartbeat', {'device_token': deviceToken});
    } catch (e) {
      _logger.w('Proxy heartbeat failed: $e');
      throw Exception('Heartbeat échoué: problème réseau.');
    }
  }

  /// Send heartbeat to keep device status "online"
  Future<void> sendHeartbeat({required String deviceToken}) async {
    try {
      // Toujours via proxy (client-proof).
      await sendHeartbeatVerbose(deviceToken: deviceToken);
    } catch (e) {
      _logger.w('Heartbeat error (ignored): $e');
      // Ignore heartbeat errors (non-critical)
    }
  }
}

