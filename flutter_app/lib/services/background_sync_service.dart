import 'dart:async';
import 'dart:convert';
import 'dart:math';

import 'package:flutter/services.dart';
import 'package:flutter_foreground_task/flutter_foreground_task.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:http/http.dart' as http;

import 'package:smsgateway_flutter/config.dart';
import 'package:smsgateway_flutter/models/message.dart';

class BackgroundSyncService {
  static const int serviceId = 701;
  static const String _pausedKey = 'bg_sync_paused';
  static const String _enabledKey = 'bg_sync_enabled';
  static const String _fgLockKey = 'bg_sync_fg_lock';

  static Future<void> init() async {
    FlutterForegroundTask.initCommunicationPort();

      FlutterForegroundTask.init(
      androidNotificationOptions: AndroidNotificationOptions(
        // IMPORTANT: le channel est créé 1 seule fois sur Android 8+.
        // On utilise un nouveau channelId pour éviter qu'un ancien channel "LOW" reste minimisé
        // (texte/boutons cachés sur certains téléphones).
        channelId: 'sms_gateway_active_v3', // Nouveau channel pour forcer recréation (cache OEM)
        channelName: 'SMS Gateway - Envoi actif',
        channelDescription: 'Affiche la progression de l''envoi de SMS en temps réel.',
        channelImportance: NotificationChannelImportance.DEFAULT,
        priority: NotificationPriority.DEFAULT,
        showWhen: false,
        // Ne pas alerter à chaque update (mais le texte doit quand même changer)
        onlyAlertOnce: true,
      ),
      iosNotificationOptions: IOSNotificationOptions(
        showNotification: false,
        playSound: false,
      ),
      foregroundTaskOptions: ForegroundTaskOptions(
        eventAction: ForegroundTaskEventAction.repeat(3000), // 3 secondes pour réactivité maximale
        autoRunOnBoot: false,
        autoRunOnMyPackageReplaced: true,
        allowWakeLock: true,
        allowWifiLock: true,
      ),
    );
  }

  @pragma('vm:entry-point')
  static void startCallback() {
    FlutterForegroundTask.setTaskHandler(_SmsGatewayTaskHandler());
  }

  static Future<bool> isRunning() => FlutterForegroundTask.isRunningService;

  static Future<bool> isEnabled() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getBool(_enabledKey) ?? false;
  }

  static Future<void> setEnabled(bool enabled) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(_enabledKey, enabled);
  }

  static Future<bool> isPaused() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getBool(_pausedKey) ?? false;
  }

  static Future<void> setPaused(bool paused) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(_pausedKey, paused);
    // Update notification immediately if running.
    if (await FlutterForegroundTask.isRunningService) {
      await FlutterForegroundTask.updateService(
        notificationTitle: 'SMS Gateway',
        notificationText: paused ? '⏸️ Pause' : '✅ Actif (en attente)',
        notificationButtons: [
          NotificationButton(id: paused ? 'resume' : 'pause', text: paused ? 'Reprendre' : 'Pause'),
          const NotificationButton(id: 'stop', text: 'Annuler'),
        ],
      );
    }
  }

  /// Verrou simple pour éviter le double-envoi: si l'utilisateur envoie "en écran"
  /// (syncOnce), le service arrière-plan doit attendre.
  static Future<void> setForegroundLock(bool locked) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(_fgLockKey, locked);
  }

  static Future<bool> isForegroundLocked() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getBool(_fgLockKey) ?? false;
  }

  static Future<void> start() async {
    // Android 13+: notification permission for foreground notification
    try {
      final s = await Permission.notification.status;
      if (s.isPermanentlyDenied) {
        await openAppSettings();
        return;
      }
      if (!s.isGranted) {
        await Permission.notification.request();
      }
    } catch (_) {}

    final permission = await FlutterForegroundTask.checkNotificationPermission();
    if (permission != NotificationPermission.granted) {
      await FlutterForegroundTask.requestNotificationPermission();
    }

    // Optionnel: demander d'ignorer l'optimisation batterie (beaucoup d'OEM tuent les services sinon)
    try {
      final b = await Permission.ignoreBatteryOptimizations.status;
      if (b.isPermanentlyDenied) {
        await openAppSettings();
        // on continue quand même, mais le service risque d'être tué par l'OS
      }
      if (!b.isGranted) {
        await Permission.ignoreBatteryOptimizations.request();
      }
    } catch (_) {}

    // IMPORTANT: certains téléphones gardent l'ancien channel/texte si on fait juste restartService().
    // On force un stop+start pour appliquer les nouveaux paramètres de notification.
    if (await FlutterForegroundTask.isRunningService) {
      await FlutterForegroundTask.stopService();
      // petite pause pour laisser Android relâcher la notif/service
      await Future.delayed(const Duration(milliseconds: 250));
    }

    await FlutterForegroundTask.startService(
      serviceId: serviceId,
      notificationTitle: 'SMS Gateway',
      notificationText: '✅ Actif (en attente)',
      notificationButtons: const [
        NotificationButton(id: 'pause', text: 'Pause'),
        NotificationButton(id: 'stop', text: 'Annuler'),
      ],
      callback: startCallback,
    );
  }

  static Future<void> stop() async {
    await FlutterForegroundTask.stopService();
  }
}

