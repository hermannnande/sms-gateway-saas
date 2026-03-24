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
  static const String _activeCampaignIdKey = 'bg_sync_active_campaign_id';

  static Future<void> setActiveCampaignId(String? id) async {
    final prefs = await SharedPreferences.getInstance();
    if (id == null || id.isEmpty) {
      await prefs.remove(_activeCampaignIdKey);
    } else {
      await prefs.setString(_activeCampaignIdKey, id);
    }
  }

  static Future<String?> getActiveCampaignId() async {
    final prefs = await SharedPreferences.getInstance();
    final v = prefs.getString(_activeCampaignIdKey);
    return (v == null || v.trim().isEmpty) ? null : v.trim();
  }

  static Future<void> init() async {
    FlutterForegroundTask.initCommunicationPort();

      FlutterForegroundTask.init(
      androidNotificationOptions: AndroidNotificationOptions(
        channelId: 'sms_gateway_active_v4',
        channelName: 'SMS Gateway - Envoi actif',
        channelDescription: 'Affiche la progression et les controles d\'envoi SMS.',
        channelImportance: NotificationChannelImportance.DEFAULT,
        priority: NotificationPriority.DEFAULT,
        showWhen: false,
        onlyAlertOnce: true,
      ),
      iosNotificationOptions: IOSNotificationOptions(
        showNotification: false,
        playSound: false,
      ),
      foregroundTaskOptions: ForegroundTaskOptions(
        eventAction: ForegroundTaskEventAction.repeat(3000),
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
    if (await FlutterForegroundTask.isRunningService) {
      await FlutterForegroundTask.updateService(
        notificationTitle: 'SMS Gateway',
        notificationText: paused ? '\u23f8\ufe0f En pause' : '\u2705 Actif (en attente)',
        notificationButtons: [
          NotificationButton(id: paused ? 'resume' : 'pause', text: paused ? 'Reprendre' : 'Pause'),
          const NotificationButton(id: 'stop', text: 'Annuler campagne'),
        ],
      );
    }
  }

  static Future<void> setForegroundLock(bool locked) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(_fgLockKey, locked);
  }

  static Future<bool> isForegroundLocked() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getBool(_fgLockKey) ?? false;
  }

  static Future<void> start() async {
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

    try {
      final b = await Permission.ignoreBatteryOptimizations.status;
      if (b.isPermanentlyDenied) {
        await openAppSettings();
      }
      if (!b.isGranted) {
        await Permission.ignoreBatteryOptimizations.request();
      }
    } catch (_) {}

    if (await FlutterForegroundTask.isRunningService) {
      await FlutterForegroundTask.stopService();
      await Future.delayed(const Duration(milliseconds: 250));
    }

    await FlutterForegroundTask.startService(
      serviceId: serviceId,
      notificationTitle: 'SMS Gateway',
      notificationText: '\u2705 Actif (en attente)',
      notificationButtons: const [
        NotificationButton(id: 'pause', text: 'Pause'),
        NotificationButton(id: 'stop', text: 'Annuler campagne'),
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
  String? _activeCampaignId;

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
        throw Exception('R\u00e9ponse serveur inattendue');
      } catch (e) {
        if (attempt >= maxAttempts) rethrow;
        await Future.delayed(Duration(milliseconds: 400 * (1 << (attempt - 1)) + _rng.nextInt(250)));
      }
    }
    throw Exception('Erreur r\u00e9seau');
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
    } catch (_) {}
  }

  String _progressBar(int done, int total) {
    if (total <= 0) return '';
    const width = 10;
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

  List<NotificationButton> _activeButtons() {
    return const [
      NotificationButton(id: 'pause', text: 'Pause'),
      NotificationButton(id: 'stop', text: 'Annuler campagne'),
    ];
  }

  List<NotificationButton> _pausedButtons() {
    return const [
      NotificationButton(id: 'resume', text: 'Reprendre'),
      NotificationButton(id: 'stop', text: 'Annuler campagne'),
    ];
  }

  @override
  Future<void> onStart(DateTime timestamp, TaskStarter starter) async {
    _activeCampaignId = await BackgroundSyncService.getActiveCampaignId();
    await FlutterForegroundTask.updateService(
      notificationTitle: 'SMS Gateway',
      notificationText: '\u2705 Actif \u2022 ${_hhmmss()} \u2022 En attente...',
      notificationButtons: _activeButtons(),
    );
  }

  @override
  void onRepeatEvent(DateTime timestamp) {
    unawaited(_tick());
  }

  Future<void> _tick() async {
    if (_busy) return;
    _busy = true;
    try {
      final fgLocked = await _isForegroundLocked();
      if (fgLocked) {
        await FlutterForegroundTask.updateService(
          notificationTitle: 'SMS Gateway',
          notificationText: '\u23f3 Envoi en cours via l\'app...',
          notificationButtons: _activeButtons(),
        );
        return;
      }

      final paused = await _isPaused();
      if (paused) {
        await FlutterForegroundTask.updateService(
          notificationTitle: 'SMS Gateway',
          notificationText: '\u23f8\ufe0f En pause',
          notificationButtons: _pausedButtons(),
        );
        return;
      }

      final token = await _loadDeviceToken();
      if (token == null) {
        await FlutterForegroundTask.updateService(
          notificationTitle: 'SMS Gateway',
          notificationText: '\u26a0\ufe0f Aucun appareil jumel\u00e9',
          notificationButtons: _activeButtons(),
        );
        return;
      }

      try {
        final smsOk = await Permission.sms.isGranted;
        final phoneOk = await Permission.phone.isGranted;
        if (!smsOk || !phoneOk) {
          await FlutterForegroundTask.updateService(
            notificationTitle: 'SMS Gateway',
            notificationText: '\u26a0\ufe0f Permissions manquantes. Ouvre l\'app et autorise SMS/T\u00e9l\u00e9phone.',
            notificationButtons: _activeButtons(),
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
            notificationText: '\ud83d\udeab Quota atteint (0 SMS restant ce mois)',
            notificationButtons: _activeButtons(),
          );
          return;
        }
        final debugInfo = quotaReached ? 'quota=$remaining' : 'pas de campagne';
        await FlutterForegroundTask.updateService(
          notificationTitle: 'SMS Gateway',
          notificationText: '\u2705 Actif \u2022 ${_hhmmss()} \u2022 Aucun msg ($debugInfo)',
          notificationButtons: _activeButtons(),
        );
        return;
      }

      await FlutterForegroundTask.updateService(
        notificationTitle: 'SMS Gateway',
        notificationText: '\ud83d\udd04 ${messages.length} msg r\u00e9cup\u00e9r\u00e9s, envoi imminent...',
        notificationButtons: _activeButtons(),
      );

      final sims = await _getSimCards();
      final requiresSimRouting = messages.any((m) => m.simSlotIndex != null);
      if (requiresSimRouting && sims.isEmpty) {
        await FlutterForegroundTask.updateService(
          notificationTitle: 'SMS Gateway',
          notificationText: '\u26a0\ufe0f SIM non d\u00e9tect\u00e9e. Autorise la permission T\u00e9l\u00e9phone.',
          notificationButtons: _activeButtons(),
        );
        return;
      }
      final batchTotal = messages.length;
      var attempted = 0;
      var failed = 0;
      String? lastErr;

      final campaignIds = messages.map((m) => m.campaignId).whereType<String>().toSet();
      final knownCampaignIds = campaignIds.where(campaigns.containsKey).toList();
      final isMultiCampaign = knownCampaignIds.length > 1;
      final activeCampaignId = knownCampaignIds.length == 1 ? knownCampaignIds.first : null;

      if (activeCampaignId != null) {
        await BackgroundSyncService.setActiveCampaignId(activeCampaignId);
        _activeCampaignId = activeCampaignId;
      } else if (knownCampaignIds.isNotEmpty) {
        await BackgroundSyncService.setActiveCampaignId(knownCampaignIds.first);
        _activeCampaignId = knownCampaignIds.first;
      }

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
        if (await _isPaused()) break;

        attempted++;

        if (hasCampaignTotals) {
          final s = sentNow();
          final remain = max(totalSum - s, 0);
          await FlutterForegroundTask.updateService(
            notificationTitle: 'SMS Gateway',
            notificationText: '\ud83d\udce4 Envoi... \u2022 ${_progressBar(s, totalSum)} $s/$totalSum \u2022 reste $remain',
            notificationButtons: _activeButtons(),
          );
        } else {
          final remain = batchTotal - attempted;
          await FlutterForegroundTask.updateService(
            notificationTitle: 'Envoi SMS en cours',
            notificationText: '\ud83d\udce4 Envoi... \u2022 ${_progressBar(attempted, batchTotal)} $attempted/$batchTotal \u2022 reste $remain',
            notificationButtons: _activeButtons(),
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

          final cid = msg.campaignId;
          if (cid != null && campaigns.containsKey(cid)) {
            sentDeltaByCampaign[cid] = (sentDeltaByCampaign[cid] ?? 0) + 1;
          }
        } catch (e) {
          await _updateStatus(token, msg, false, e.toString());
          failed++;
          lastErr = e.toString();
        }

        if (hasCampaignTotals) {
          final s = sentNow();
          final remain = max(totalSum - s, 0);
          await FlutterForegroundTask.updateService(
            notificationTitle: 'SMS Gateway',
            notificationText: failed > 0
                ? '\u26a0\ufe0f $campaignLabel \u2022 ${_progressBar(s, totalSum)} $s/$totalSum \u2022 err $failed \u2022 reste $remain'
                : '\u2705 $campaignLabel \u2022 ${_progressBar(s, totalSum)} $s/$totalSum \u2022 reste $remain',
            notificationButtons: _activeButtons(),
          );
        } else {
          final remain = batchTotal - attempted;
          await FlutterForegroundTask.updateService(
            notificationTitle: 'Envoi SMS en cours',
            notificationText: failed > 0
                ? '\u26a0\ufe0f ${_progressBar(attempted, batchTotal)} $attempted/$batchTotal \u2022 err $failed \u2022 reste $remain'
                : '\u2705 ${_progressBar(attempted, batchTotal)} $attempted/$batchTotal \u2022 reste $remain',
            notificationButtons: _activeButtons(),
          );
        }

        await Future.delayed(Duration(milliseconds: AppConfig.smsDelayMs));
      }

      // Check if we broke out because user pressed Pause
      final pausedAfterLoop = await _isPaused();

      if (hasCampaignTotals) {
        final s = sentNow();
        final remain = max(totalSum - s, 0);
        final isDone = remain == 0 && !pausedAfterLoop;
        if (isDone) {
          _activeCampaignId = null;
          await BackgroundSyncService.setActiveCampaignId(null);
        }
        final errShort = (lastErr ?? '').replaceAll('\n', ' ');
        final errMsg = errShort.isEmpty ? '' : ' \u2022 err: ${errShort.substring(0, errShort.length.clamp(0, 60))}';

        if (pausedAfterLoop) {
          await FlutterForegroundTask.updateService(
            notificationTitle: 'SMS Gateway',
            notificationText: '\u23f8\ufe0f $campaignLabel \u2022 ${_progressBar(s, totalSum)} $s/$totalSum \u2022 En pause',
            notificationButtons: _pausedButtons(),
          );
        } else if (failed > 0) {
          await FlutterForegroundTask.updateService(
            notificationTitle: 'SMS Gateway',
            notificationText: '\u274c $campaignLabel \u2022 erreurs: $failed/$attempted$errMsg',
            notificationButtons: _activeButtons(),
          );
        } else if (isDone) {
          await FlutterForegroundTask.updateService(
            notificationTitle: 'SMS Gateway',
            notificationText: '\u2705 $campaignLabel termin\u00e9e \u2022 $s/$totalSum SMS envoy\u00e9s',
            notificationButtons: _activeButtons(),
          );
        } else {
          await FlutterForegroundTask.updateService(
            notificationTitle: 'SMS Gateway',
            notificationText: '\u23f3 $campaignLabel \u2022 ${_progressBar(s, totalSum)} $s/$totalSum \u2022 reste $remain',
            notificationButtons: _activeButtons(),
          );
        }
      } else {
        if (pausedAfterLoop) {
          await FlutterForegroundTask.updateService(
            notificationTitle: 'SMS Gateway',
            notificationText: '\u23f8\ufe0f Batch $attempted/$batchTotal \u2022 En pause',
            notificationButtons: _pausedButtons(),
          );
        } else {
          await FlutterForegroundTask.updateService(
            notificationTitle: 'SMS Gateway',
            notificationText: failed > 0
                ? '\u274c Erreurs: $failed/$attempted \u2022 Ouvre l\'app pour corriger'
                : '\u2705 Batch trait\u00e9 ($attempted/$batchTotal) \u2022 En attente...',
            notificationButtons: _activeButtons(),
          );
        }
      }
    } catch (e) {
      await FlutterForegroundTask.updateService(
        notificationTitle: 'SMS Gateway',
        notificationText: 'Erreur sync: ${e.toString()}',
        notificationButtons: _activeButtons(),
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
    _http.close();
  }

  Future<void> _handleButton(String id) async {
    final token = await _loadDeviceToken();
    final campaignId = _activeCampaignId ?? await BackgroundSyncService.getActiveCampaignId();

    if (id == 'pause') {
      // Set local paused flag first so _tick sees it immediately
      final prefs = await SharedPreferences.getInstance();
      await prefs.setBool(BackgroundSyncService._pausedKey, true);
      // Update notification with Reprendre button
      await FlutterForegroundTask.updateService(
        notificationTitle: 'SMS Gateway',
        notificationText: '\u23f8\ufe0f En pause',
        notificationButtons: _pausedButtons(),
      );
      // Also pause on server (non-blocking)
      if (campaignId != null && token != null) {
        try {
          await _postJson(
            _proxyUri('/api/mobile/campaign-control'),
            {'action': 'pause', 'campaign_id': campaignId, 'device_token': token},
          );
        } catch (_) {}
      }
      return;
    }

    if (id == 'resume') {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setBool(BackgroundSyncService._pausedKey, false);
      await FlutterForegroundTask.updateService(
        notificationTitle: 'SMS Gateway',
        notificationText: '\u2705 Reprise en cours...',
        notificationButtons: _activeButtons(),
      );
      if (campaignId != null && token != null) {
        try {
          await _postJson(
            _proxyUri('/api/mobile/campaign-control'),
            {'action': 'resume', 'campaign_id': campaignId, 'device_token': token},
          );
        } catch (_) {}
      }
      return;
    }

    if (id == 'stop') {
      // Cancel the active campaign but keep the service running for future campaigns
      if (campaignId != null && token != null) {
        try {
          await _postJson(
            _proxyUri('/api/mobile/campaign-control'),
            {'action': 'cancel', 'campaign_id': campaignId, 'device_token': token},
          );
        } catch (_) {}
      }
      _activeCampaignId = null;
      await BackgroundSyncService.setActiveCampaignId(null);
      final prefs = await SharedPreferences.getInstance();
      await prefs.setBool(BackgroundSyncService._pausedKey, false);
      await FlutterForegroundTask.updateService(
        notificationTitle: 'SMS Gateway',
        notificationText: '\u2705 Campagne annul\u00e9e \u2022 En attente...',
        notificationButtons: _activeButtons(),
      );
      return;
    }
  }
}
