import 'dart:convert';
import 'dart:async';
import 'dart:math';
import 'dart:io';

import 'package:flutter/services.dart';
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
  static const MethodChannel _channel = MethodChannel('com.smsgateway.app/sms');

  Uri _proxyUri(String path) => Uri.parse('${AppConfig.webApiBaseUrl}$path');

  Future<String> _getFreshAccessTokenOrThrow() async {
    final session = client.auth.currentSession;
    if (session == null) {
      throw Exception('Non authentifié. Connectez-vous d’abord.');
    }

    // Supabase Session.expiresAt est en secondes epoch.
    final expiresAt = session.expiresAt;
    final nowSec = DateTime.now().millisecondsSinceEpoch ~/ 1000;

    // Si le token expire bientôt, on rafraîchit.
    if (expiresAt != null && expiresAt <= nowSec + 90) {
      try {
        final refreshToken = session.refreshToken;
        if (refreshToken != null && refreshToken.trim().isNotEmpty) {
          final res = await client.auth.refreshSession(refreshToken);
          final newToken = res.session?.accessToken.trim();
          if (newToken != null && newToken.isNotEmpty) return newToken;
        }
      } catch (e) {
        _logger.w('refreshSession failed (will try existing token): $e');
      }
    }

    final token = session.accessToken.trim();
    if (token.isEmpty) {
      throw Exception('Non authentifié. Connectez-vous d’abord.');
    }
    return token;
  }

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
          final err = decoded['error']?.toString().trim();
          if (err != null && err.isNotEmpty) {
            throw Exception(err);
          }
          final msg = decoded['message']?.toString().trim();
          if (msg != null && msg.isNotEmpty) {
            throw Exception(msg);
          }
          // Dernier recours: inclure un aperçu de la réponse pour debug.
          final preview = res.body.trim();
          final short = preview.length > 140 ? '${preview.substring(0, 140)}…' : preview;
          throw Exception('Erreur serveur (${res.statusCode})${short.isEmpty ? '' : ': $short'}');
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

  /// Variante verbose: retourne toute la réponse (messages + quota + plan...).
  Future<Map<String, dynamic>> claimMessagesVerbose({
    required String deviceToken,
    int limit = 10,
    int? simSubscriptionId,
  }) async {
    return await _postProxy('/api/mobile/claim-messages', {
      'device_token': deviceToken,
      'limit': limit,
      'sim_subscription_id': simSubscriptionId,
    });
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

  Future<Map<String, dynamic>> sendHeartbeatVerbose({
    required String deviceToken,
    String? appVersion,
  }) async {
    try {
      return await _postProxy('/api/mobile/heartbeat', {
        'device_token': deviceToken,
        if (appVersion != null) 'app_version': appVersion,
      });
    } catch (e) {
      _logger.w('Proxy heartbeat failed: $e');
      throw _humanizeNetworkError(e);
    }
  }

  /// Obtient un identifiant unique pour cet appareil (Android ID).
  Future<String?> _getDeviceId() async {
    try {
      if (Platform.isAndroid) {
        final v = await _channel.invokeMethod('getAndroidId');
        final s = v?.toString().trim();
        return (s == null || s.isEmpty) ? null : s;
      }
      // iOS/autre: retourner null (ou utiliser un autre identifiant)
      return null;
    } catch (e) {
      _logger.w('Impossible d\'obtenir Android ID: $e');
      return null;
    }
  }

  /// Crée un device côté serveur (Edge Function `device_pair`) et renvoie un `device_token`.
  /// Utilise le proxy Web (smsenvoie.com) pour éviter les soucis DNS vers Supabase chez certains opérateurs.
  /// Si un appareil avec le même Android ID existe déjà, il sera réutilisé (avec un nouveau token).
  Future<String> createDeviceToken({required String deviceName}) async {
    final accessToken = await _getFreshAccessTokenOrThrow();
    final androidId = await _getDeviceId();
    final payload = await _postProxy(
      '/api/mobile/device-pair',
      {
        'device_name': deviceName,
        if (androidId != null) 'android_id': androidId,
      },
      headers: {'Authorization': 'Bearer $accessToken'},
    );
    final token = payload['device_token']?.toString().trim() ?? '';
    if (token.isEmpty) {
      throw Exception(payload['error']?.toString() ?? 'device_token manquant');
    }
    return token;
  }

  /// Contrôle une campagne (pause / resume / cancel) via Edge Function `campaign_control`,
  /// en passant par le proxy Web (smsenvoie.com) pour la fiabilité réseau.
  Future<void> campaignControl({
    required String action, // 'pause' | 'resume' | 'cancel'
    required String campaignId,
    String? deviceToken, // fallback si JWT expiré
  }) async {
    final act = action.trim().toLowerCase();
    if (!['pause', 'resume', 'cancel'].contains(act)) {
      throw Exception('Action invalide: $action');
    }

    final body = {'action': act, 'campaign_id': campaignId, 'device_token': deviceToken};

    // 1) Essai via proxy AVEC session si possible (mais on ne bloque pas si la session est absente/expirée)
    String? token;
    try {
      token = await _getFreshAccessTokenOrThrow();
    } catch (_) {
      token = null;
    }

    if (token != null && token.isNotEmpty) {
      try {
        final payload = await _postProxy(
          '/api/mobile/campaign-control',
          body,
          headers: {'Authorization': 'Bearer $token'},
        );
        if (payload['success'] != true && payload['ok'] != true) {
          throw Exception(payload['error']?.toString() ?? payload['message']?.toString() ?? 'Erreur contrôle campagne');
        }
        return;
      } catch (e) {
        _logger.w('campaignControl proxy(auth) failed: $e');
        // Continue vers fallback device_token
      }
    }

    // 2) Fallback via proxy SANS Authorization (device_token only)
    if (deviceToken == null || deviceToken.trim().isEmpty) {
      throw Exception('Impossible: device_token manquant pour contrôler la campagne.');
    }
    final payload2 = await _postProxy('/api/mobile/campaign-control', body);
    if (payload2['success'] != true && payload2['ok'] != true) {
      throw Exception(payload2['error']?.toString() ?? payload2['message']?.toString() ?? 'Erreur contrôle campagne');
    }
  }

  /// Reset failed messages to queued for retry.
  Future<Map<String, dynamic>> retryFailed({required String deviceToken}) async {
    return await _postProxy('/api/mobile/retry-failed', {
      'device_token': deviceToken,
    });
  }

  Future<void> sendHeartbeat({required String deviceToken}) async {
    try {
      await sendHeartbeatVerbose(deviceToken: deviceToken);
    } catch (e) {
      _logger.w('Heartbeat error (ignored): $e');
    }
  }

  // ── Campaign management ──

  Future<Map<String, dynamic>> listCampaigns({
    required String deviceToken,
    int page = 1,
    int limit = 20,
    String? status,
  }) async {
    return await _postProxy('/api/mobile/campaigns', {
      'device_token': deviceToken,
      'action': 'list',
      'page': page,
      'limit': limit,
      if (status != null) 'status': status,
    });
  }

  Future<Map<String, dynamic>> campaignDetail({
    required String deviceToken,
    required String campaignId,
  }) async {
    return await _postProxy('/api/mobile/campaigns', {
      'device_token': deviceToken,
      'action': 'detail',
      'campaign_id': campaignId,
    });
  }

  Future<Map<String, dynamic>> createCampaign({
    required String deviceToken,
    required String name,
    required String message,
    required List<String> contacts,
    int? simSlotIndex,
    int priority = 0,
  }) async {
    return await _postProxy('/api/mobile/campaigns', {
      'device_token': deviceToken,
      'action': 'create',
      'name': name,
      'message': message,
      'contacts': contacts,
      'sim_slot_index': simSlotIndex,
      'priority': priority,
    });
  }

  Future<Map<String, dynamic>> listTemplates({
    required String deviceToken,
  }) async {
    return await _postProxy('/api/mobile/campaigns', {
      'device_token': deviceToken,
      'action': 'templates',
    });
  }
}

