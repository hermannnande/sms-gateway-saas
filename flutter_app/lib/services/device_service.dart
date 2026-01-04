import 'dart:convert';
import 'dart:async';
import 'dart:math';

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
  final Random _rng = Random();

  Uri _proxyUri(String path) => Uri.parse('${AppConfig.webApiBaseUrl}$path');

  Future<Map<String, dynamic>> _postProxy(
    String path,
    Map<String, dynamic> body, {
    Map<String, String>? headers,
  }) async {
    final uri = _proxyUri(path);
    const maxAttempts = 3;
    const baseTimeout = Duration(seconds: 12);

    for (var attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        final mergedHeaders = <String, String>{
          'Content-Type': 'application/json',
          ...?headers,
        };
        final res = await _http
            .post(
              uri,
              headers: mergedHeaders,
              body: jsonEncode(body),
            )
            .timeout(baseTimeout);

        // Retry sur erreurs serveurs temporaires
        if (res.statusCode >= 500 && attempt < maxAttempts) {
          _logger.w('Proxy $path (${res.statusCode}) attempt $attempt/$maxAttempts');
          await Future.delayed(_backoff(attempt));
          continue;
        }

        final decoded = jsonDecode(res.body.isEmpty ? '{}' : res.body);
        if (decoded is! Map<String, dynamic>) {
          throw Exception('Réponse serveur inattendue');
        }
        if (res.statusCode >= 400) {
          throw Exception(decoded['error']?.toString() ?? 'Erreur serveur (${res.statusCode})');
        }
        return decoded;
      } on TimeoutException catch (e) {
        if (attempt >= maxAttempts) throw _humanizeNetworkError(e);
        await Future.delayed(_backoff(attempt));
      } catch (e) {
        if (attempt >= maxAttempts) throw _humanizeNetworkError(e);
        await Future.delayed(_backoff(attempt));
      }
    }

    // impossible normalement
    throw Exception('Erreur réseau');
  }

  Duration _backoff(int attempt) {
    // 400ms, 800ms, 1600ms + jitter
    final baseMs = 400 * (1 << (attempt - 1));
    final jitterMs = _rng.nextInt(250);
    return Duration(milliseconds: baseMs + jitterMs);
  }

  Exception _humanizeNetworkError(Object e) {
    final s = e.toString();
    if (e is TimeoutException) {
      return Exception('Temps de connexion dépassé. Vérifie Internet et réessaie.');
    }
    if (s.contains('Failed host lookup') ||
        s.contains('No address associated with hostname') ||
        s.contains('SocketException')) {
      return Exception(
        'Problème réseau/DNS: impossible de contacter le serveur. Vérifie la connexion (Wi‑Fi/4G) puis réessaie.',
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
      _logger.w('Proxy claim-messages failed: $e');
      throw _humanizeNetworkError(e);
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
      throw _humanizeNetworkError(e);
    }
  }

  /// Crée un device côté serveur (Edge Function `device_pair`) et renvoie un `device_token`.
  /// Utilise le proxy Web (smsenvoie.com) pour éviter les soucis DNS vers Supabase chez certains opérateurs.
  Future<String> createDeviceToken({required String deviceName}) async {
    final accessToken = client.auth.currentSession?.accessToken;
    if (accessToken == null || accessToken.trim().isEmpty) {
      throw Exception('Non authentifié. Connectez-vous d’abord.');
    }
    final payload = await _postProxy(
      '/api/mobile/device-pair',
      {'device_name': deviceName},
      headers: {'Authorization': 'Bearer $accessToken'},
    );
    final token = payload['device_token']?.toString().trim() ?? '';
    if (token.isEmpty) {
      throw Exception(payload['error']?.toString() ?? 'device_token manquant');
    }
    return token;
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