class _SmsGatewayTaskHandler extends TaskHandler {
  static const _channel = MethodChannel('com.smsgateway.app/sms');
  final _http = http.Client();
  final _rng = Random();
  bool _busy = false;

  Uri _proxyUri(String path) => Uri.parse('${AppConfig.webApiBaseUrl}$path');

  Future<String?> _loadDeviceToken() async {
    final prefs = await SharedPreferences.getInstance();
    final v = prefs.getString('device_token');
    if (v == null) return null;
    return v.trim().isEmpty ? null : v.trim();
  }

  Future<bool> _isPaused() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getBool(BackgroundSyncService._pausedKey) ?? false;
  }

  Future<bool> _isForegroundLocked() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getBool(BackgroundSyncService._fgLockKey) ?? false;
  }

  Future<List<Map<String, dynamic>>> _getSimCards() async {
    try {
      final raw = await _channel.invokeMethod('getSimCards');
      final list = (raw as List? ?? const []).whereType<Map>().map((e) {
        final m = Map<String, dynamic>.from(e);
        return m;
      }).toList();
      return list;
    } catch (_) {
      return const [];
    }
  }

  int? _pickSubscriptionId(Message msg, List<Map<String, dynamic>> sims) {
    if (msg.simSubscriptionId != null) return msg.simSubscriptionId;
    if (msg.simSlotIndex == null) return null;
    for (final s in sims) {
      final slot = s['simSlotIndex'];
      if (slot is int && slot == msg.simSlotIndex) {
        final sub = s['subscriptionId'];
        if (sub is int) return sub;
      }
    }
    return null;
  }

  Future<Map<String, dynamic>> _postJson(Uri uri, Map<String, dynamic> body) async {
    const maxAttempts = 3;
    for (var attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        final res = await _http
            .post(
              uri,
              headers: const {'Content-Type': 'application/json'},
              body: jsonEncode(body),
            )
            .timeout(const Duration(seconds: 12));
        final decoded = jsonDecode(res.body.isEmpty ? '{}' : res.body);
        if (decoded is Map<String, dynamic>) {
          if (res.statusCode >= 400) {
            throw Exception(decoded['error']?.toString() ?? 'Erreur serveur (${res.statusCode})');
          }
          return decoded;
        }
        throw Exception('Réponse serveur inattendue');
      } catch (e) {
        if (attempt >= maxAttempts) rethrow;
        await Future.delayed(Duration(milliseconds: 400 * (1 << (attempt - 1)) + _rng.nextInt(250)));
      }
    }
    throw Exception('Erreur réseau');
  }

  Future<Map<String, dynamic>> _claimPayload(String deviceToken) async {
    return await _postJson(
      _proxyUri('/api/mobile/claim-messages'),
      {'device_token': deviceToken, 'limit': AppConfig.claimBatchSize, 'sim_subscription_id': null},
    );
  }

  Future<void> _updateStatus(String deviceToken, Message msg, bool success, String? error) async {
    try {
      await _postJson(
        _proxyUri('/api/mobile/update-message-status'),
        {
          'device_token': deviceToken,
          'message_id': msg.id,
          'status': success ? 'sent' : 'failed',
          'error': error,
        },
      );
    } catch (_) {
      // non-bloquant
    }
  }

  String _progressBar(int done, int total) {
    if (total <= 0) return '';
    final width = 10;
    final filled = ((done / total) * width).clamp(0, width).floor();
    return '[${'█' * filled}${'░' * (width - filled)}]';
  }

  String _hhmmss() {
    final n = DateTime.now();
    final hh = n.hour.toString().padLeft(2, '0');
    final mm = n.minute.toString().padLeft(2, '0');
    final ss = n.second.toString().padLeft(2, '0');
    return '$hh:$mm:$ss';
  }

  Map<String, Map<String, dynamic>> _campaignsFromPayload(Map<String, dynamic> payload) {
    final raw = payload['campaigns'];
    if (raw is! List) return <String, Map<String, dynamic>>{};
    final out = <String, Map<String, dynamic>>{};
    for (final item in raw) {
      if (item is Map) {
        final m = Map<String, dynamic>.from(item);
        final id = m['id']?.toString();
        if (id != null && id.trim().isNotEmpty) {
          out[id.trim()] = m;
        }
      }
    }
    return out;
  }

  int _asInt(dynamic v, {int fallback = 0}) {
    if (v == null) return fallback;
    if (v is int) return v;
    if (v is double) return v.toInt();
    return int.tryParse(v.toString()) ?? fallback;
  }

  @override
  Future<void> onStart(DateTime timestamp, TaskStarter starter) async {
    await FlutterForegroundTask.updateService(
      notificationTitle: 'SMS Gateway',
      notificationText: '✅ Actif • ${_hhmmss()} • En attente...',
      notificationButtons: const [
        NotificationButton(id: 'pause', text: 'Pause'),
        NotificationButton(id: 'stop', text: 'Annuler'),
      ],
    );
  }

  @override
  void onRepeatEvent(DateTime timestamp) {
    // Run async without blocking the event loop
    unawaited(_tick());
  }

  Future<void> _tick() async {
    if (_busy) return;
    _busy = true;
    try {
      // If foreground sync is running, don't claim/send in background to avoid double-send.
      final fgLocked = await _isForegroundLocked();
      if (fgLocked) {
        await FlutterForegroundTask.updateService(
          notificationTitle: 'SMS Gateway',
          notificationText: '⏳ Envoi en cours via l’app...',
          notificationButtons: const [
            NotificationButton(id: 'stop', text: 'Annuler'),
          ],
        );
        return;
      }

      final paused = await _isPaused();
      if (paused) {
        await FlutterForegroundTask.updateService(
          notificationTitle: 'SMS Gateway',
          notificationText: '⏸️ Pause',
          notificationButtons: const [
            NotificationButton(id: 'resume', text: 'Reprendre'),
            NotificationButton(id: 'stop', text: 'Annuler'),
          ],
        );
        return;
      }

      final token = await _loadDeviceToken();
      if (token == null) {
        await FlutterForegroundTask.updateService(
          notificationTitle: 'SMS Gateway',
          notificationText: '⚠️ Aucun appareil jumelé',
          notificationButtons: const [
            NotificationButton(id: 'stop', text: 'Annuler'),
          ],
        );
        return;
      }

      // Permissions SMS / téléphone: si manquantes, l'envoi échoue en boucle (retry côté serveur).
      // On l'affiche clairement dans la notification pour éviter le "tourne en boucle".
      try {
        final smsOk = await Permission.sms.isGranted;
        final phoneOk = await Permission.phone.isGranted;
        if (!smsOk || !phoneOk) {
          await FlutterForegroundTask.updateService(
            notificationTitle: 'SMS Gateway',
            notificationText:
                '⚠️ Permissions manquantes. Ouvre l’app et autorise SMS/Téléphone, puis relance.',
            notificationButtons: const [
              NotificationButton(id: 'stop', text: 'Annuler'),
            ],
          );
          return;
        }
      } catch (_) {}

      final payload = await _claimPayload(token);
      final rawList = (payload['messages'] as List?) ?? const [];
      final messages =
          rawList.whereType<Map>().map((e) => Message.fromJson(Map<String, dynamic>.from(e))).toList();
      final campaigns = _campaignsFromPayload(payload);
      final remaining = payload['quota_remaining'] is int ? payload['quota_remaining'] as int : null;
      final quotaReached = payload['quota_reached'] == true || remaining == 0;
      final plan = payload['plan'];
      final planQuota = plan is Map && plan['sms_quota_month'] is int ? plan['sms_quota_month'] as int : null;

      if (messages.isEmpty) {
        if (quotaReached && (planQuota ?? 0) > 0) {
          await FlutterForegroundTask.updateService(
            notificationTitle: 'SMS Gateway',
            notificationText: '🚫 Quota atteint (0 SMS restant ce mois)',
            notificationButtons: const [
              NotificationButton(id: 'stop', text: 'Annuler'),
            ],
          );
          return;
        }
        await FlutterForegroundTask.updateService(
          notificationTitle: 'SMS Gateway',
          notificationText: '✅ Actif • ${_hhmmss()} • En attente de messages...',
          notificationButtons: const [
            NotificationButton(id: 'pause', text: 'Pause'),
            NotificationButton(id: 'stop', text: 'Annuler'),
          ],
        );
        return;
      }

      final sims = await _getSimCards();
      // Si la campagne force une SIM (slot:X) mais on ne peut pas lire les SIMs, prévenir.
      final requiresSimRouting = messages.any((m) => m.simSlotIndex != null);
      if (requiresSimRouting && sims.isEmpty) {
        await FlutterForegroundTask.updateService(
          notificationTitle: 'SMS Gateway',
          notificationText:
              '⚠️ SIM non détectée. Autorise la permission Téléphone, puis relance l’app.',
          notificationButtons: const [
            NotificationButton(id: 'stop', text: 'Annuler'),
          ],
        );
        return;
      }
      final batchTotal = messages.length;
      var attempted = 0;
      var failed = 0;
      String? lastErr;

      // Progression "campagne" (sent_count/total_count) si dispo, sinon fallback batch.
      final campaignIds = messages.map((m) => m.campaignId).whereType<String>().toSet();
      final knownCampaignIds = campaignIds.where(campaigns.containsKey).toList();
      final isMultiCampaign = knownCampaignIds.length > 1;
      final activeCampaignId = knownCampaignIds.length == 1 ? knownCampaignIds.first : null;

      final campaignLabel = () {
        if (activeCampaignId != null) {
          final name = campaigns[activeCampaignId]?['name']?.toString().trim();
          return (name == null || name.isEmpty) ? 'Campagne' : name;
        }
        if (isMultiCampaign) return 'Multi-campagnes';
        return 'Campagne';
      }();

      int baseSentSum = 0;
      int totalSum = 0;
      if (knownCampaignIds.isNotEmpty) {
        for (final id in knownCampaignIds) {
          final c = campaigns[id];
          baseSentSum += _asInt(c?['sent_count'], fallback: 0);
          totalSum += _asInt(c?['total_count'], fallback: 0);
        }
      }
      final hasCampaignTotals = knownCampaignIds.isNotEmpty && totalSum > 0;
      final sentDeltaByCampaign = <String, int>{};

      int sentNow() {
        if (!hasCampaignTotals) return 0;
        int deltaSum = 0;
        for (final v in sentDeltaByCampaign.values) {
          deltaSum += v;
        }
        return baseSentSum + deltaSum;
      }

      for (final msg in messages) {
        // Check pause mid-batch
        if (await _isPaused()) break;

        attempted++;

        // Mettre à jour la notification AVANT d'envoyer le SMS (pour montrer "Envoi en cours...")
        if (hasCampaignTotals) {
          final s = sentNow();
          final remain = max(totalSum - s, 0);
          await FlutterForegroundTask.updateService(
            notificationTitle: 'SMS Gateway',
            notificationText: '📤 Envoi... • ${_progressBar(s, totalSum)} $s/$totalSum • reste $remain',
            notificationButtons: const [
              NotificationButton(id: 'pause', text: 'Pause'),
              NotificationButton(id: 'stop', text: 'Annuler'),
            ],
          );
        } else {
          final remain = batchTotal - attempted;
          await FlutterForegroundTask.updateService(
            notificationTitle: 'Envoi SMS en cours',
            notificationText: '📤 Envoi... • ${_progressBar(attempted, batchTotal)} $attempted/$batchTotal • reste $remain',
            notificationButtons: const [
              NotificationButton(id: 'pause', text: 'Pause'),
              NotificationButton(id: 'stop', text: 'Annuler'),
            ],
          );
        }

        try {
          final subscriptionId = _pickSubscriptionId(msg, sims);
          await _channel.invokeMethod('sendSms', {
            'to': msg.to,
            'body': msg.content,
            'subscriptionId': subscriptionId,
          });
          await _updateStatus(token, msg, true, null);

          // Mettre à jour la progression locale (le backend incrémente aussi sent_count).
          final cid = msg.campaignId;
          if (cid != null && campaigns.containsKey(cid)) {
            sentDeltaByCampaign[cid] = (sentDeltaByCampaign[cid] ?? 0) + 1;
          }
        } catch (e) {
          await _updateStatus(token, msg, false, e.toString());
          failed++;
          lastErr = e.toString();
        }

        // Mettre à jour IMMÉDIATEMENT après l'envoi pour montrer la progression
        if (hasCampaignTotals) {
          final s = sentNow();
          final remain = max(totalSum - s, 0);
          await FlutterForegroundTask.updateService(
            notificationTitle: 'SMS Gateway',
            notificationText: failed > 0
                ? '⚠️ $campaignLabel • ${_progressBar(s, totalSum)} $s/$totalSum • err $failed • reste $remain'
                : '✅ $campaignLabel • ${_progressBar(s, totalSum)} $s/$totalSum • reste $remain',
            notificationButtons: const [
              NotificationButton(id: 'pause', text: 'Pause'),
              NotificationButton(id: 'stop', text: 'Annuler'),
            ],
          );
        } else {
          final remain = batchTotal - attempted;
          await FlutterForegroundTask.updateService(
            notificationTitle: 'Envoi SMS en cours',
            notificationText: failed > 0
                ? '⚠️ ${_progressBar(attempted, batchTotal)} $attempted/$batchTotal • err $failed • reste $remain'
                : '✅ ${_progressBar(attempted, batchTotal)} $attempted/$batchTotal • reste $remain',
            notificationButtons: const [
              NotificationButton(id: 'pause', text: 'Pause'),
              NotificationButton(id: 'stop', text: 'Annuler'),
            ],
          );
        }

        // Délai entre chaque SMS pour que la notif soit VISIBLE (configurable dans config.dart)
        await Future.delayed(Duration(milliseconds: AppConfig.smsDelayMs));
      }

      // Fin du batch - ne pas revenir sur "en attente" si la campagne continue
      // On garde la progression affichée pour que l'utilisateur voie l'avancement
      if (hasCampaignTotals) {
        final s = sentNow();
        final remain = max(totalSum - s, 0);
        final isDone = remain == 0;
        final errShort = (lastErr ?? '').replaceAll('\n', ' ');
        final errMsg = errShort.isEmpty ? '' : ' • err: ${errShort.substring(0, errShort.length.clamp(0, 60))}';
        await FlutterForegroundTask.updateService(
          notificationTitle: 'SMS Gateway',
          notificationText: failed > 0
              ? '❌ $campaignLabel • erreurs: $failed/$attempted$errMsg'
              : (isDone
                  ? '✅ $campaignLabel terminée • ${_progressBar(s, totalSum)} $s/$totalSum'
                  : '⏳ $campaignLabel • ${_progressBar(s, totalSum)} $s/$totalSum • reste $remain'),
          notificationButtons: const [
            NotificationButton(id: 'pause', text: 'Pause'),
            NotificationButton(id: 'stop', text: 'Annuler'),
          ],
        );
      } else {
        await FlutterForegroundTask.updateService(
          notificationTitle: 'SMS Gateway',
          notificationText: failed > 0
              ? '❌ Erreurs: $failed/$attempted • Ouvre l’app pour corriger (permissions/SIM)'
              : '✅ Batch traité ($attempted/$batchTotal) • En attente...',
          notificationButtons: const [
            NotificationButton(id: 'pause', text: 'Pause'),
            NotificationButton(id: 'stop', text: 'Annuler'),
          ],
        );
      }
    } catch (e) {
      await FlutterForegroundTask.updateService(
        notificationTitle: 'SMS Gateway',
        notificationText: 'Erreur sync: ${e.toString()}',
        notificationButtons: const [
          NotificationButton(id: 'stop', text: 'Annuler'),
        ],
      );
    } finally {
      _busy = false;
    }
  }

  @override
  void onNotificationButtonPressed(String id) {
    unawaited(_handleButton(id));
  }

  @override
  Future<void> onDestroy(DateTime timestamp, bool isTimeout) async {
    // Cleanup
    _http.close();
  }

  Future<void> _handleButton(String id) async {
    if (id == 'pause') {
      await BackgroundSyncService.setPaused(true);
      return;
    }
    if (id == 'resume') {
      await BackgroundSyncService.setPaused(false);
      return;
    }
    if (id == 'stop') {
      await BackgroundSyncService.setPaused(false);
      await BackgroundSyncService.setEnabled(false);
      await FlutterForegroundTask.stopService();
      return;
    }
  }
}


