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
import 'package:smsgateway_flutter/services/app_settings.dart';
import 'package:smsgateway_flutter/services/token_storage.dart';
import 'package:smsgateway_flutter/services/sms_sender.dart';
import 'package:smsgateway_flutter/services/pending_message_reports.dart';
import 'package:smsgateway_flutter/utils/sim_resolver.dart';
import 'package:smsgateway_flutter/utils/auto_vary.dart';

class BackgroundSyncService {
  static const int serviceId = 701;
  static bool _initialized = false;
  static Future<void>? _starting;
  static const String _pausedKey = 'bg_sync_paused';
  static const String _enabledKey = 'bg_sync_enabled';
  static const String _fgLockKey = 'bg_sync_fg_lock';
  static const String _fgLockAtKey = 'bg_sync_fg_lock_at';
  static const String _activeCampaignIdKey = 'bg_sync_active_campaign_id';
  static const Duration _fgLockMaxAge = Duration(minutes: 2);

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
    await prefs.reload();
    final v = prefs.getString(_activeCampaignIdKey);
    return (v == null || v.trim().isEmpty) ? null : v.trim();
  }

  static Future<void> init() async {
    if (_initialized) return;
    _initialized = true;
    FlutterForegroundTask.initCommunicationPort();

      FlutterForegroundTask.init(
      androidNotificationOptions: AndroidNotificationOptions(
        channelId: 'sms_gateway_active_v4',
        channelName: 'SMSenvoie - Envoi actif',
        channelDescription: 'Affiche la progression et les controles d\'envoi SMS.',
        channelImportance: NotificationChannelImportance.HIGH,
        priority: NotificationPriority.HIGH,
        showWhen: false,
        onlyAlertOnce: true,
      ),
      iosNotificationOptions: IOSNotificationOptions(
        showNotification: false,
        playSound: false,
      ),
      foregroundTaskOptions: ForegroundTaskOptions(
        eventAction: ForegroundTaskEventAction.repeat(2000),
        autoRunOnBoot: true,
        autoRunOnMyPackageReplaced: true,
        allowWakeLock: true,
        allowWifiLock: true,
        allowAutoRestart: true,
        stopWithTask: false,
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
    await prefs.reload();
    final explicit = prefs.getBool(_enabledKey);
    if (explicit != null) return explicit;
    final token = prefs.getString(TokenStorage.legacyKey)?.trim();
    final owner = prefs.getString(TokenStorage.ownerKey)?.trim();
    return token != null && token.isNotEmpty && owner != null && owner.isNotEmpty;
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
    // Only update notification when PAUSING.
    // When un-pausing, _tick() will update the notification with real status on next cycle.
    if (paused && await FlutterForegroundTask.isRunningService) {
      await FlutterForegroundTask.updateService(
        notificationTitle: 'SMSenvoie',
        notificationText: '\u23f8\ufe0f En pause',
        notificationButtons: const [
          NotificationButton(id: 'resume', text: 'Reprendre'),
          NotificationButton(id: 'stop', text: 'Annuler campagne'),
        ],
      );
    }
  }

  static Future<void> setForegroundLock(bool locked) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(_fgLockKey, locked);
    if (locked) {
      await prefs.setInt(_fgLockAtKey, DateTime.now().millisecondsSinceEpoch);
    } else {
      await prefs.remove(_fgLockAtKey);
    }
  }

  /// True when the foreground UI is doing a manual sync. Expires automatically
  /// if the app is killed mid-sync so background sending is never blocked forever.
  static Future<bool> isForegroundLocked() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.reload();
    if (!(prefs.getBool(_fgLockKey) ?? false)) return false;

    final lockedAt = prefs.getInt(_fgLockAtKey);
    if (lockedAt == null) {
      await setForegroundLock(false);
      return false;
    }

    final age = DateTime.now().millisecondsSinceEpoch - lockedAt;
    if (age > _fgLockMaxAge.inMilliseconds) {
      await prefs.setBool(_fgLockKey, false);
      await prefs.remove(_fgLockAtKey);
      return false;
    }
    return true;
  }

  /// Release foreground lock and nudge the background worker (app going to background).
  static Future<void> handoffToBackground() async {
    await setForegroundLock(false);
    await ensureAutoSync();
  }

  /// Keep the foreground service claiming/sending without any manual sync.
  /// Safe to call frequently (no-op if the service is already running).
  static Future<void> ensureAutoSync() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.reload();
    final token = prefs.getString(TokenStorage.legacyKey)?.trim();
    final owner = prefs.getString(TokenStorage.ownerKey)?.trim();
    if (token == null || token.isEmpty || owner == null || owner.isEmpty) return;

    if (!await isEnabled()) return;
    // NOTE: ne PAS effacer le verrou foreground ici. Cette methode est appelee
    // toutes les 10 s par l'UI; effacer le verrou pendant une sync manuelle
    // provoquait des envois concurrents foreground + background.
    await init();
    await ensureRunning();
    try {
      if (await FlutterForegroundTask.isRunningService) {
        FlutterForegroundTask.sendDataToTask('kick');
      }
    } catch (_) {}
  }

  /// Start the foreground service only if it is not already running.
  static Future<void> ensureRunning() async {
    if (await FlutterForegroundTask.isRunningService) return;
    await start();
  }

  static Future<void> start() async {
    await (_starting ??= _start().whenComplete(() => _starting = null));
  }

  static Future<void> _start() async {
    await init();
    if (!await isEnabled()) return;
    if (await FlutterForegroundTask.isRunningService) return;

    final result = await FlutterForegroundTask.startService(
      serviceId: serviceId,
      serviceTypes: const [ForegroundServiceTypes.remoteMessaging],
      notificationTitle: 'SMSenvoie',
      notificationText: '\u2705 Actif (en attente)',
      notificationButtons: const [
        NotificationButton(id: 'pause', text: 'Pause'),
        NotificationButton(id: 'stop', text: 'Annuler campagne'),
      ],
      callback: startCallback,
    );
    if (result is ServiceRequestFailure) throw result.error;
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
  int _tickCount = 0;
  bool _updateAvailable = false;
  Timer? _watchdog;
  Timer? _heartbeatTimer;
  bool _heartbeatBusy = false;
  bool _destroyed = false;
  int _networkFailures = 0;
  DateTime? _retryAfter;
  int _controlRevision = 0;
  int _sendingRevision = 0;
  String? _serverCampaignId;
  String? _serverCampaignStatus;

  Future<bool> _canSend(String token) async => !_destroyed &&
      _sendingRevision == _controlRevision &&
      await BackgroundSyncService.isEnabled() &&
      !await _isPaused() && await _loadDeviceToken() == token;

  Future<bool> _canSendMessage(String token) async => await _canSend(token) &&
      (_activeCampaignId == null || _serverCampaignId != _activeCampaignId ||
       _serverCampaignStatus == 'running' || _serverCampaignStatus == 'queued');

  Future<void> _heartbeat() async {
    if (_heartbeatBusy || _destroyed) return;
    _heartbeatBusy = true;
    try {
      final token = await _loadDeviceToken();
      if (token == null || !await BackgroundSyncService.isEnabled()) return;
      final prefs = await SharedPreferences.getInstance();
      await _postJson(_proxyUri('/api/mobile/heartbeat'), {
        'device_token': token, 'app_version': prefs.getString('app_current_version'),
      });
    } catch (_) {
      // A network error is not a revocation of the device token.
    } finally { _heartbeatBusy = false; }
  }

  Uri _proxyUri(String path) => Uri.parse('${AppConfig.webApiBaseUrl}$path');

  Future<String?> _loadDeviceToken() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.reload();
    final owner = prefs.getString(TokenStorage.ownerKey)?.trim();
    if (owner == null || owner.isEmpty) return null;
    final v = prefs.getString(TokenStorage.legacyKey);
    if (v == null) return null;
    return v.trim().isEmpty ? null : v.trim();
  }

  Future<String?> _loadOwnerUserId() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.reload();
    final owner = prefs.getString(TokenStorage.ownerKey)?.trim();
    return owner == null || owner.isEmpty ? null : owner;
  }

  /// Recharge la cadence depuis le profil web avec le couple sécurisé
  /// jeton-appareil/compte. Si le réseau est indisponible, les dernières
  /// valeurs locales restent actives.
  Future<SmsPacingSettings> _refreshPacingFromDashboard(String deviceToken) async {
    try {
      final ownerUserId = await _loadOwnerUserId();
      if (ownerUserId == null) return AppSettings.getSmsPacingSettings();

      final response = await _http
          .post(
            _proxyUri('/api/mobile/runtime-settings'),
            headers: const {'Content-Type': 'application/json'},
            body: jsonEncode({
              'device_token': deviceToken,
              'owner_user_id': ownerUserId,
              'campaign_id': _activeCampaignId,
            }),
          )
          .timeout(const Duration(seconds: 4));
      if (response.statusCode >= 200 && response.statusCode < 300) {
        final decoded = jsonDecode(response.body.isEmpty ? '{}' : response.body);
        if (decoded is Map && decoded['campaign'] is Map) {
          _serverCampaignId = decoded['campaign']['id']?.toString();
          _serverCampaignStatus = decoded['campaign']['status']?.toString();
        }
        if (decoded is Map && decoded['settings'] is Map) {
          await AppSettings.applyRemoteSettings(
            Map<String, dynamic>.from(decoded['settings'] as Map),
          );
        }
      }
    } catch (_) {}
    return AppSettings.getSmsPacingSettings();
  }

  Future<bool> _isPaused() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.reload();
    return prefs.getBool(BackgroundSyncService._pausedKey) ?? false;
  }

  Future<bool> _isForegroundLocked() async {
    return BackgroundSyncService.isForegroundLocked();
  }

  Future<List<SimCard>> _getSimCards() async {
    try {
      final raw = await _channel.invokeMethod('getSimCards');
      final list = (raw as List? ?? const []).whereType<Map>().map((e) {
        return SimCard.fromJson(Map<String, dynamic>.from(e));
      }).toList();
      return list;
    } catch (_) {
      return const [];
    }
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

  Future<Map<String, dynamic>?> _updateStatus(String deviceToken, Message msg, bool success, String? error) async {
    const maxAttempts = 3;
    for (var attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await PendingMessageReports.submit(
          deviceToken: deviceToken,
          body: {
            'device_token': deviceToken,
            'message_id': msg.id,
            'status': success ? 'sent' : 'failed',
            'error': error,
          },
          post: (body) => _postJson(_proxyUri('/api/mobile/update-message-status'), body),
        );
      } catch (_) {
        if (attempt >= maxAttempts) return null;
        await Future.delayed(Duration(milliseconds: 350 * attempt));
      }
    }
    return null;
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
    // Un eventuel verrou foreground obsolete expire tout seul (2 min), inutile
    // de l'effacer ici: le service peut demarrer PENDANT une sync manuelle.
    _activeCampaignId = await BackgroundSyncService.getActiveCampaignId();
    await FlutterForegroundTask.updateService(
      notificationTitle: 'SMSenvoie',
      notificationText: '\u2705 Actif \u2022 ${_hhmmss()} \u2022 En attente...',
      notificationButtons: _activeButtons(),
    );
    _heartbeatTimer = Timer.periodic(const Duration(minutes: 1), (_) => unawaited(_heartbeat()));
    unawaited(_heartbeat());
    _watchdog?.cancel();
    _watchdog = Timer.periodic(const Duration(seconds: 2), (_) {
      if (!_busy) {
        unawaited(_tick());
      }
    });
    unawaited(_tick());
  }

  @override
  void onRepeatEvent(DateTime timestamp) {
    unawaited(_tick());
  }

  @override
  void onReceiveData(Object data) {
    if (data == 'kick') {
      unawaited(_tick());
    }
  }

  Future<void> _checkUpdateInBackground() async {
    try {
      final res = await _http.get(
        Uri.parse(AppConfig.appUpdateManifestUrl),
        headers: const {'Accept': 'application/json'},
      ).timeout(const Duration(seconds: 8));
      if (res.statusCode >= 400) return;
      final json = jsonDecode(res.body) as Map<String, dynamic>;
      final latest = (json['latestVersion'] as String?)?.trim() ?? '';
      if (latest.isEmpty) return;
      final prefs = await SharedPreferences.getInstance();
      final current = prefs.getString('app_current_version') ?? '';
      if (current.isNotEmpty && latest != current && latest.compareTo(current) > 0) {
        _updateAvailable = true;
      }
    } catch (_) {}
  }

  Future<void> _tick() async {
    if (_busy || _destroyed) return;
    if (_retryAfter != null && DateTime.now().isBefore(_retryAfter!)) return;
    _busy = true;
    _sendingRevision = _controlRevision;
    _tickCount++;

    // Check for app updates every ~100 ticks (~5 min)
    if (_tickCount % 100 == 1) {
      unawaited(_checkUpdateInBackground());
    }

    try {
      if (!await BackgroundSyncService.isEnabled()) {
        await FlutterForegroundTask.stopService();
        return;
      }
      // Sync manuelle en cours dans l'UI ? On lui laisse la main pour eviter
      // deux boucles d'envoi simultanees. Le verrou expire automatiquement
      // apres 2 min si l'app est tuee en pleine sync (jamais bloque a vie).
      if (await _isForegroundLocked()) {
        return;
      }

      final paused = await _isPaused();
      if (paused) {
        await FlutterForegroundTask.updateService(
          notificationTitle: 'SMSenvoie',
          notificationText: '\u23f8\ufe0f En pause',
          notificationButtons: _pausedButtons(),
        );
        return;
      }

      final token = await _loadDeviceToken();
      if (token == null) {
        await FlutterForegroundTask.updateService(
          notificationTitle: 'SMSenvoie',
          notificationText: '\u26a0\ufe0f Aucun appareil jumel\u00e9',
          notificationButtons: _activeButtons(),
        );
        return;
      }

      // Appareil jumelé → envoi auto actif (sauf si l'utilisateur a désactivé le service).
      await PendingMessageReports.flush(
        deviceToken: token,
        post: (body) => _postJson(_proxyUri('/api/mobile/update-message-status'), body),
        onReport: (report) {
          if (report['campaign'] is Map) FlutterForegroundTask.sendDataToMain({
            'type': 'campaign_progress', 'device_token': token,
            'campaign': report['campaign'],
          });
        },
      );
      try {
        final prefs = await SharedPreferences.getInstance();
        await prefs.reload();
        if (prefs.getBool(BackgroundSyncService._enabledKey) == null) {
          await prefs.setBool(BackgroundSyncService._enabledKey, true);
        }
      } catch (_) {}

      try {
        final smsOk = await Permission.sms.isGranted;
        final phoneOk = await Permission.phone.isGranted;
        if (!smsOk || !phoneOk) {
          FlutterForegroundTask.sendDataToMain({
            'type': 'sender_issue', 'device_token': token,
            'message': 'Envoi bloqué : autorisez SMS et Téléphone dans les paramètres Android.',
          });
          await FlutterForegroundTask.updateService(
            notificationTitle: 'SMSenvoie',
            notificationText: '\u26a0\ufe0f Permissions manquantes. Ouvre l\'app et autorise SMS/T\u00e9l\u00e9phone.',
            notificationButtons: _activeButtons(),
          );
          return;
        }
        final batteryOk = await Permission.ignoreBatteryOptimizations.isGranted;
        if (!batteryOk && _tickCount % 20 == 1) {
          await FlutterForegroundTask.updateService(
            notificationTitle: 'SMSenvoie',
            notificationText:
                '\u26a0\ufe0f Autorisez l\'arri\u00e8re-plan (batterie) pour continuer en veille',
            notificationButtons: _activeButtons(),
          );
        }
      } catch (_) {}

      var batchesProcessed = 0;
      const maxBatchesPerCycle = 200;
      var shouldChainImmediately = false;
      // Pause anti-spam PAR LOT : compteur de SMS envoyés depuis la dernière
      // pause, persistant à travers les lots réclamés dans ce tick. Le seuil
      // est LUI-MÊME aléatoire (±30 % autour du réglage, re-tiré après chaque
      // pause) : une pause exactement toutes les N SMS serait une périodicité
      // détectable de plus.
      var sentSinceBatchPause = 0;
      int? nextBatchPauseAt;
      var consecutiveSendFailures = 0;
      var networkRejectionCount = 0;
      var pacing = await AppSettings.getSmsPacingSettings();
      var thresholdBatchCount = pacing.batchPauseCount;

      while (batchesProcessed < maxBatchesPerCycle) {
        if (!await _canSend(token)) break;

        final payload = await _claimPayload(token);
        _networkFailures = 0;
        _retryAfter = null;
        final rawList = (payload['messages'] as List?) ?? const [];
        final messages =
            rawList.whereType<Map>().map((e) => Message.fromJson(Map<String, dynamic>.from(e))).toList();
        final campaigns = _campaignsFromPayload(payload);
        final remaining = payload['quota_remaining'] is int ? payload['quota_remaining'] as int : null;
        final quotaReached =
            payload['quota_reached'] == true || (remaining != null && remaining <= 0);
        final plan = payload['plan'];
        final planQuota = plan is Map && plan['sms_quota_month'] is int ? plan['sms_quota_month'] as int : null;

        if (messages.isEmpty) {
          if (batchesProcessed == 0) {
            if (quotaReached && (planQuota ?? 0) > 0) {
              await FlutterForegroundTask.updateService(
                notificationTitle: 'SMSenvoie',
                notificationText: '\ud83d\udeab Quota atteint (0 SMS restant ce mois)',
                notificationButtons: _activeButtons(),
              );
            } else {
              final debugInfo = quotaReached ? 'quota=$remaining' : 'pas de campagne';
              final updateHint = _updateAvailable ? ' \u2022 MAJ dispo!' : '';
              await FlutterForegroundTask.updateService(
                notificationTitle: 'SMSenvoie',
                notificationText:
                    '\u2705 Actif \u2022 ${_hhmmss()} \u2022 Aucun msg ($debugInfo)$updateHint',
                notificationButtons: _activeButtons(),
              );
            }
          }
          break;
        }

        batchesProcessed++;

        final sims = await _getSimCards();
        // Slot SIM par campagne (fallback si le message n'a pas de consigne SIM)
        final simSlotsByCampaign = campaignSimSlots(payload);
        int? slotFallbackFor(Message m) =>
            m.campaignId == null ? null : simSlotsByCampaign[m.campaignId];
        final requiresSimRouting = messages.any((m) =>
            resolveSimRouting(m, sims, campaignSlotFallback: slotFallbackFor(m))
                .requiresSpecificSim);
        if (requiresSimRouting && sims.isEmpty) {
          await FlutterForegroundTask.updateService(
            notificationTitle: 'SMSenvoie',
            notificationText:
                '\u26a0\ufe0f Lecture SIM impossible \u2192 tentative via slot demand\u00e9',
            notificationButtons: _activeButtons(),
          );
        }
      final batchTotal = messages.length;
      var attempted = 0;
      var failed = 0;
      var sentInBatch = 0;
      String? lastErr;
      // Source de vérité : /dashboard/profile. Ce premier chargement est
      // complété par un rafraîchissement toutes les 2 secondes pendant les
      // attentes, y compris lorsque l'application est fermée.
      final refreshedPacing = await _refreshPacingFromDashboard(token);
      if (thresholdBatchCount != refreshedPacing.batchPauseCount) {
        thresholdBatchCount = refreshedPacing.batchPauseCount;
        nextBatchPauseAt = AppSettings.pickBatchThreshold(thresholdBatchCount);
      }
      pacing = refreshedPacing;
      // Variation automatique du texte (anti-signature opérateur).
      final autoVaryEnabled = await AppSettings.getAutoVaryEnabled();

      // Show the same campaign as the app, including when one claim contains
      // messages from several campaigns. Never mix their denominators.
      String? displayedCampaignId;
      String campaignLabel = 'Campagne';
      int totalSum = 0;
      bool hasCampaignTotals = false;
      int sentNow() => displayedCampaignId == null ? 0
          : _asInt(campaigns[displayedCampaignId]?['sent_count']);
      void acceptReport(Message msg, Map<String, dynamic>? report, bool sent) {
        final cid = msg.campaignId;
        final snapshot = report?['campaign'];
        if (snapshot is Map && cid != null) {
          campaigns[cid] = Map<String, dynamic>.from(snapshot);
          totalSum = _asInt(campaigns[displayedCampaignId]?['total_count']);
          hasCampaignTotals = totalSum > 0;
        } else if (sent && cid != null && campaigns.containsKey(cid)) {
          // Compatibility with servers not yet returning a campaign snapshot.
          campaigns[cid]!['sent_count'] = _asInt(campaigns[cid]!['sent_count']) + 1;
        }
        if (cid != null && campaigns.containsKey(cid)) {
          FlutterForegroundTask.sendDataToMain({
            'type': 'campaign_progress',
            'device_token': token,
            'campaign': campaigns[cid],
          });
        }
      }

      for (final msg in messages) {
        // Cadence turbo mesurée d'envoi à envoi : ce chronomètre couvre tout le
        // coût du message (envoi natif, rapport de statut, notifications) pour
        // que la seconde déjà consommée ne soit pas payée une deuxième fois
        // dans l'attente qui suit. Un Stopwatch n'a rien à libérer : le `break`
        // de la pause et le `return` du rapport en échec ne fuient pas.
        final messageStopwatch = Stopwatch()..start();
        if (!await _canSend(token)) break;
        displayedCampaignId = msg.campaignId;
        final currentCampaign = campaigns[displayedCampaignId];
        campaignLabel = currentCampaign?['name']?.toString() ?? 'Campagne';
        totalSum = _asInt(currentCampaign?['total_count']);
        hasCampaignTotals = totalSum > 0;
        if (displayedCampaignId != _activeCampaignId) {
          _activeCampaignId = displayedCampaignId;
          await BackgroundSyncService.setActiveCampaignId(displayedCampaignId);
          pacing = await _refreshPacingFromDashboard(token);
        }
        if (!await _canSendMessage(token)) break;

        // Compromis turbo : la notification AVANT l'envoi est supprimée.
        // Chaque updateService est un aller-retour natif attendu qui grignote
        // le budget d'une seconde, et Android limite de toute façon la
        // fréquence des notifications à ce rythme. Celle qui suit le rapport
        // de statut est conservée : le compteur avance donc toujours après
        // chaque SMS, pour moitié moins de notifications postées.
        if (!pacing.turboEnabled) {
          if (hasCampaignTotals) {
            final s = sentNow();
            final remain = max(totalSum - s, 0);
            await FlutterForegroundTask.updateService(
              notificationTitle: 'SMSenvoie',
              notificationText: '\ud83d\udce4 $campaignLabel \u2022 ${_progressBar(s, totalSum)} $s/$totalSum \u2022 reste $remain',
              notificationButtons: _activeButtons(),
            );
          } else {
            final remain = batchTotal - sentInBatch;
            await FlutterForegroundTask.updateService(
              notificationTitle: 'Envoi SMS en cours',
              notificationText: '\ud83d\udce4 Lot en cours \u2022 ${_progressBar(sentInBatch, batchTotal)} $sentInBatch/$batchTotal envoyés \u2022 reste $remain',
              notificationButtons: _activeButtons(),
            );
          }
        }

        bool sentSuccessfully = false;
        String? sendError;
        try {
          final routing = resolveSimRouting(
            msg,
            sims,
            campaignSlotFallback: slotFallbackFor(msg),
          );
          final nativeResult = await _channel.invokeMethod('sendSms', {
            'to': msg.to,
            'body': AutoVary.apply(msg.content, enabled: autoVaryEnabled, rng: _rng),
            'subscriptionId': routing.subscriptionId,
            'simSlotIndex': routing.simSlotIndex,
          });
          if (nativeResult != true) {
            throw PlatformException(code: 'SMS_SEND_FAILED', message: 'Envoi non confirmé');
          }
          sentSuccessfully = true;
          sentInBatch++;
          consecutiveSendFailures = 0;
        } on PlatformException catch (e) {
          // Le code natif renvoie un code stable (SMS_PERMISSION, SMS_TIMEOUT,
          // SMS_SEND_FAILED, etc.) et un message lisible. On formatte pour que
          // l'erreur stockee en BD soit utile au debug.
          final msg2 = (e.message ?? '').trim();
          final formatted = msg2.isEmpty ? e.code : '[${e.code}] $msg2';
          sendError = formatted;
          failed++;
          lastErr = formatted;
          consecutiveSendFailures++;
          if (e.code == 'SMS_NETWORK_REJECTED') {
            networkRejectionCount++;
          }
        } catch (e) {
          sendError = e.toString();
          failed++;
          lastErr = e.toString();
          consecutiveSendFailures++;
        }

        // Reporting errors must never turn a confirmed send into a failure.
        final report = await _updateStatus(token, msg, sentSuccessfully, sendError);
        if (report == null) {
          await FlutterForegroundTask.updateService(
            notificationTitle: 'SMSenvoie',
            notificationText: 'Résultat SMS sauvegardé • synchronisation du compteur en attente',
            notificationButtons: _activeButtons(),
          );
          return; // Next tick retries the saved report before any new claim.
        }
        acceptReport(msg, report, sentSuccessfully);
        attempted++;

        if (hasCampaignTotals) {
          final s = sentNow();
          final remain = max(totalSum - s, 0);
          await FlutterForegroundTask.updateService(
            notificationTitle: 'SMSenvoie',
            notificationText: failed > 0
                ? '\u26a0\ufe0f $campaignLabel \u2022 ${_progressBar(s, totalSum)} $s/$totalSum \u2022 err $failed \u2022 reste $remain'
                : '\u2705 $campaignLabel \u2022 ${_progressBar(s, totalSum)} $s/$totalSum \u2022 reste $remain',
            notificationButtons: _activeButtons(),
          );
        } else {
          final remain = batchTotal - sentInBatch;
          await FlutterForegroundTask.updateService(
            notificationTitle: 'Envoi SMS en cours',
            notificationText: failed > 0
                ? '\u26a0\ufe0f Lot ${_progressBar(sentInBatch, batchTotal)} $sentInBatch/$batchTotal envoyés \u2022 err $failed \u2022 reste $remain'
                : '\u2705 Lot ${_progressBar(sentInBatch, batchTotal)} $sentInBatch/$batchTotal envoyés \u2022 reste $remain',
            notificationButtons: _activeButtons(),
          );
        }

        // Apply the user-configured delay between SMS, with a live countdown
        // in the notification so the user sees that the app is *working*
        // (not frozen). We skip the wait on the very last message of the
        // batch, there is nothing to wait for after it. Délai TIRÉ AU HASARD
        // pour ce message (borne [min, max]) afin de ne pas envoyer à cadence
        // régulière (anti-blocage opérateur).
        final isLastInBatch = attempted >= batchTotal;
        // Compte TOUS les SMS envoyés : les lots réclamés s'enchaînent, le
        // dernier d'un lot est souvent suivi immédiatement du lot suivant.
        sentSinceBatchPause++;
        // Pause anti-spam PAR LOT : au-dela d'un certain nombre de SMS envoyes
        // d'affilee, on marque une pause plus longue et ALEATOIRE (au lieu du
        // simple delai par SMS). Le seuil est re-tire au hasard apres chaque
        // pause (±30 % autour du reglage) pour casser aussi la periodicite de
        // la pause elle-meme.
        if (thresholdBatchCount != pacing.batchPauseCount) {
          thresholdBatchCount = pacing.batchPauseCount;
          nextBatchPauseAt = AppSettings.pickBatchThreshold(thresholdBatchCount);
        }
        nextBatchPauseAt ??= AppSettings.pickBatchThreshold(pacing.batchPauseCount);
        final useBatchPause =
            // Le mode turbo supprime entierement la pause par lot : cadence
            // plate d'1 s entre chaque SMS, aucune pause longue intercalee.
            !pacing.turboEnabled &&
            pacing.batchPauseEnabled &&
            sentSinceBatchPause >= nextBatchPauseAt;
        if (useBatchPause) {
          sentSinceBatchPause = 0;
          nextBatchPauseAt = AppSettings.pickBatchThreshold(pacing.batchPauseCount);
        }
        if (sentSuccessfully || !isLastInBatch) {
          final previousBatchCount = pacing.batchPauseCount;
          final waitResult = await AppSettings.waitWithLiveRefresh(
            initialSettings: pacing,
            useBatchPause: useBatchPause,
            consecutiveFailures: consecutiveSendFailures,
            refreshSettings: () => _refreshPacingFromDashboard(token),
            shouldInterrupt: () async => !await _canSendMessage(token),
            onTick: (remainMs, isBatchPause) async {
              // En turbo le reste est d'une seconde au maximum : un compte a
              // rebours bloque sur "1s" n'apporte rien et coute un aller-retour
              // natif supplementaire pris sur le budget du message.
              if (pacing.turboEnabled && !isBatchPause) return;
              if (isBatchPause) {
              final secsLeft = ((remainMs + 999) / 1000).floor();
              await FlutterForegroundTask.updateService(
                notificationTitle: 'SMSenvoie',
                notificationText: '⏸️ $campaignLabel • ${hasCampaignTotals ? sentNow() : sentInBatch}/${hasCampaignTotals ? totalSum : batchTotal} envoyés • reprise dans ${secsLeft}s',
                notificationButtons: _activeButtons(),
              );
                return;
              }
              if (remainMs >= 1000) {
              final s = hasCampaignTotals ? sentNow() : 0;
              final total = hasCampaignTotals ? totalSum : batchTotal;
              final progressed = hasCampaignTotals ? s : sentInBatch;
              final remainText = hasCampaignTotals
                  ? max(totalSum - s, 0).toString()
                  : (batchTotal - sentInBatch).toString();
              final secsLeft = ((remainMs + 999) / 1000).floor();
              await FlutterForegroundTask.updateService(
                notificationTitle: 'SMSenvoie',
                notificationText:
                    '\u23f3 $campaignLabel \u2022 ${_progressBar(progressed, total)} '
                    '$progressed/$total \u2022 prochain dans ${secsLeft}s \u2022 reste $remainText',
                notificationButtons: _activeButtons(),
              );
              }
            },
            alreadyElapsedMs: messageStopwatch.elapsedMilliseconds,
          );
          pacing = waitResult.settings;
          if (previousBatchCount != pacing.batchPauseCount) {
            thresholdBatchCount = pacing.batchPauseCount;
            nextBatchPauseAt = AppSettings.pickBatchThreshold(thresholdBatchCount);
          }
        }
      }

      // Check if we broke out because user pressed Pause
      final pausedAfterLoop = await _isPaused();
      final rejectionReport = networkRejectionCount > 0
          ? ' • rejets opérateur: $networkRejectionCount'
          : '';

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
            notificationTitle: 'SMSenvoie',
            notificationText: '\u23f8\ufe0f $campaignLabel \u2022 ${_progressBar(s, totalSum)} $s/$totalSum \u2022 En pause',
            notificationButtons: _pausedButtons(),
          );
        } else if (failed > 0) {
          await FlutterForegroundTask.updateService(
            notificationTitle: 'SMSenvoie',
            notificationText: '\u274c $campaignLabel \u2022 erreurs: $failed/$attempted$rejectionReport$errMsg',
            notificationButtons: _activeButtons(),
          );
        } else if (isDone) {
          await FlutterForegroundTask.updateService(
            notificationTitle: 'SMSenvoie',
            notificationText: '\u2705 $campaignLabel termin\u00e9e \u2022 $s/$totalSum SMS envoy\u00e9s',
            notificationButtons: _activeButtons(),
          );
        } else {
          await FlutterForegroundTask.updateService(
            notificationTitle: 'SMSenvoie',
            notificationText: '\u23f3 $campaignLabel \u2022 ${_progressBar(s, totalSum)} $s/$totalSum \u2022 reste $remain',
            notificationButtons: _activeButtons(),
          );
        }
      } else {
        if (pausedAfterLoop) {
          await FlutterForegroundTask.updateService(
            notificationTitle: 'SMSenvoie',
            notificationText: '\u23f8\ufe0f Batch $attempted/$batchTotal \u2022 En pause',
            notificationButtons: _pausedButtons(),
          );
        } else {
          await FlutterForegroundTask.updateService(
            notificationTitle: 'SMSenvoie',
            notificationText: failed > 0
                ? '\u274c Erreurs: $failed/$attempted$rejectionReport \u2022 envoi maintenu'
                : '\u2705 Batch trait\u00e9 ($attempted/$batchTotal) \u2022 En attente...',
            notificationButtons: _activeButtons(),
          );
        }
      }

        if (pausedAfterLoop) break;
        if (failed > 0) break;

        // Lot complet → enchaîner immédiatement le lot suivant (sans attendre 3 s).
        if (messages.length >= AppConfig.claimBatchSize) {
          continue;
        }
        break;
      }

      if (batchesProcessed >= maxBatchesPerCycle) {
        shouldChainImmediately = true;
      }

      if (shouldChainImmediately) {
        _busy = false;
        unawaited(Future.microtask(_tick));
        return;
      }

      if (batchesProcessed > 0) {
        try {
          FlutterForegroundTask.sendDataToTask('kick');
        } catch (_) {}
      }
    } catch (e) {
      _networkFailures++;
      final delay = min(60, 2 * (1 << min(_networkFailures, 5)));
      _retryAfter = DateTime.now().add(Duration(seconds: delay));
      try {
        FlutterForegroundTask.sendDataToMain({
          'type': 'sender_issue', 'device_token': await _loadDeviceToken(),
          'message': 'Envoi bloqué : $e. Nouvelle tentative dans ${delay}s.',
        });
      } catch (_) {}
      await FlutterForegroundTask.updateService(
        notificationTitle: 'SMSenvoie',
        notificationText: 'Synchronisation indisponible • nouvelle tentative dans ${delay}s',
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
    _destroyed = true;
    _heartbeatTimer?.cancel();
    _watchdog?.cancel();
    _http.close();
  }

  Future<void> _handleButton(String id) async {
    _controlRevision++;
    final token = await _loadDeviceToken();
    final campaignId = _activeCampaignId ?? await BackgroundSyncService.getActiveCampaignId();

    if (id == 'pause') {
      // Set local paused flag first so _tick sees it immediately
      final prefs = await SharedPreferences.getInstance();
      await prefs.setBool(BackgroundSyncService._pausedKey, true);
      // Update notification with Reprendre button
      await FlutterForegroundTask.updateService(
        notificationTitle: 'SMSenvoie',
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
        notificationTitle: 'SMSenvoie',
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
      await BackgroundSyncService.setPaused(true);
      // Cancel the active campaign but keep the service running for future campaigns
      if (campaignId != null && token != null) {
        try {
          await _postJson(
            _proxyUri('/api/mobile/campaign-control'),
            {'action': 'cancel', 'campaign_id': campaignId, 'device_token': token},
          );
        } catch (_) {
          return; // Keep paused if the server could not confirm cancellation.
        }
      }
      _activeCampaignId = null;
      await BackgroundSyncService.setActiveCampaignId(null);
      final prefs = await SharedPreferences.getInstance();
      await prefs.setBool(BackgroundSyncService._pausedKey, false);
      await FlutterForegroundTask.updateService(
        notificationTitle: 'SMSenvoie',
        notificationText: '\u2705 Campagne annul\u00e9e \u2022 En attente...',
        notificationButtons: _activeButtons(),
      );
      return;
    }
  }
}
