import 'dart:io';
import 'dart:ui';
import 'dart:convert';
import 'dart:async';

import 'package:file_picker/file_picker.dart';
import 'package:excel/excel.dart' as xl;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:app_links/app_links.dart';
import 'package:logger/logger.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import 'package:package_info_plus/package_info_plus.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:smsgateway_flutter/config.dart';
import 'package:smsgateway_flutter/models/inbox_message.dart';
import 'package:smsgateway_flutter/models/message.dart';
import 'package:smsgateway_flutter/models/outbox_message.dart';
import 'package:smsgateway_flutter/services/device_service.dart';
import 'package:smsgateway_flutter/services/app_update_service.dart';
import 'package:smsgateway_flutter/services/sms_sender.dart';
import 'package:smsgateway_flutter/services/auth_session_storage.dart';
import 'package:smsgateway_flutter/services/token_storage.dart';
import 'package:smsgateway_flutter/services/background_sync_service.dart';
import 'package:smsgateway_flutter/services/app_settings.dart';
import 'package:supabase/supabase.dart';
import 'package:flutter_foreground_task/flutter_foreground_task.dart';

/// Providers (dépendances partagées)
final loggerProvider = Provider<Logger>((_) => Logger());

final supabaseClientProvider = Provider<SupabaseClient>(
  (ref) => SupabaseClient(
  AppConfig.supabaseUrl,
  AppConfig.supabaseAnonKey,
  ),
);

final tokenStorageProvider = Provider<TokenStorage>((_) => TokenStorage());

final authSessionStorageProvider =
    Provider<AuthSessionStorage>((_) => AuthSessionStorage());

final deviceServiceProvider = Provider<DeviceService>(
  (ref) => DeviceService(
    ref.watch(supabaseClientProvider),
    ref.watch(loggerProvider),
  ),
);

final smsSenderProvider = Provider<SmsSender>(
  (ref) => SmsSender(ref.watch(loggerProvider)),
);

final appUpdateServiceProvider = Provider<AppUpdateService>((_) => AppUpdateService());

/// Etat applicatif
class AppState {
  const AppState({
    required this.loading,
    required this.syncing,
    required this.deviceToken,
    required this.lastStatus,
    required this.lastMessages,
    required this.authenticated,
    required this.availableSims,
    required this.userEmail,
    required this.orgId,
    required this.orgName,
    required this.memberSince,
    required this.appVersion,
    required this.inboxMessages,
    required this.outboxHistory,
    required this.deviceName,
    required this.lastHeartbeatAt,
    required this.planName,
    required this.planSmsQuotaMonth,
    required this.planMaxDevices,
    required this.subscriptionPeriodEnd,
    required this.smsUsedThisMonth,
    required this.quotaRemaining,
    required this.campaignIdSending,
    required this.campaignNameSending,
    required this.campaignStatusSending,
    required this.campaignSentCount,
    required this.campaignTotalCount,
    required this.updateVersion,
    required this.updateUrl,
    required this.updateNotes,
    required this.permissionsOk,
  });

  factory AppState.initial() => const AppState(
        loading: true,
        syncing: false,
        deviceToken: null,
        lastStatus: null,
        lastMessages: [],
        authenticated: false,
        availableSims: [],
        userEmail: null,
        orgId: null,
        orgName: null,
        memberSince: null,
        appVersion: null,
        inboxMessages: [],
        outboxHistory: [],
        deviceName: null,
        lastHeartbeatAt: null,
        planName: null,
        planSmsQuotaMonth: null,
        planMaxDevices: null,
        subscriptionPeriodEnd: null,
        smsUsedThisMonth: null,
        quotaRemaining: null,
        campaignIdSending: null,
        campaignNameSending: null,
        campaignStatusSending: null,
        campaignSentCount: null,
        campaignTotalCount: null,
        updateVersion: null,
        updateUrl: null,
        updateNotes: null,
        permissionsOk: false,
      );

  final bool loading;
  final bool syncing;
  final String? deviceToken;
  final String? lastStatus;
  final List<Message> lastMessages;
  final bool authenticated;
  final List<SimCard> availableSims;
  final String? userEmail;
  final String? orgId;
  final String? orgName;
  final DateTime? memberSince;
  final String? appVersion;
  final List<InboxMessage> inboxMessages;
  final List<OutboxMessage> outboxHistory;
  final String? deviceName;
  final DateTime? lastHeartbeatAt;
  final String? planName;
  final int? planSmsQuotaMonth;
  final int? planMaxDevices;
  final DateTime? subscriptionPeriodEnd;
  final int? smsUsedThisMonth;
  final int? quotaRemaining;
  final String? campaignIdSending;
  final String? campaignNameSending;
  final String? campaignStatusSending;
  final int? campaignSentCount;
  final int? campaignTotalCount;
  final String? updateVersion;
  final String? updateUrl;
  final String? updateNotes;
  final bool permissionsOk;

  AppState copyWith({
    bool? loading,
    bool? syncing,
    String? deviceToken,
    String? lastStatus,
    List<Message>? lastMessages,
    bool? authenticated,
    List<SimCard>? availableSims,
    String? userEmail,
    String? orgId,
    String? orgName,
    DateTime? memberSince,
    String? appVersion,
    List<InboxMessage>? inboxMessages,
    List<OutboxMessage>? outboxHistory,
    String? deviceName,
    DateTime? lastHeartbeatAt,
    String? planName,
    int? planSmsQuotaMonth,
    int? planMaxDevices,
    DateTime? subscriptionPeriodEnd,
    int? smsUsedThisMonth,
    int? quotaRemaining,
    String? campaignIdSending,
    String? campaignNameSending,
    String? campaignStatusSending,
    int? campaignSentCount,
    int? campaignTotalCount,
    bool clearCampaign = false,
    String? updateVersion,
    String? updateUrl,
    String? updateNotes,
    bool clearUpdate = false,
    bool? permissionsOk,
  }) {
    return AppState(
      loading: loading ?? this.loading,
      syncing: syncing ?? this.syncing,
      deviceToken: deviceToken ?? this.deviceToken,
      lastStatus: lastStatus ?? this.lastStatus,
      lastMessages: lastMessages ?? this.lastMessages,
      authenticated: authenticated ?? this.authenticated,
      availableSims: availableSims ?? this.availableSims,
      userEmail: userEmail ?? this.userEmail,
      orgId: orgId ?? this.orgId,
      orgName: orgName ?? this.orgName,
      memberSince: memberSince ?? this.memberSince,
      appVersion: appVersion ?? this.appVersion,
      inboxMessages: inboxMessages ?? this.inboxMessages,
      outboxHistory: outboxHistory ?? this.outboxHistory,
      deviceName: deviceName ?? this.deviceName,
      lastHeartbeatAt: lastHeartbeatAt ?? this.lastHeartbeatAt,
      planName: planName ?? this.planName,
      planSmsQuotaMonth: planSmsQuotaMonth ?? this.planSmsQuotaMonth,
      planMaxDevices: planMaxDevices ?? this.planMaxDevices,
      subscriptionPeriodEnd: subscriptionPeriodEnd ?? this.subscriptionPeriodEnd,
      smsUsedThisMonth: smsUsedThisMonth ?? this.smsUsedThisMonth,
      quotaRemaining: quotaRemaining ?? this.quotaRemaining,
      campaignIdSending: clearCampaign ? null : (campaignIdSending ?? this.campaignIdSending),
      campaignNameSending: clearCampaign ? null : (campaignNameSending ?? this.campaignNameSending),
      campaignStatusSending: clearCampaign ? null : (campaignStatusSending ?? this.campaignStatusSending),
      campaignSentCount: clearCampaign ? null : (campaignSentCount ?? this.campaignSentCount),
      campaignTotalCount: clearCampaign ? null : (campaignTotalCount ?? this.campaignTotalCount),
      updateVersion: clearUpdate ? null : (updateVersion ?? this.updateVersion),
      updateUrl: clearUpdate ? null : (updateUrl ?? this.updateUrl),
      updateNotes: clearUpdate ? null : (updateNotes ?? this.updateNotes),
      permissionsOk: permissionsOk ?? this.permissionsOk,
    );
  }
}

/// Contrôleur d'état (Riverpod)
final appProvider = NotifierProvider<AppNotifier, AppState>(AppNotifier.new);

/// Sections du dashboard (navigation app)
enum AppSection {
  dashboard,
  campaigns,
  messages,
  history,
  subscription,
  devices,
  profile,
}

final sectionProvider = StateProvider<AppSection>((_) => AppSection.dashboard);

class AppNotifier extends Notifier<AppState> {
  @override
  AppState build() => AppState.initial();

  void setLastStatus(String? message) {
    state = state.copyWith(lastStatus: message);
  }

  Future<void> checkPermissions() async {
    try {
      final sms = await Permission.sms.status;
      final phone = await Permission.phone.status;
      final ok = sms.isGranted && phone.isGranted;
      state = state.copyWith(permissionsOk: ok);
    } catch (_) {
      state = state.copyWith(permissionsOk: false);
    }
  }

  Future<void> init() async {
    String? token = await ref.read(tokenStorageProvider).load();

    // Auto-fix: si le token est un JSON (erreur de pairing précédente)
    if (token != null && token.startsWith('{') && token.endsWith('}')) {
      try {
        final data = jsonDecode(token);
        if (data is Map) {
          // Cas OK: QR appareil -> extraire device_token
          if (data.containsKey('device_token')) {
            token = data['device_token'].toString();
            await ref.read(tokenStorageProvider).save(token);
          } else if (data['type'] == 'session' || data.containsKey('refresh_token')) {
            // Cas erreur: QR session scanné dans la page Pairing
            await ref.read(tokenStorageProvider).clear();
            token = null;
            setLastStatus(
              'Token appareil invalide (QR session détecté). Scanne le QR depuis Web > Appareils.',
            );
          }
        }
      } catch (_) {}
    }

    // Restaurer la session Supabase (pour rester connecté même après fermeture de l'app)
    final supabase = ref.read(supabaseClientProvider);
    var session = supabase.auth.currentSession;
    var hasSession = session != null;

    if (!hasSession) {
      final refreshToken =
          await ref.read(authSessionStorageProvider).loadRefreshToken();
      if (refreshToken != null) {
        try {
          final res = await supabase.auth.refreshSession(refreshToken);
          session = res.session;
          hasSession = session != null;
          if (!hasSession) {
            await ref.read(authSessionStorageProvider).clear();
          }
        } catch (e) {
          // Token expiré/invalide => on nettoie et l'utilisateur devra se reconnecter.
          await ref.read(authSessionStorageProvider).clear();
          setLastStatus('Session expirée. Merci de vous reconnecter.');
        }
      }
    }

    state = state.copyWith(
      loading: false,
      deviceToken: token,
      authenticated: hasSession,
    );

    await checkPermissions();

    await _loadAppVersion();
    if (hasSession) {
      await refreshAccountInfo();
      await refreshInboxMessages(silent: true);
      await refreshOutboxHistory(silent: true);
      await refreshSubscription(silent: true);
    }

    // Auto-d\u00e9marrer le BackgroundSyncService UNE SEULE FOIS
    if (token != null && token.isNotEmpty) {
      try {
        await BackgroundSyncService.setEnabled(true);
        await BackgroundSyncService.setPaused(false);
        await BackgroundSyncService.setForegroundLock(false);
        await BackgroundSyncService.init();
        await BackgroundSyncService.start();
      } catch (e) {
        debugPrint('\u00c9chec auto-d\u00e9marrage BackgroundSyncService: $e');
      }
    }
  }

  Future<void> _loadAppVersion() async {
    try {
      final info = await PackageInfo.fromPlatform();
      final version = '${info.version}+${info.buildNumber}';
      state = state.copyWith(appVersion: version);
      // Store for background service update comparison
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString('app_current_version', version);
    } catch (_) {}
  }

  Future<void> refreshAccountInfo() async {
    final supabase = ref.read(supabaseClientProvider);
    final user = supabase.auth.currentUser;
    if (user == null) return;

    String? orgId;
    String? orgName;
    DateTime? memberSince;

    final res = await supabase
        .from('org_members')
        .select('org_id, created_at, organizations(name)')
        .eq('user_id', user.id)
        .order('created_at', ascending: true)
        .limit(1)
        .maybeSingle();

    if (res != null) {
      orgId = res['org_id']?.toString();
      final created = res['created_at']?.toString();
      memberSince = created == null ? null : DateTime.tryParse(created);
      final org = res['organizations'];
      if (org is Map && org['name'] != null) {
        orgName = org['name'].toString();
      }
    }

    state = state.copyWith(
      userEmail: user.email,
      orgId: orgId,
      orgName: orgName,
      memberSince: memberSince,
    );
  }

  Future<void> refreshInboxMessages({bool silent = true}) async {
    try {
      final supabase = ref.read(supabaseClientProvider);
      final user = supabase.auth.currentUser;
      if (user == null) return;

      final rows = await supabase
          .from('inbox_messages')
          .select('id, from_phone_e164, body, received_at, read, created_at')
          .order('received_at', ascending: false)
          .limit(50);

      final list = (rows as List? ?? const [])
          .whereType<Map>()
          .map((e) => InboxMessage.fromJson(Map<String, dynamic>.from(e)))
          .toList();

      state = state.copyWith(inboxMessages: list);
    } catch (e) {
      if (!silent) setLastStatus('Erreur inbox: $e');
    }
  }

  Future<void> refreshOutboxHistory({
    bool silent = true,
    String? status,
    String? phoneQuery,
    String? bodyQuery,
    String? simFilter,
    int page = 0,
    int pageSize = 20,
  }) async {
    try {
      final supabase = ref.read(supabaseClientProvider);
      final user = supabase.auth.currentUser;
      if (user == null) return;

      if (state.orgId == null) {
        await refreshAccountInfo();
      }
      final orgId = state.orgId;
      if (orgId == null) return;

      var q = supabase
          .from('messages')
          .select(
            'id,to_phone_e164,body_final,status,created_at,sent_at,try_count,last_error,sim_subscription_id',
          )
          .eq('org_id', orgId);

      if (status != null && status.isNotEmpty && status != 'all') {
        q = q.eq('status', status);
      }
      if (phoneQuery != null && phoneQuery.trim().isNotEmpty) {
        q = q.ilike('to_phone_e164', '%${phoneQuery.trim()}%');
      }
      if (bodyQuery != null && bodyQuery.trim().isNotEmpty) {
        q = q.ilike('body_final', '%${bodyQuery.trim()}%');
      }
      if (simFilter != null && simFilter.isNotEmpty && simFilter != 'all') {
        q = q.eq('sim_subscription_id', simFilter);
      }

      final from = page * pageSize;
      final to = from + pageSize - 1;
      final rows = await q.order('created_at', ascending: false).range(from, to);

      final list = (rows as List? ?? const [])
          .whereType<Map>()
          .map((e) => OutboxMessage.fromJson(Map<String, dynamic>.from(e)))
          .toList();

      state = state.copyWith(outboxHistory: list);
    } catch (e) {
      if (!silent) setLastStatus('Erreur historique: $e');
    }
  }

  Future<Map<String, int>> fetchMessageCounts() async {
    try {
      final supabase = ref.read(supabaseClientProvider);
      if (supabase.auth.currentUser == null) return {};
      if (state.orgId == null) await refreshAccountInfo();
      final orgId = state.orgId;
      if (orgId == null) return {};

      final results = <String, int>{};
      for (final s in ['queued', 'sending', 'sent', 'failed']) {
        final rows = await supabase
            .from('messages')
            .select('id')
            .eq('org_id', orgId)
            .eq('status', s)
            .limit(10001);
        results[s] = (rows as List).length;
      }
      final all = await supabase
          .from('messages')
          .select('id')
          .eq('org_id', orgId)
          .limit(10001);
      results['all'] = (all as List).length;
      return results;
    } catch (_) {
      return {};
    }
  }

  Future<void> refreshSubscription({bool silent = true}) async {
    try {
      final supabase = ref.read(supabaseClientProvider);
      if (supabase.auth.currentUser == null) return;
      if (state.orgId == null) {
        await refreshAccountInfo();
      }
      final orgId = state.orgId;
      if (orgId == null) return;

      // Prefer heartbeat data (includes effective plan ignoring legacy hidden plans)
      final token = state.deviceToken;
      if (token != null && token.isNotEmpty) {
        final payload = await ref.read(deviceServiceProvider).sendHeartbeatVerbose(deviceToken: token);
        final plan = payload['plan'];
        if (plan is Map) {
          state = state.copyWith(
            planName: plan['name']?.toString(),
            planSmsQuotaMonth: _safeParseInt(plan['sms_quota_month']),
            planMaxDevices: _safeParseInt(plan['max_devices']),
            subscriptionPeriodEnd: null,
            smsUsedThisMonth: _safeParseInt(payload['sms_used_this_month']),
            quotaRemaining: _safeParseInt(payload['quota_remaining']),
          );
          return;
        }
      }

      // Fallback: use visible plan from subscriptions (may still miss if none)
      final row = await supabase
          .from('subscriptions')
          .select('current_period_end, plans(name, sms_quota_month, max_devices, is_visible)')
          .eq('org_id', orgId)
          .eq('status', 'active')
          .eq('plans.is_visible', true)
          .order('created_at', ascending: false)
          .limit(1)
          .maybeSingle();

      if (row == null) {
        state = state.copyWith(planName: 'Gratuit', planSmsQuotaMonth: 100, planMaxDevices: 1, subscriptionPeriodEnd: null);
        return;
      }

      final plans = row['plans'];
      final endStr = row['current_period_end']?.toString();
      state = state.copyWith(
        planName: (plans is Map ? plans['name']?.toString() : null),
        planSmsQuotaMonth: _safeParseInt(plans is Map ? plans['sms_quota_month'] : null),
        planMaxDevices: _safeParseInt(plans is Map ? plans['max_devices'] : null),
        subscriptionPeriodEnd: endStr == null ? null : DateTime.tryParse(endStr),
      );
    } catch (e) {
      if (!silent) setLastStatus('Erreur abonnement: $e');
    }
  }

  Future<void> refreshDeviceStatus({bool silent = true}) async {
    final token = state.deviceToken;
    if (token == null || token.isEmpty) return;
    try {
      final payload = await ref.read(deviceServiceProvider).sendHeartbeatVerbose(
        deviceToken: token,
        appVersion: state.appVersion,
      );
      final name = payload['device_name']?.toString();
      final ts = payload['timestamp']?.toString();
      final plan = payload['plan'];
      state = state.copyWith(
        deviceName: name,
        lastHeartbeatAt: ts == null ? DateTime.now() : (DateTime.tryParse(ts) ?? DateTime.now()),
        planName: plan is Map ? plan['name']?.toString() : state.planName,
        planSmsQuotaMonth: plan is Map ? _safeParseInt(plan['sms_quota_month']) : state.planSmsQuotaMonth,
        planMaxDevices: plan is Map ? _safeParseInt(plan['max_devices']) : state.planMaxDevices,
        smsUsedThisMonth: _safeParseInt(payload['sms_used_this_month']),
        quotaRemaining: _safeParseInt(payload['quota_remaining']),
      );
    } catch (e) {
      if (!silent) setLastStatus('Statut appareil: $e');
    }
  }

  /// Récupère la campagne "active" la plus récente (running/paused/queued) pour afficher la progression sur le dashboard.
  Future<void> refreshActiveCampaign({bool silent = true}) async {
    try {
      final supabase = ref.read(supabaseClientProvider);
      if (supabase.auth.currentUser == null) return;

      // Assure que la session est fraîche (évite les 401 si le JWT a expiré).
      try {
        final s = supabase.auth.currentSession;
        if (s != null && s.expiresAt != null) {
          final nowSec = DateTime.now().millisecondsSinceEpoch ~/ 1000;
          if (s.expiresAt! <= nowSec + 90) {
            final rt = s.refreshToken;
            if (rt != null && rt.trim().isNotEmpty) {
              await supabase.auth.refreshSession(rt);
            }
          }
        }
      } catch (_) {}

      if (state.orgId == null) {
        await refreshAccountInfo();
      }
      final orgId = state.orgId;
      if (orgId == null) return;

      final row = await supabase
          .from('campaigns')
          .select('id,name,status,sent_count,total_count,updated_at')
          .eq('org_id', orgId)
          .inFilter('status', ['running', 'paused', 'queued'])
          .order('updated_at', ascending: false)
          .limit(1)
          .maybeSingle();

      if (row == null) {
        state = state.copyWith(clearCampaign: true);
        return;
      }

      state = state.copyWith(
        campaignIdSending: row['id']?.toString(),
        campaignNameSending: row['name']?.toString(),
        campaignStatusSending: row['status']?.toString(),
        campaignSentCount: _safeParseInt(row['sent_count']) ?? 0,
        campaignTotalCount: _safeParseInt(row['total_count']) ?? 0,
      );

      // Auto-ensure background service is running + unpaused when a campaign is active
      final status = row['status']?.toString();
      if ((status == 'running' || status == 'queued') && (state.deviceToken?.isNotEmpty ?? false)) {
        try {
          await BackgroundSyncService.setEnabled(true);
          await BackgroundSyncService.setPaused(false);
          await BackgroundSyncService.setForegroundLock(false);
          final bgRunning = await BackgroundSyncService.isRunning();
          if (!bgRunning) {
            await BackgroundSyncService.init();
            await BackgroundSyncService.start();
          }
          // Kick the background service to process immediately
          FlutterForegroundTask.sendDataToTask('kick');
        } catch (_) {}
      }
    } catch (e) {
      if (!silent) setLastStatus('Erreur campagne: $e');
    }
  }

  Future<void> pauseActiveCampaign() async {
    final id = state.campaignIdSending;
    if (id == null || id.isEmpty) return;
    // Optimistic UI: mettre à jour tout de suite le statut (le poll confirmera ensuite)
    state = state.copyWith(campaignStatusSending: 'paused');
    await ref.read(deviceServiceProvider).campaignControl(
          action: 'pause',
          campaignId: id,
          deviceToken: state.deviceToken,
        );
    await refreshActiveCampaign(silent: true);
  }

  Future<void> resumeActiveCampaign() async {
    final id = state.campaignIdSending;
    if (id == null || id.isEmpty) return;
    state = state.copyWith(campaignStatusSending: 'running');
    await ref.read(deviceServiceProvider).campaignControl(
          action: 'resume',
          campaignId: id,
          deviceToken: state.deviceToken,
        );
    await refreshActiveCampaign(silent: true);
  }

  Future<void> cancelActiveCampaign() async {
    final id = state.campaignIdSending;
    if (id == null || id.isEmpty) return;
    state = state.copyWith(campaignStatusSending: 'canceled');
    await ref.read(deviceServiceProvider).campaignControl(
          action: 'cancel',
          campaignId: id,
          deviceToken: state.deviceToken,
        );
    state = state.copyWith(clearCampaign: true);
    await refreshActiveCampaign(silent: true);
  }

  /// Force immediate sync: clears all stuck states and triggers send.
  Future<void> forceSyncNow() async {
    try {
      await BackgroundSyncService.setPaused(false);
      await BackgroundSyncService.setForegroundLock(false);
      await BackgroundSyncService.setEnabled(true);
    } catch (_) {}
    try {
      await BackgroundSyncService.init();
      await BackgroundSyncService.start();
    } catch (_) {}
    await syncOnce();
  }

  /// Reset failed messages to queued so they get retried.
  Future<int> retryFailedMessages() async {
    final token = state.deviceToken;
    if (token == null || token.isEmpty) throw Exception('Pas d\'appareil jumel\u00e9');
    final result = await ref.read(deviceServiceProvider).retryFailed(deviceToken: token);
    final count = result['count'];
    await refreshOutboxHistory(silent: true);
    return count is int ? count : 0;
  }

  /// Checks for app update and stores result in state for UI banner.
  Future<void> checkForUpdate({bool silent = true}) async {
    try {
      final update = await ref.read(appUpdateServiceProvider).checkForUpdate();
      if (update != null) {
        state = state.copyWith(
          updateVersion: update.latestVersion,
          updateUrl: update.apkUrl,
          updateNotes: update.notes,
        );
      } else {
        state = state.copyWith(clearUpdate: true);
      }
    } catch (_) {}
  }

  Future<void> dismissUpdate() async {
    final version = state.updateVersion;
    if (version != null) {
      await ref.read(appUpdateServiceProvider).ignoreVersion(version);
    }
    state = state.copyWith(clearUpdate: true);
  }

  Future<void> launchUpdate() async {
    final url = state.updateUrl;
    if (url != null && url.isNotEmpty) {
      await ref.read(appUpdateServiceProvider).openApkDownload(url);
    }
  }

  static int? _safeParseInt(dynamic value) {
    if (value == null) return null;
    if (value is int) return value;
    if (value is double) return value.toInt();
    return int.tryParse(value.toString());
  }

  Future<void> refreshSimCards({bool silent = true}) async {
    try {
      final sims = await ref.read(smsSenderProvider).getSimCards();
      state = state.copyWith(availableSims: sims);
    } catch (e) {
      if (!silent) {
        setLastStatus('Impossible de lire les SIMs: $e');
      }
    }
  }

  Future<void> saveToken(String token) async {
    String normalized = token.trim();

    // Tenter de parser si c'est du JSON (cas du QR code complet)
    if (normalized.startsWith('{') && normalized.endsWith('}')) {
      try {
        final data = jsonDecode(normalized);
        if (data is Map) {
          if (data.containsKey('device_token')) {
            normalized = data['device_token'].toString();
          } else if (data['type'] == 'session' || data.containsKey('refresh_token')) {
            setLastStatus(
              'QR de session détecté. Pour l’appareil, scanne le QR depuis Web > Appareils.',
            );
            throw Exception(
              'QR de session détecté (mauvais QR). Va sur Web > Appareils > Ajouter un appareil.',
            );
          }
        }
      } catch (e) {
        // Si c'est notre erreur de QR session, on la propage
        if (e is Exception &&
            e.toString().contains('QR de session détecté')) {
          rethrow;
        }
        // Sinon: pas du JSON valide ou format différent, on garde tel quel
      }
    }

    await ref.read(tokenStorageProvider).save(normalized);
    state = state.copyWith(
      deviceToken: normalized,
      lastStatus: 'Token enregistré',
    );

    // UX: activer le mode arrière-plan automatiquement au premier jumelage,
    // pour que l'envoi continue même si l'utilisateur sort de l'app.
    try {
      final enabled = await BackgroundSyncService.isEnabled();
      if (!enabled) {
        await BackgroundSyncService.setEnabled(true);
        await BackgroundSyncService.setPaused(false);
        await BackgroundSyncService.start(); // déclenche la demande de permission Notifications si besoin
        state = state.copyWith(lastStatus: '✅ Appareil connecté + mode arrière‑plan activé');
      }
    } catch (_) {}
  }

  Future<void> clearToken() async {
    await ref.read(tokenStorageProvider).clear();
    state = state.copyWith(
      deviceToken: null,
      lastMessages: const [],
      lastStatus: 'Token effacé',
    );
  }

  Future<void> signOutAccount() async {
    final supabase = ref.read(supabaseClientProvider);
    await supabase.auth.signOut();
    await ref.read(authSessionStorageProvider).clear();
    // IMPORTANT: on garde le deviceToken pour éviter de devoir re-scanner l’appareil.
    state = state.copyWith(
      authenticated: false,
      lastStatus: 'Compte déconnecté (appareil conservé)',
      userEmail: null,
      orgId: null,
      orgName: null,
      memberSince: null,
      inboxMessages: const [],
      outboxHistory: const [],
    );
  }

  Future<void> _postLoginSetup() async {
    await checkPermissions();

    try {
      if (state.deviceToken != null && state.deviceToken!.isNotEmpty) {
        final enabled = await BackgroundSyncService.isEnabled();
        if (enabled) {
          await BackgroundSyncService.start();
        } else {
          await BackgroundSyncService.setEnabled(true);
          await BackgroundSyncService.setPaused(false);
          await BackgroundSyncService.start();
        }
      }
    } catch (_) {}
  }

  Future<void> signInWithEmail({
    required String email,
    required String password,
  }) async {
    final supabase = ref.read(supabaseClientProvider);
    final res = await supabase.auth.signInWithPassword(
      email: email.trim(),
      password: password,
    );
    if (res.session == null) {
      throw Exception('Connexion impossible');
    }
    final refresh = res.session?.refreshToken;
    if (refresh != null && refresh.isNotEmpty) {
      await ref.read(authSessionStorageProvider).saveRefreshToken(refresh);
    }
    state = state.copyWith(authenticated: true);
    await refreshAccountInfo();
    await refreshSubscription(silent: true);
    await refreshInboxMessages(silent: true);
    await refreshOutboxHistory(silent: true);
    
    await _postLoginSetup();
  }

  Future<void> recoverSessionFromQrJson({
    required String sessionJson,
  }) async {
    final supabase = ref.read(supabaseClientProvider);
    final res = await supabase.auth.recoverSession(sessionJson);
    if (res.session == null) {
      throw Exception('Session invalide (QR expiré ou incomplet). Régénérez le QR sur le web.')
;
    }
    final refresh = res.session?.refreshToken;
    if (refresh != null && refresh.isNotEmpty) {
      await ref.read(authSessionStorageProvider).saveRefreshToken(refresh);
    }
    state = state.copyWith(authenticated: true);
    await refreshAccountInfo();
    await refreshSubscription(silent: true);
    await refreshInboxMessages(silent: true);
    await refreshOutboxHistory(silent: true);

    await _postLoginSetup();
  }

  Future<void> signInWithRefreshToken({
    required String refreshToken,
  }) async {
    final supabase = ref.read(supabaseClientProvider);
    final res = await supabase.auth.refreshSession(refreshToken);
    if (res.session == null) {
      throw Exception('Session invalide. Régénérez le QR sur le web et réessayez.');
    }
    final refresh = res.session?.refreshToken;
    if (refresh != null && refresh.isNotEmpty) {
      await ref.read(authSessionStorageProvider).saveRefreshToken(refresh);
    }
    state = state.copyWith(authenticated: true);
    await refreshAccountInfo();
    await refreshSubscription(silent: true);
    await refreshInboxMessages(silent: true);
    await refreshOutboxHistory(silent: true);

    await _postLoginSetup();
  }

  Future<void> syncOnce({bool silentIfEmpty = false}) async {
    final token = state.deviceToken;
    if (token == null || token.isEmpty) {
      state = state.copyWith(lastStatus: 'Aucun token enregistré');
      return;
    }

    state = state.copyWith(syncing: true, lastStatus: 'Synchronisation...');

    try {
      // Verrouille le service arrière-plan pour éviter le double-envoi pendant ce sync manuel.
      try {
        await BackgroundSyncService.setForegroundLock(true);
      } catch (_) {}

      final permsOk = await ref.read(smsSenderProvider).ensurePermissions();
      if (!permsOk) {
        state = state.copyWith(
          permissionsOk: false,
          lastStatus: 'Permissions SMS/Phone necessaires',
        );
        return;
      }

      // Charger les SIMs une fois si vide (pour router les campagnes SIM1/SIM2).
      if (state.availableSims.isEmpty) {
        await refreshSimCards();
      }

      final payload = await ref.read(deviceServiceProvider).claimMessagesVerbose(
        deviceToken: token,
        limit: AppConfig.claimBatchSize,
            // La SIM est décidée côté campagne web (via sim_slot_index),
            // claim_messages_atomic renvoie ensuite sim_subscription_id = "slot:X".
            simSubscriptionId: null,
          );

      // Mettre à jour quota/usage dès qu’on a une réponse serveur.
      final usedThisMonth = _safeParseInt(payload['sms_used_this_month']);
      final remaining = _safeParseInt(payload['quota_remaining']);
      state = state.copyWith(
        smsUsedThisMonth: usedThisMonth ?? state.smsUsedThisMonth,
        quotaRemaining: remaining ?? state.quotaRemaining,
      );

      final rawList = (payload['messages'] as List?) ?? const [];
      final messages = rawList
          .whereType<Map>()
          .map((e) => Message.fromJson(Map<String, dynamic>.from(e)))
          .toList();

      if (messages.isEmpty) {
        final quotaReached = payload['quota_reached'] == true || remaining == 0;
        final plan = payload['plan'];
        final planQuota = plan is Map ? _safeParseInt(plan['sms_quota_month']) : null;

        if (!silentIfEmpty) {
          if (quotaReached && planQuota != null && planQuota > 0) {
            state = state.copyWith(
              lastStatus:
                  '🚫 Quota atteint (${planQuota} SMS/mois). Reste: 0.\nLes SMS restants sont en attente. Passe à un abonnement ou attends le renouvellement.',
              lastMessages: const [],
            );
          } else {
            state = state.copyWith(
              lastStatus: 'Aucun message à envoyer',
              lastMessages: const [],
            );
          }
        }
        return;
      }

      final results = <String>[];
      int okCount = 0;
      int failCount = 0;
      final perSmsDelayMs = await AppSettings.getSmsDelayMs();

      for (int i = 0; i < messages.length; i++) {
        final msg = messages[i];
        int? subscriptionId;
        if (msg.simSubscriptionId != null) {
          subscriptionId = msg.simSubscriptionId;
        } else if (msg.simSlotIndex != null) {
          final match = state.availableSims.firstWhere(
            (s) => s.simSlotIndex == msg.simSlotIndex,
            orElse: () => const SimCard(subscriptionId: -1, simSlotIndex: -1, displayName: '', carrierName: ''),
          );
          subscriptionId = match.subscriptionId >= 0 ? match.subscriptionId : null;
        }

        final sendResult = await ref.read(smsSenderProvider).send(
              msg,
              subscriptionIdOverride: subscriptionId,
            );
        await ref.read(deviceServiceProvider).updateMessageStatus(
          deviceToken: token,
          message: msg,
          success: sendResult.success,
          error: sendResult.error,
        );

        if (sendResult.success) {
          okCount++;
          results.add('✅ sent → ${msg.to}');
        } else {
          failCount++;
          final err = (sendResult.error ?? 'Erreur inconnue').replaceAll('\n', ' ');
          results.add('❌ failed → ${msg.to} (${err.length > 80 ? err.substring(0, 80) + '…' : err})');
        }

        // Respect the user-configured delay between SMS, except after the
        // last message of the batch.
        if (i < messages.length - 1 && perSmsDelayMs > 0) {
          await Future.delayed(Duration(milliseconds: perSmsDelayMs));
        }
      }

      state = state.copyWith(
        lastMessages: messages,
        lastStatus: 'Résultat: $okCount OK • $failCount échecs\n\n${results.join('\n')}',
      );

      // Rafraîchir le quota après envoi (statuts mis à jour côté serveur)
      await refreshDeviceStatus(silent: true);

      // Si le mode arrière-plan est activé, relancer le service après l'envoi manuel.
      try {
        final bgEnabled = await BackgroundSyncService.isEnabled();
        if (bgEnabled) {
          await BackgroundSyncService.setPaused(false);
          await BackgroundSyncService.start();
        }
      } catch (_) {}
    } catch (e, st) {
      ref.read(loggerProvider).e('syncOnce error', error: e, stackTrace: st);
      state = state.copyWith(lastStatus: 'Erreur sync: $e');
    } finally {
      try {
        await BackgroundSyncService.setForegroundLock(false);
      } catch (_) {}
      state = state.copyWith(syncing: false);
    }
  }
}

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  // Foreground task communication port
  FlutterForegroundTask.initCommunicationPort();
  runApp(const ProviderScope(child: MyApp()));
}

String _formatDeviceTokenForUi(String? token) {
  if (token == null || token.trim().isEmpty) return 'non défini';
  String t = token.trim();

  if (t.startsWith('{') && t.endsWith('}')) {
    try {
      final data = jsonDecode(t);
      if (data is Map) {
        if (data['type'] == 'session' || data.containsKey('refresh_token')) {
          return 'Token invalide (QR session) - rescanner QR appareil';
        }
        if (data.containsKey('device_token')) {
          t = data['device_token'].toString();
        }
      }
    } catch (_) {}
  }

  if (t.length <= 14) return t;
  return '${t.substring(0, 6)}…${t.substring(t.length - 4)}';
}

String _formatDateFr(DateTime dt) {
  const months = [
    'janvier',
    'février',
    'mars',
    'avril',
    'mai',
    'juin',
    'juillet',
    'août',
    'septembre',
    'octobre',
    'novembre',
    'décembre',
  ];
  final d = dt.toLocal();
  final m = months[d.month - 1];
  return '${d.day} $m ${d.year}';
}

String _formatDateTimeFr(DateTime dt) {
  final d = dt.toLocal();
  final hh = d.hour.toString().padLeft(2, '0');
  final mm = d.minute.toString().padLeft(2, '0');
  return '${_formatDateFr(d)} $hh:$mm';
}

class MyApp extends ConsumerStatefulWidget {
  const MyApp({super.key});

  @override
  ConsumerState<MyApp> createState() => _MyAppState();
}

class _MyAppState extends ConsumerState<MyApp> {
  final AppLinks _appLinks = AppLinks();
  StreamSubscription<Uri>? _linkSub;

  @override
  void initState() {
    super.initState();
    scheduleMicrotask(() => ref.read(appProvider.notifier).init());
    scheduleMicrotask(_initDeepLinks);
    // Init foreground service infra (background sending)
    scheduleMicrotask(() async {
      await BackgroundSyncService.init();
      // Auto-start if enabled previously
      final enabled = await BackgroundSyncService.isEnabled();
      if (enabled) {
        await BackgroundSyncService.start();
      }
    });
  }

  Future<void> _initDeepLinks() async {
    // Initial link (app cold start)
    try {
      final uri = await _appLinks.getInitialLink();
      await _handleDeepLink(uri);
    } catch (_) {}

    // Ongoing links (app already open)
    _linkSub?.cancel();
    _linkSub = _appLinks.uriLinkStream.listen(
      (uri) async {
        await _handleDeepLink(uri);
      },
      onError: (_) {},
    );
  }

  Future<void> _handleDeepLink(Uri? uri) async {
    if (uri == null) return;
    // Expected: smsgateway://pair?device_token=...&device_name=...
    if (uri.scheme != 'smsgateway' || uri.host != 'pair') return;

    final token = (uri.queryParameters['device_token'] ??
            uri.queryParameters['token'] ??
            '')
        .trim();
    if (token.isEmpty) return;

    try {
      await ref.read(appProvider.notifier).saveToken(token);
      ref.read(appProvider.notifier).setLastStatus('Appareil connecté via lien ✅');
    } catch (e) {
      ref.read(appProvider.notifier).setLastStatus('Lien de connexion invalide: $e');
    }
  }

  @override
  void dispose() {
    _linkSub?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final appState = ref.watch(appProvider);

    final theme = ThemeData(
      colorScheme: ColorScheme.fromSeed(
        seedColor: const Color(0xFF16A34A),
        brightness: Brightness.light,
        primary: const Color(0xFF16A34A),
        secondary: const Color(0xFF3B82F6),
      ),
      useMaterial3: true,
      fontFamily: 'SF Pro Display',
      cardTheme: CardThemeData(
        elevation: 0,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(20),
          side: BorderSide(color: Colors.grey.shade200, width: 1),
        ),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          elevation: 0,
          padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 16),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(16),
          ),
          backgroundColor: const Color(0xFF16A34A),
          foregroundColor: Colors.white,
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: Colors.grey.shade50,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(16),
          borderSide: BorderSide(color: Colors.grey.shade200),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(16),
          borderSide: BorderSide(color: Colors.grey.shade200),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(16),
          borderSide: const BorderSide(color: Color(0xFF16A34A), width: 2),
        ),
        contentPadding: const EdgeInsets.all(20),
      ),
      appBarTheme: const AppBarTheme(
        elevation: 0,
        centerTitle: true,
        backgroundColor: Colors.transparent,
        foregroundColor: Colors.black87,
        systemOverlayStyle: SystemUiOverlayStyle.dark,
      ),
    );

    if (appState.loading) {
      return MaterialApp(
        debugShowCheckedModeBanner: false,
        theme: theme,
        home: const Scaffold(
          body: Center(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                SizedBox(
                  width: 64,
                  height: 64,
                  child: CircularProgressIndicator(
                    strokeWidth: 3,
                    color: Color(0xFF16A34A),
                  ),
                ),
                SizedBox(height: 24),
                Text(
                  'Chargement...',
                  style: TextStyle(
                    fontSize: 16,
                    color: Colors.black54,
                    fontWeight: FontWeight.w500,
                  ),
                ),
              ],
            ),
          ),
        ),
      );
    }

    return MaterialApp(
      debugShowCheckedModeBanner: false,
      theme: theme,
      home: AnimatedSwitcher(
        duration: const Duration(milliseconds: 500),
        transitionBuilder: (child, animation) {
          return FadeTransition(
            opacity: animation,
            child: SlideTransition(
              position: Tween<Offset>(
                begin: const Offset(0.0, 0.1),
                end: Offset.zero,
              ).animate(CurvedAnimation(
                parent: animation,
                curve: Curves.easeOutCubic,
              )),
              child: child,
            ),
          );
        },
        child: !appState.authenticated
            ? const AuthPage(key: ValueKey('auth'))
            : !appState.permissionsOk
                ? const PermissionsPage(key: ValueKey('permissions'))
                : appState.deviceToken == null
                    ? const PairingPage(key: ValueKey('pairing'))
                    : const HomePage(key: ValueKey('home')),
      ),
    );
  }

}

class PairingPage extends ConsumerStatefulWidget {
  const PairingPage({super.key});

  @override
  ConsumerState<PairingPage> createState() => _PairingPageState();
}

class _PairingPageState extends ConsumerState<PairingPage>
    with SingleTickerProviderStateMixin {
  final _controller = TextEditingController();
  bool _saving = false;
  late AnimationController _animController;
  late Animation<double> _fadeAnimation;
  late Animation<Offset> _slideAnimation;

  @override
  void initState() {
    super.initState();
    _animController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 800),
    );
    _fadeAnimation = CurvedAnimation(
      parent: _animController,
      curve: Curves.easeOut,
    );
    _slideAnimation = Tween<Offset>(
      begin: const Offset(0, 0.3),
      end: Offset.zero,
    ).animate(CurvedAnimation(
      parent: _animController,
      curve: Curves.easeOutCubic,
    ));
    _animController.forward();
  }

  @override
  void dispose() {
    _controller.dispose();
    _animController.dispose();
    super.dispose();
  }

  Future<void> _scanQr() async {
    HapticFeedback.mediumImpact();
    final result = await Navigator.of(context).push<String?>(
      PageRouteBuilder(
        pageBuilder: (context, animation, secondaryAnimation) => const QrScannerPage(),
        transitionsBuilder: (context, animation, secondaryAnimation, child) {
          return FadeTransition(
            opacity: animation,
            child: SlideTransition(
              position: Tween<Offset>(
                begin: const Offset(0.0, 0.1),
                end: Offset.zero,
              ).animate(CurvedAnimation(
                parent: animation,
                curve: Curves.easeOutCubic,
              )),
              child: child,
            ),
          );
        },
      ),
    );
    if (result != null && result.isNotEmpty) {
      setState(() => _controller.text = result);
      HapticFeedback.lightImpact();
    }
  }

  Future<void> _save() async {
    final token = _controller.text.trim();
    if (token.isEmpty) {
      HapticFeedback.heavyImpact();
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: const Text('Veuillez entrer un token'),
          behavior: SnackBarBehavior.floating,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          backgroundColor: Colors.red.shade600,
        ),
      );
      return;
    }

    setState(() => _saving = true);
    HapticFeedback.mediumImpact();
    try {
      await ref.read(appProvider.notifier).saveToken(token);
      HapticFeedback.lightImpact();
    } catch (e) {
      HapticFeedback.heavyImpact();
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(e.toString().replaceFirst('Exception: ', '')),
          behavior: SnackBarBehavior.floating,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          backgroundColor: Colors.red.shade700,
        ),
      );
    }
    setState(() => _saving = false);
  }

  Future<void> _pairOneClick() async {
    if (_saving) return;
    HapticFeedback.mediumImpact();

    final nameController = TextEditingController(text: 'Mon téléphone');
    final deviceName = await showDialog<String?>(
      context: context,
      barrierDismissible: true,
      builder: (ctx) {
        return AlertDialog(
          title: const Text('Nom de l’appareil'),
          content: TextField(
            controller: nameController,
            decoration: const InputDecoration(
              hintText: 'Ex: Samsung Galaxy A20',
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(ctx).pop(null),
              child: const Text('Annuler'),
            ),
            FilledButton(
              onPressed: () => Navigator.of(ctx).pop(nameController.text.trim()),
              child: const Text('Continuer'),
            ),
          ],
        );
      },
    );

    final name = (deviceName ?? '').trim();
    if (name.isEmpty) return;

    setState(() => _saving = true);
    try {
      // 1) Créer le device côté serveur (Edge Function device_pair) via proxy web
      final token = await ref.read(deviceServiceProvider).createDeviceToken(deviceName: name);
      // 2) Sauver le token localement (déclenche l’affichage HomePage)
      await ref.read(appProvider.notifier).saveToken(token);
      // 3) Optionnel: heartbeat pour récupérer nom/plan tout de suite
      await ref.read(appProvider.notifier).refreshDeviceStatus(silent: true);
      ref.read(appProvider.notifier).setLastStatus('Appareil lié automatiquement ✅');
      HapticFeedback.lightImpact();
    } catch (e) {
      HapticFeedback.heavyImpact();
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(e.toString().replaceFirst('Exception: ', '')),
          behavior: SnackBarBehavior.floating,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          backgroundColor: Colors.red.shade700,
        ),
      );
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final appState = ref.watch(appProvider);

    return Scaffold(
      extendBodyBehindAppBar: true,
      appBar: AppBar(
        elevation: 0,
        backgroundColor: Colors.transparent,
      ),
      body: Container(
        width: double.infinity,
        height: double.infinity,
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [
              const Color(0xFF16A34A).withOpacity(0.1),
              const Color(0xFF3B82F6).withOpacity(0.05),
              Colors.white,
            ],
          ),
        ),
        child: SafeArea(
          child: SingleChildScrollView(
            physics: const BouncingScrollPhysics(),
            padding: const EdgeInsets.all(24.0),
            child: FadeTransition(
              opacity: _fadeAnimation,
              child: SlideTransition(
                position: _slideAnimation,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
                    // Hero Icon
                    Center(
                      child: Hero(
                        tag: 'app_logo',
                        child: Container(
                          width: 100,
                          height: 100,
                          decoration: BoxDecoration(
                            gradient: const LinearGradient(
                              begin: Alignment.topLeft,
                              end: Alignment.bottomRight,
                              colors: [
                                Color(0xFF16A34A),
                                Color(0xFF22C55E),
                              ],
                            ),
                            borderRadius: BorderRadius.circular(28),
                            boxShadow: [
                              BoxShadow(
                                color: const Color(0xFF16A34A).withOpacity(0.3),
                                blurRadius: 24,
                                offset: const Offset(0, 8),
                              ),
                            ],
                          ),
                          child: const Icon(
                            Icons.phone_android_rounded,
                            size: 56,
                            color: Colors.white,
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(height: 40),
                    
                    // Title
                    Text(
                      'Jumelage de l\'appareil',
                      style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                            fontWeight: FontWeight.bold,
                            color: Colors.black87,
                          ),
                    ),
                    const SizedBox(height: 12),
                    
                    // Subtitle
                    Text(
                      'Scannez le QR code depuis votre tableau de bord web ou collez le token manuellement.',
                      style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                            color: Colors.black54,
                            height: 1.5,
                          ),
                    ),
                    const SizedBox(height: 32),
                    
                    // Glassmorphism Card
                    ClipRRect(
                      borderRadius: BorderRadius.circular(24),
                      child: BackdropFilter(
                        filter: ImageFilter.blur(sigmaX: 10, sigmaY: 10),
                        child: Container(
                          padding: const EdgeInsets.all(24),
                          decoration: BoxDecoration(
                            color: Colors.white.withOpacity(0.7),
                            borderRadius: BorderRadius.circular(24),
                            border: Border.all(
                              color: Colors.white.withOpacity(0.5),
                              width: 1.5,
                            ),
                            boxShadow: [
                              BoxShadow(
                                color: Colors.black.withOpacity(0.05),
                                blurRadius: 20,
                                offset: const Offset(0, 4),
                              ),
                            ],
                          ),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                'Token de l\'appareil',
                                style: Theme.of(context).textTheme.titleMedium?.copyWith(
                                      fontWeight: FontWeight.w600,
                                      color: Colors.black87,
                                    ),
            ),
            const SizedBox(height: 16),
            TextField(
              controller: _controller,
                                maxLines: 3,
                                style: const TextStyle(
                                  fontSize: 13,
                                  fontFamily: 'monospace',
                                ),
                                decoration: InputDecoration(
                                  hintText: 'Collez votre token ici...',
                                  prefixIcon: const Icon(Icons.key_rounded),
                                  suffixIcon: _controller.text.isNotEmpty
                                      ? IconButton(
                                          icon: const Icon(Icons.clear_rounded),
                                          onPressed: () {
                                            setState(() => _controller.clear());
                                          },
                                        )
                                      : null,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(height: 24),
                    
                    // Action Buttons
            Row(
              children: [
                        Expanded(
                          child: _AnimatedButton(
                  onPressed: _saving ? null : _scanQr,
                            icon: Icons.qr_code_scanner_rounded,
                            label: 'Scanner QR',
                            isPrimary: false,
                          ),
                ),
                const SizedBox(width: 12),
                        Expanded(
                          child: _AnimatedButton(
                  onPressed: _saving ? null : _save,
                            icon: Icons.check_circle_rounded,
                            label: _saving ? 'Enregistrement...' : 'Valider',
                            isPrimary: true,
                            isLoading: _saving,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 14),
                    Center(
                      child: TextButton(
                        onPressed: _saving ? null : _pairOneClick,
                        child: const Text('🔗 Lier automatiquement (1 clic)'),
                      ),
                    ),
                    
                    // Status Message
                    if (appState.lastStatus != null) ...[
                      const SizedBox(height: 20),
                      _StatusCard(message: appState.lastStatus!),
                    ],
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Permissions Page - shown at first launch or when essential permissions missing
// ---------------------------------------------------------------------------

class _PermissionItem {
  _PermissionItem({
    required this.permission,
    required this.label,
    required this.description,
    required this.icon,
    required this.required_,
    this.status = PermissionStatus.denied,
  });

  final Permission permission;
  final String label;
  final String description;
  final IconData icon;
  final bool required_;
  PermissionStatus status;
}

class PermissionsPage extends ConsumerStatefulWidget {
  const PermissionsPage({super.key});

  @override
  ConsumerState<PermissionsPage> createState() => _PermissionsPageState();
}

class _PermissionsPageState extends ConsumerState<PermissionsPage> with WidgetsBindingObserver {
  late List<_PermissionItem> _items;
  bool _requesting = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _items = [
      _PermissionItem(
        permission: Permission.sms,
        label: 'Envoi de SMS',
        description: 'Permet d\'envoyer les SMS de vos campagnes',
        icon: Icons.sms_rounded,
        required_: true,
      ),
      _PermissionItem(
        permission: Permission.phone,
        label: 'Telephone',
        description: 'Detecter les cartes SIM et gerer les appels',
        icon: Icons.phone_android_rounded,
        required_: true,
      ),
      _PermissionItem(
        permission: Permission.notification,
        label: 'Notifications',
        description: 'Afficher la progression de l\'envoi en temps reel',
        icon: Icons.notifications_active_rounded,
        required_: false,
      ),
      _PermissionItem(
        permission: Permission.ignoreBatteryOptimizations,
        label: 'Arriere-plan',
        description: 'Continuer l\'envoi meme quand l\'app est fermee',
        icon: Icons.battery_charging_full_rounded,
        required_: false,
      ),
    ];
    _refreshStatuses();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      _refreshStatuses();
    }
  }

  Future<void> _refreshStatuses() async {
    for (final item in _items) {
      try {
        item.status = await item.permission.status;
      } catch (_) {}
    }
    if (mounted) setState(() {});
  }

  bool get _essentialGranted =>
      _items.where((i) => i.required_).every((i) => i.status.isGranted);

  Future<void> _requestAll() async {
    setState(() => _requesting = true);

    for (final item in _items) {
      if (item.status.isGranted) continue;
      try {
        if (item.status.isPermanentlyDenied) {
          await openAppSettings();
          await Future.delayed(const Duration(seconds: 1));
          await _refreshStatuses();
          continue;
        }
        final result = await item.permission.request();
        item.status = result;
      } catch (_) {}
    }

    await _refreshStatuses();
    setState(() => _requesting = false);
  }

  Future<void> _requestSingle(_PermissionItem item) async {
    try {
      if (item.status.isPermanentlyDenied) {
        await openAppSettings();
        return;
      }
      final result = await item.permission.request();
      item.status = result;
      await _refreshStatuses();
    } catch (_) {}
  }

  void _continue() {
    ref.read(appProvider.notifier).checkPermissions();
  }

  @override
  Widget build(BuildContext context) {
    final green = const Color(0xFF16A34A);

    return Scaffold(
      backgroundColor: Colors.white,
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 24),
          child: Column(
            children: [
              const SizedBox(height: 40),

              Container(
                width: 80,
                height: 80,
                decoration: BoxDecoration(
                  color: green.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(24),
                ),
                child: Icon(Icons.security_rounded, size: 40, color: green),
              ),
              const SizedBox(height: 24),

              const Text(
                'Autorisations requises',
                style: TextStyle(fontSize: 24, fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 8),
              Text(
                'Pour fonctionner correctement, SMSenvoie a besoin\ndes autorisations suivantes :',
                textAlign: TextAlign.center,
                style: TextStyle(fontSize: 14, color: Colors.grey.shade600, height: 1.4),
              ),
              const SizedBox(height: 32),

              Expanded(
                child: ListView.separated(
                  itemCount: _items.length,
                  separatorBuilder: (_, __) => const SizedBox(height: 12),
                  itemBuilder: (context, index) {
                    final item = _items[index];
                    final granted = item.status.isGranted;
                    final denied = item.status.isPermanentlyDenied;

                    return Container(
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        color: granted
                            ? green.withValues(alpha: 0.05)
                            : Colors.grey.shade50,
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(
                          color: granted ? green.withValues(alpha: 0.3) : Colors.grey.shade200,
                        ),
                      ),
                      child: Row(
                        children: [
                          Container(
                            width: 48,
                            height: 48,
                            decoration: BoxDecoration(
                              color: granted
                                  ? green.withValues(alpha: 0.15)
                                  : Colors.grey.shade100,
                              borderRadius: BorderRadius.circular(14),
                            ),
                            child: Icon(
                              item.icon,
                              color: granted ? green : Colors.grey.shade500,
                              size: 24,
                            ),
                          ),
                          const SizedBox(width: 14),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Row(
                                  children: [
                                    Expanded(
                                      child: Text(
                                        item.label,
                                        style: const TextStyle(
                                          fontWeight: FontWeight.w600,
                                          fontSize: 15,
                                        ),
                                      ),
                                    ),
                                    if (item.required_)
                                      Container(
                                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                        decoration: BoxDecoration(
                                          color: granted ? green.withValues(alpha: 0.1) : Colors.red.shade50,
                                          borderRadius: BorderRadius.circular(6),
                                        ),
                                        child: Text(
                                          granted ? 'OK' : 'Requis',
                                          style: TextStyle(
                                            fontSize: 10,
                                            fontWeight: FontWeight.w700,
                                            color: granted ? green : Colors.red.shade700,
                                          ),
                                        ),
                                      ),
                                  ],
                                ),
                                const SizedBox(height: 2),
                                Text(
                                  item.description,
                                  style: TextStyle(fontSize: 12, color: Colors.grey.shade600),
                                ),
                              ],
                            ),
                          ),
                          const SizedBox(width: 10),
                          if (granted)
                            Icon(Icons.check_circle_rounded, color: green, size: 28)
                          else
                            SizedBox(
                              height: 34,
                              child: TextButton(
                                onPressed: () => _requestSingle(item),
                                style: TextButton.styleFrom(
                                  padding: const EdgeInsets.symmetric(horizontal: 12),
                                  backgroundColor: denied ? Colors.orange.shade50 : green.withValues(alpha: 0.1),
                                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                                ),
                                child: Text(
                                  denied ? 'Parametres' : 'Autoriser',
                                  style: TextStyle(
                                    fontSize: 12,
                                    fontWeight: FontWeight.w600,
                                    color: denied ? Colors.orange.shade800 : green,
                                  ),
                                ),
                              ),
                            ),
                        ],
                      ),
                    );
                  },
                ),
              ),

              const SizedBox(height: 16),

              SizedBox(
                width: double.infinity,
                height: 54,
                child: FilledButton.icon(
                  onPressed: _requesting ? null : (_essentialGranted ? _continue : _requestAll),
                  icon: Icon(_essentialGranted ? Icons.arrow_forward_rounded : Icons.shield_rounded),
                  label: Text(
                    _essentialGranted
                        ? 'Continuer'
                        : (_requesting ? 'Autorisation en cours...' : 'Tout autoriser'),
                    style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w600),
                  ),
                  style: FilledButton.styleFrom(
                    backgroundColor: _essentialGranted ? green : green.withValues(alpha: 0.85),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                  ),
                ),
              ),

              if (!_essentialGranted) ...[
                const SizedBox(height: 10),
                Text(
                  'Les permissions SMS et Telephone sont obligatoires',
                  style: TextStyle(fontSize: 12, color: Colors.grey.shade500),
                ),
              ],

              const SizedBox(height: 24),
            ],
          ),
        ),
      ),
    );
  }
}

class AuthPage extends ConsumerStatefulWidget {
  const AuthPage({super.key});

  @override
  ConsumerState<AuthPage> createState() => _AuthPageState();
}

class _AuthPageState extends ConsumerState<AuthPage> with TickerProviderStateMixin {
  late final TabController _tabController;
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  bool _loading = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
  }

  @override
  void dispose() {
    _tabController.dispose();
    _emailController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  Future<void> _signIn() async {
    final email = _emailController.text.trim();
    final pass = _passwordController.text;
    if (email.isEmpty || pass.isEmpty) {
      setState(() => _error = 'Email et mot de passe requis');
      return;
    }
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      await ref.read(appProvider.notifier).signInWithEmail(email: email, password: pass);
    } catch (e) {
      setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _scanSessionQr() async {
    HapticFeedback.mediumImpact();
    final result = await Navigator.of(context).push<String?>(
      PageRouteBuilder(
        pageBuilder: (context, animation, secondaryAnimation) => const QrScannerPage(),
        transitionsBuilder: (context, animation, secondaryAnimation, child) {
          return FadeTransition(
            opacity: animation,
            child: SlideTransition(
              position: Tween<Offset>(
                begin: const Offset(0.0, 0.1),
                end: Offset.zero,
              ).animate(CurvedAnimation(
                parent: animation,
                curve: Curves.easeOutCubic,
              )),
              child: child,
            ),
          );
        },
      ),
    );
    if (result == null || result.isEmpty) return;

    try {
      final decoded = jsonDecode(result);
      if (decoded is! Map) {
        throw Exception('Format inattendu');
      }

      // Nouveau format (web): { type: "session", session: { ...session Supabase... } }
      // Ancien format (legacy): { access_token, refresh_token, ... }  (NE SUFFIT PAS)
      final dynamic sessionObj = decoded['session'] ?? decoded;
      if (sessionObj is! Map) {
        throw Exception('Session manquante');
      }

      // Si on a un refresh_token, on préfère un login "compact" via refreshSession()
      // (QR beaucoup plus petit, plus fiable à scanner).
      final dynamic refreshToken = sessionObj['refresh_token'];
      if (refreshToken is String && refreshToken.isNotEmpty) {
        await ref.read(appProvider.notifier).signInWithRefreshToken(
              refreshToken: refreshToken,
            );
        return;
      }

      // Validation minimale requise par gotrue Session.fromJson
      final hasAccess = sessionObj['access_token'] != null;
      final hasTokenType = sessionObj['token_type'] != null;
      final hasUser = sessionObj['user'] != null;
      if (!hasAccess || !hasTokenType || !hasUser) {
        throw Exception('QR incomplet. Régénérez le QR depuis le Profil (web).');
      }

      final sessionJson = jsonEncode(sessionObj);
      await ref.read(appProvider.notifier).recoverSessionFromQrJson(
            sessionJson: sessionJson,
          );
    } catch (e) {
      setState(() => _error = 'QR session invalide: $e');
    }
  }

  @override
  Widget build(BuildContext context) {
    final size = MediaQuery.of(context).size;
    return Scaffold(
      extendBodyBehindAppBar: true,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
      ),
      body: Container(
        width: double.infinity,
        height: double.infinity,
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [
              const Color(0xFF16A34A).withOpacity(0.06),
              const Color(0xFF3B82F6).withOpacity(0.04),
              Colors.white,
              Colors.white,
            ],
            stops: const [0.0, 0.3, 0.7, 1.0],
          ),
        ),
        child: SafeArea(
          child: SingleChildScrollView(
            physics: const BouncingScrollPhysics(),
            padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 32),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Logo Hero - Premium Design
                Center(
                  child: Hero(
                    tag: 'app_logo',
                    child: TweenAnimationBuilder<double>(
                      tween: Tween(begin: 0.0, end: 1.0),
                      duration: const Duration(milliseconds: 800),
                      curve: Curves.easeOutCubic,
                      builder: (context, value, child) {
                        return Transform.scale(
                          scale: value,
                          child: Opacity(
                            opacity: value,
                            child: Container(
                              width: 100,
                              height: 100,
                              decoration: BoxDecoration(
                                gradient: const LinearGradient(
                                  colors: [Color(0xFF16A34A), Color(0xFF22C55E)],
                                  begin: Alignment.topLeft,
                                  end: Alignment.bottomRight,
                                ),
                                borderRadius: BorderRadius.circular(28),
                                boxShadow: [
                                  BoxShadow(
                                    color: const Color(0xFF16A34A).withOpacity(0.35),
                                    blurRadius: 24,
                                    offset: const Offset(0, 12),
                                    spreadRadius: -4,
                                  ),
                                ],
                              ),
                              child: const Icon(Icons.lock_open_rounded, color: Colors.white, size: 52),
                            ),
                          ),
                        );
                      },
                    ),
                  ),
                ),
                const SizedBox(height: 40),
                
                // Title & Subtitle - Premium Typography
                TweenAnimationBuilder<double>(
                  tween: Tween(begin: 0.0, end: 1.0),
                  duration: const Duration(milliseconds: 600),
                  curve: Curves.easeOut,
                  builder: (context, value, child) {
                    return Opacity(
                      opacity: value,
                      child: Transform.translate(
                        offset: Offset(0, 20 * (1 - value)),
                        child: child,
                      ),
                    );
                  },
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Bienvenue',
                        style: Theme.of(context).textTheme.headlineLarge?.copyWith(
                              fontWeight: FontWeight.w900,
                              fontSize: 36,
                              letterSpacing: -0.5,
                              height: 1.2,
                            ),
                      ),
                      const SizedBox(height: 12),
                      Text(
                        'Connectez-vous pour accéder au pairage et au contrôle de vos appareils.',
                        style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                              color: Colors.grey.shade600,
                              height: 1.5,
                              fontSize: 16,
                            ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 32),
                
                // Tabs Card - Premium Glassmorphism
                TweenAnimationBuilder<double>(
                  tween: Tween(begin: 0.0, end: 1.0),
                  duration: const Duration(milliseconds: 800),
                  curve: Curves.easeOut,
                  builder: (context, value, child) {
                    return Opacity(
                      opacity: value,
                      child: Transform.translate(
                        offset: Offset(0, 30 * (1 - value)),
                        child: child,
                      ),
                    );
                  },
                  child: Container(
                    decoration: BoxDecoration(
                      color: Colors.white.withOpacity(0.9),
                      borderRadius: BorderRadius.circular(24),
                      border: Border.all(color: Colors.grey.shade200.withOpacity(0.6)),
                      boxShadow: [
                        BoxShadow(
                          color: Colors.black.withOpacity(0.08),
                          blurRadius: 24,
                          offset: const Offset(0, 8),
                          spreadRadius: -4,
                        ),
                        BoxShadow(
                          color: const Color(0xFF16A34A).withOpacity(0.05),
                          blurRadius: 32,
                          offset: const Offset(0, 16),
                          spreadRadius: -8,
                        ),
                      ],
                    ),
                    child: Column(
                      children: [
                        Container(
                          decoration: BoxDecoration(
                            border: Border(
                              bottom: BorderSide(color: Colors.grey.shade200, width: 1),
                            ),
                          ),
                          child: TabBar(
                            controller: _tabController,
                            labelColor: const Color(0xFF16A34A),
                            labelStyle: const TextStyle(fontWeight: FontWeight.w700, fontSize: 16),
                            unselectedLabelColor: Colors.grey.shade500,
                            unselectedLabelStyle: const TextStyle(fontWeight: FontWeight.w600, fontSize: 16),
                            indicatorColor: const Color(0xFF16A34A),
                            indicatorWeight: 3,
                            indicatorSize: TabBarIndicatorSize.tab,
                            tabs: const [
                              Tab(text: 'Email'),
                              Tab(text: 'QR compte'),
                            ],
                          ),
                        ),
                        SizedBox(
                          height: size.height * 0.42,
                          child: TabBarView(
                            controller: _tabController,
                            physics: const BouncingScrollPhysics(),
                            children: [
                              _buildEmailTab(context),
                              _buildQrTab(context),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
                
                // Error Message - Premium Design
                if (_error != null) ...[
                  const SizedBox(height: 20),
                  TweenAnimationBuilder<double>(
                    tween: Tween(begin: 0.0, end: 1.0),
                    duration: const Duration(milliseconds: 400),
                    curve: Curves.easeOut,
                    builder: (context, value, child) {
                      return Opacity(
                        opacity: value,
                        child: Transform.scale(
                          scale: 0.95 + (0.05 * value),
                          child: child,
                        ),
                      );
                    },
                    child: Container(
                      width: double.infinity,
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        gradient: LinearGradient(
                          colors: [Colors.red.shade50, Colors.red.shade50.withOpacity(0.8)],
                        ),
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(color: Colors.red.shade200),
                        boxShadow: [
                          BoxShadow(
                            color: Colors.red.shade100.withOpacity(0.5),
                            blurRadius: 8,
                            offset: const Offset(0, 4),
                          ),
                        ],
                      ),
                      child: Row(
                        children: [
                          Icon(Icons.error_outline_rounded, color: Colors.red.shade700, size: 24),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Text(
                              _error!,
                              style: TextStyle(
                                color: Colors.red.shade700,
                                fontWeight: FontWeight.w600,
                                fontSize: 14,
                                height: 1.4,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildEmailTab(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(24.0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const SizedBox(height: 8),
          // Email Field - Premium Design
          TextField(
            controller: _emailController,
            keyboardType: TextInputType.emailAddress,
            style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w500),
            decoration: InputDecoration(
              labelText: 'Email',
              labelStyle: TextStyle(color: Colors.grey.shade600, fontWeight: FontWeight.w600),
              prefixIcon: Icon(Icons.email_outlined, color: Colors.grey.shade600),
              filled: true,
              fillColor: Colors.grey.shade50,
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(16),
                borderSide: BorderSide(color: Colors.grey.shade200),
              ),
              enabledBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(16),
                borderSide: BorderSide(color: Colors.grey.shade200),
              ),
              focusedBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(16),
                borderSide: const BorderSide(color: Color(0xFF16A34A), width: 2),
              ),
              contentPadding: const EdgeInsets.symmetric(horizontal: 20, vertical: 18),
            ),
          ),
          const SizedBox(height: 20),
          // Password Field - Premium Design
          TextField(
            controller: _passwordController,
            obscureText: true,
            style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w500),
            decoration: InputDecoration(
              labelText: 'Mot de passe',
              labelStyle: TextStyle(color: Colors.grey.shade600, fontWeight: FontWeight.w600),
              prefixIcon: Icon(Icons.lock_outline_rounded, color: Colors.grey.shade600),
              filled: true,
              fillColor: Colors.grey.shade50,
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(16),
                borderSide: BorderSide(color: Colors.grey.shade200),
              ),
              enabledBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(16),
                borderSide: BorderSide(color: Colors.grey.shade200),
              ),
              focusedBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(16),
                borderSide: const BorderSide(color: Color(0xFF16A34A), width: 2),
              ),
              contentPadding: const EdgeInsets.symmetric(horizontal: 20, vertical: 18),
            ),
          ),
          const Spacer(),
          // Button - Premium Gradient
          SizedBox(
            width: double.infinity,
            height: 56,
            child: ElevatedButton(
              onPressed: _loading ? null : _signIn,
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF16A34A),
                disabledBackgroundColor: Colors.grey.shade300,
                padding: const EdgeInsets.symmetric(vertical: 16),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                elevation: 0,
                shadowColor: const Color(0xFF16A34A).withOpacity(0.3),
              ).copyWith(
                overlayColor: WidgetStateProperty.all(Colors.white.withOpacity(0.1)),
              ),
              child: _loading
                      ? const SizedBox(
                      height: 22,
                      width: 22,
                      child: CircularProgressIndicator(strokeWidth: 2.5, color: Colors.white),
                    )
                  : const Text(
                      'Se connecter',
                      style: TextStyle(fontSize: 17, fontWeight: FontWeight.w700, letterSpacing: 0.3),
                    ),
            ),
          ),
          const SizedBox(height: 16),
          Center(
            child: Text(
              'Ou connectez-vous via le QR de session',
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: Colors.grey.shade500,
                    fontSize: 13,
                    height: 1.4,
                  ),
            ),
                ),
              ],
            ),
    );
  }

  Widget _buildQrTab(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(24.0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
            const SizedBox(height: 12),
              Text(
            'Scannez le QR session depuis la web app pour vous connecter en 1 geste.',
            textAlign: TextAlign.center,
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  color: Colors.grey.shade600,
                  height: 1.6,
                  fontSize: 15,
                ),
          ),
          const Spacer(),
          // QR Icon Container - Premium Design
          TweenAnimationBuilder<double>(
            tween: Tween(begin: 0.0, end: 1.0),
            duration: const Duration(milliseconds: 800),
            curve: Curves.easeOutBack,
            builder: (context, value, child) {
              return Transform.scale(
                scale: value,
                child: Container(
                  height: 200,
                  width: 200,
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      colors: [
                        Colors.grey.shade50,
                        Colors.white,
                      ],
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                    ),
                    borderRadius: BorderRadius.circular(24),
                    border: Border.all(color: Colors.grey.shade200, width: 2),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withOpacity(0.05),
                        blurRadius: 16,
                        offset: const Offset(0, 8),
                      ),
                    ],
                  ),
                  child: Icon(
                    Icons.qr_code_scanner_rounded,
                    size: 88,
                    color: const Color(0xFF16A34A).withOpacity(0.8),
                  ),
                ),
              );
            },
          ),
          const Spacer(),
          // Scan Button - Premium Outline
          SizedBox(
            width: double.infinity,
            height: 56,
            child: OutlinedButton.icon(
              onPressed: _scanSessionQr,
              icon: const Icon(Icons.qr_code_2_rounded, size: 24),
              label: const Text(
                'Scanner le QR de session',
                style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700, letterSpacing: 0.2),
              ),
              style: OutlinedButton.styleFrom(
                foregroundColor: const Color(0xFF16A34A),
                side: const BorderSide(color: Color(0xFF16A34A), width: 2),
                padding: const EdgeInsets.symmetric(vertical: 16),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
              ).copyWith(
                overlayColor: WidgetStateProperty.all(const Color(0xFF16A34A).withOpacity(0.05)),
              ),
            ),
          ),
          const SizedBox(height: 12),
        ],
      ),
    );
  }
}

class QrScannerPage extends StatefulWidget {
  const QrScannerPage({super.key});

  @override
  State<QrScannerPage> createState() => _QrScannerPageState();
}

class _QrScannerPageState extends State<QrScannerPage> {
  bool _scanned = false;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      extendBodyBehindAppBar: true,
      appBar: AppBar(
        backgroundColor: Colors.black.withOpacity(0.3),
        leading: IconButton(
          icon: const Icon(Icons.close, color: Colors.white),
          onPressed: () => Navigator.of(context).pop(),
        ),
        title: const Text(
          'Scanner le QR Code',
          style: TextStyle(color: Colors.white),
        ),
      ),
      body: Stack(
        children: [
          // Scanner
          MobileScanner(
        onDetect: (capture) {
              if (_scanned) return;
          final code = capture.barcodes.first.rawValue;
          if (code != null && code.isNotEmpty) {
                setState(() => _scanned = true);
                HapticFeedback.heavyImpact();
            Navigator.of(context).pop(code);
          }
        },
          ),
          
          // Overlay avec cadre
          Container(
            decoration: BoxDecoration(
              border: Border.all(
                color: Colors.transparent,
                width: 0,
              ),
            ),
            child: Stack(
              children: [
                // Overlay sombre
                ColorFiltered(
                  colorFilter: ColorFilter.mode(
                    Colors.black.withOpacity(0.5),
                    BlendMode.srcOut,
                  ),
                  child: Stack(
                    children: [
                      Container(
                        decoration: const BoxDecoration(
                          color: Colors.black,
                          backgroundBlendMode: BlendMode.dstOut,
                        ),
                      ),
                      Align(
                        alignment: Alignment.center,
                        child: Container(
                          margin: const EdgeInsets.all(40),
                          height: 280,
                          width: 280,
                          decoration: BoxDecoration(
                            color: Colors.white,
                            borderRadius: BorderRadius.circular(24),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
                
                // Cadre animé
                Center(
                  child: Container(
                    height: 280,
                    width: 280,
                    decoration: BoxDecoration(
                      border: Border.all(
                        color: const Color(0xFF16A34A),
                        width: 3,
                      ),
                      borderRadius: BorderRadius.circular(24),
                    ),
                    child: Stack(
                      children: [
                        // Coins animés
                        ..._buildCorners(),
                      ],
                    ),
                  ),
                ),
                
                // Instructions
                Positioned(
                  bottom: 100,
                  left: 0,
                  right: 0,
                  child: Container(
                    margin: const EdgeInsets.symmetric(horizontal: 32),
                    padding: const EdgeInsets.all(20),
                    decoration: BoxDecoration(
                      color: Colors.black.withOpacity(0.7),
                      borderRadius: BorderRadius.circular(16),
                    ),
                    child: const Text(
                      'Placez le QR code dans le cadre',
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        color: Colors.white,
                        fontSize: 16,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  List<Widget> _buildCorners() {
    const cornerSize = 30.0;
    const cornerWidth = 4.0;
    const color = Color(0xFF16A34A);

    return [
      // Top-left
      Positioned(
        top: -cornerWidth / 2,
        left: -cornerWidth / 2,
        child: Container(
          width: cornerSize,
          height: cornerSize,
          decoration: const BoxDecoration(
            border: Border(
              top: BorderSide(color: color, width: cornerWidth),
              left: BorderSide(color: color, width: cornerWidth),
            ),
          ),
        ),
      ),
      // Top-right
      Positioned(
        top: -cornerWidth / 2,
        right: -cornerWidth / 2,
        child: Container(
          width: cornerSize,
          height: cornerSize,
          decoration: const BoxDecoration(
            border: Border(
              top: BorderSide(color: color, width: cornerWidth),
              right: BorderSide(color: color, width: cornerWidth),
            ),
          ),
        ),
      ),
      // Bottom-left
      Positioned(
        bottom: -cornerWidth / 2,
        left: -cornerWidth / 2,
        child: Container(
          width: cornerSize,
          height: cornerSize,
          decoration: const BoxDecoration(
            border: Border(
              bottom: BorderSide(color: color, width: cornerWidth),
              left: BorderSide(color: color, width: cornerWidth),
            ),
          ),
        ),
      ),
      // Bottom-right
      Positioned(
        bottom: -cornerWidth / 2,
        right: -cornerWidth / 2,
        child: Container(
          width: cornerSize,
          height: cornerSize,
          decoration: const BoxDecoration(
            border: Border(
              bottom: BorderSide(color: color, width: cornerWidth),
              right: BorderSide(color: color, width: cornerWidth),
            ),
          ),
        ),
      ),
    ];
  }
}

class HomePage extends ConsumerStatefulWidget {
  const HomePage({super.key});

  @override
  ConsumerState<HomePage> createState() => _HomePageState();
}

class _HomePageState extends ConsumerState<HomePage>
    with SingleTickerProviderStateMixin {
  late AnimationController _fabAnimController;
  final _scaffoldKey = GlobalKey<ScaffoldState>();
  Timer? _heartbeatTimer;
  Timer? _autoSyncTimer;
  Timer? _campaignPollTimer;
  Timer? _updateCheckTimer;
  DateTime? _lastHeartbeatSnackAt;

  @override
  void initState() {
    super.initState();
    _fabAnimController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 300),
    );
    _fabAnimController.forward();
    
    // Start heartbeat timer to keep device "online"
    _startHeartbeat();

    // Check for updates now + show dialog + every 5 minutes
    scheduleMicrotask(() async {
      await ref.read(appUpdateServiceProvider).clearIgnored();
      await ref.read(appProvider.notifier).checkForUpdate();
      _showUpdateDialogIfAvailable();
    });
    _updateCheckTimer = Timer.periodic(const Duration(minutes: 5), (_) {
      ref.read(appProvider.notifier).checkForUpdate();
    });

    // Charger la liste SIM dès l'arrivée (pour le sélecteur SIM).
    scheduleMicrotask(() => ref.read(appProvider.notifier).refreshSimCards());

    // Auto-sync: permet de réagir quand une campagne démarre côté web.
    _startAutoSync();

    // Poll campagne active + auto-trigger sync if campaign running but 0 sent
    scheduleMicrotask(() => ref.read(appProvider.notifier).refreshActiveCampaign(silent: true));
    _campaignPollTimer?.cancel();
    _campaignPollTimer = Timer.periodic(const Duration(seconds: 3), (_) {
      final notif = ref.read(appProvider.notifier);
      notif.refreshActiveCampaign(silent: true);
      // Auto-refresh outbox so dashboard shows latest messages
      final st = ref.read(appProvider);
      if (st.campaignStatusSending == 'running' && st.outboxHistory.isEmpty) {
        notif.refreshOutboxHistory(silent: true);
      }
    });
  }



  void _startAutoSync() {
    // Premier check apr\u00e8s 3s : forcer le service background s'il y a une campagne
    Future<void>.delayed(const Duration(seconds: 3), () {
      if (!mounted) return;
      _ensureBackgroundSending();
    });

    _autoSyncTimer?.cancel();
    _autoSyncTimer = Timer.periodic(const Duration(seconds: 10), (_) {
      if (!mounted) return;
      _ensureBackgroundSending();
    });
  }

  Future<void> _ensureBackgroundSending() async {
    final appState = ref.read(appProvider);
    if (!appState.authenticated) return;
    if (!(appState.deviceToken?.isNotEmpty ?? false)) return;

    final hasActiveCampaign = appState.campaignStatusSending == 'running' ||
        appState.campaignStatusSending == 'queued';

    if (hasActiveCampaign) {
      try {
        await BackgroundSyncService.setEnabled(true);
        await BackgroundSyncService.setPaused(false);
        await BackgroundSyncService.setForegroundLock(false);
        final running = await BackgroundSyncService.isRunning();
        if (!running) {
          await BackgroundSyncService.init();
          await BackgroundSyncService.start();
        }
        // Kick the background isolate so it re-reads prefs immediately
        FlutterForegroundTask.sendDataToTask('kick');
      } catch (_) {}

      // If campaign running but 0 SMS sent after service is active, do a direct sync as kickstart
      final sentCount = appState.campaignSentCount ?? 0;
      if (sentCount == 0 && !appState.syncing) {
        ref.read(appProvider.notifier).syncOnce(silentIfEmpty: true);
      }
    } else {
      // No active campaign: fallback if bg not running at all
      final bgRunning = await BackgroundSyncService.isRunning();
      if (!bgRunning && !appState.syncing) {
        ref.read(appProvider.notifier).syncOnce(silentIfEmpty: true);
      }
    }
  }

  void _startHeartbeat() {
    // Send heartbeat immediately
    _sendHeartbeat();
    
    // Then send every 2 minutes
    _heartbeatTimer = Timer.periodic(const Duration(minutes: 2), (timer) {
      _sendHeartbeat();
    });
  }

  Future<void> _sendHeartbeat() async {
    final appState = ref.read(appProvider);
    final deviceToken = appState.deviceToken;
    
    if (deviceToken != null && deviceToken.isNotEmpty) {
      try {
        final payload = await ref.read(deviceServiceProvider).sendHeartbeatVerbose(
              deviceToken: deviceToken,
            );
        await ref.read(appProvider.notifier).refreshDeviceStatus(silent: true);
        // Message discret (évite de spammer l’utilisateur)
        ref.read(appProvider.notifier).setLastStatus(
              'Appareil en ligne${payload['device_name'] != null ? ' • ${payload['device_name']}' : ''}',
            );
      } catch (e) {
        ref.read(appProvider.notifier).setLastStatus('Heartbeat ÉCHEC: $e');
        final now = DateTime.now();
        final shouldShow = _lastHeartbeatSnackAt == null ||
            now.difference(_lastHeartbeatSnackAt!) > const Duration(minutes: 2);
        if (mounted && shouldShow) {
          _lastHeartbeatSnackAt = now;
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text('Heartbeat échoué: $e'),
              backgroundColor: Colors.red.shade700,
            ),
          );
        }
      }
    }
  }

  void _showUpdateDialogIfAvailable() {
    Future.delayed(const Duration(seconds: 2), () {
      if (!mounted) return;
      final appState = ref.read(appProvider);
      if (appState.updateVersion == null) return;
      _showUpdateDialog(appState.updateVersion!, appState.updateUrl ?? '', appState.updateNotes);
    });
  }

  void _showUpdateDialog(String version, String url, String? notes) {
    if (!mounted) return;
    showDialog<void>(
      context: context,
      barrierDismissible: true,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: const Color(0xFFF59E0B).withOpacity(0.15),
                borderRadius: BorderRadius.circular(12),
              ),
              child: const Icon(Icons.system_update_rounded, color: Color(0xFFF59E0B), size: 28),
            ),
            const SizedBox(width: 12),
            Expanded(child: Text('Mise a jour $version', style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold))),
          ],
        ),
        content: SingleChildScrollView(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              const Text('Une nouvelle version est disponible.'),
              if (notes != null && notes.isNotEmpty) ...[
                const SizedBox(height: 12),
                const Text('Nouveautes :', style: TextStyle(fontWeight: FontWeight.w700)),
                const SizedBox(height: 6),
                Text(notes, style: const TextStyle(fontSize: 13)),
              ],
            ],
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(),
            child: const Text('Plus tard'),
          ),
          FilledButton.icon(
            onPressed: () async {
              if (url.isNotEmpty) {
                await ref.read(appUpdateServiceProvider).openApkDownload(url);
              }
            },
            icon: const Icon(Icons.download_rounded, size: 18),
            label: const Text('Telecharger'),
            style: FilledButton.styleFrom(
              backgroundColor: const Color(0xFF16A34A),
            ),
          ),
        ],
      ),
    );
  }

  Future<void> _manualCheckForUpdate() async {
    await ref.read(appUpdateServiceProvider).clearIgnored();
    await ref.read(appProvider.notifier).checkForUpdate();
    if (!mounted) return;
    final appState = ref.read(appProvider);
    if (appState.updateVersion != null) {
      _showUpdateDialog(appState.updateVersion!, appState.updateUrl ?? '', appState.updateNotes);
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: const Text('Vous avez la derniere version.'),
          backgroundColor: const Color(0xFF16A34A),
          behavior: SnackBarBehavior.floating,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        ),
      );
    }
  }

  @override
  void dispose() {
    _heartbeatTimer?.cancel();
    _autoSyncTimer?.cancel();
    _campaignPollTimer?.cancel();
    _updateCheckTimer?.cancel();
    _fabAnimController.dispose();
    super.dispose();
  }

  void _showLogoutDialog() {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: const Text('Désappairer l\'appareil ?'),
        content: const Text(
          'Voulez-vous vraiment effacer le token de cet appareil ?',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Annuler'),
          ),
          FilledButton(
            onPressed: () {
              Navigator.pop(context);
              ref.read(appProvider.notifier).clearToken();
              HapticFeedback.mediumImpact();
            },
            style: FilledButton.styleFrom(
              backgroundColor: Colors.red.shade600,
            ),
            child: const Text('Déconnecter'),
          ),
        ],
      ),
    );
  }

  void _showAccountLogoutDialog() {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: const Text('Se déconnecter du compte ?'),
        content: const Text(
          'Vous serez déconnecté du compte, mais l’appareil restera pairé (pas besoin de rescanner).',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Annuler'),
          ),
          FilledButton(
            onPressed: () async {
              Navigator.pop(context);
              HapticFeedback.mediumImpact();
              await ref.read(appProvider.notifier).signOutAccount();
            },
            child: const Text('Se déconnecter'),
          ),
        ],
      ),
    );
  }

  void _setSection(AppSection section) {
    ref.read(sectionProvider.notifier).state = section;
  }

  @override
  Widget build(BuildContext context) {
    final appState = ref.watch(appProvider);
    final notifier = ref.read(appProvider.notifier);
    final section = ref.watch(sectionProvider);

    return Scaffold(
      key: _scaffoldKey,
      extendBodyBehindAppBar: true,
      drawer: _AppDrawer(
        selected: section,
        onSelect: _setSection,
        onLogout: _showLogoutDialog,
        onCheckUpdate: _manualCheckForUpdate,
      ),
      appBar: AppBar(
        elevation: 0,
        backgroundColor: Colors.transparent,
        leading: IconButton(
          icon: const Icon(Icons.menu_rounded, color: Colors.white),
          onPressed: () => _scaffoldKey.currentState?.openDrawer(),
          tooltip: 'Menu',
        ),
        flexibleSpace: Container(
          decoration: BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [
                const Color(0xFF16A34A).withOpacity(0.9),
                const Color(0xFF22C55E).withOpacity(0.9),
              ],
            ),
          ),
        ),
        title: Text(
          _sectionTitle(section),
          style: const TextStyle(
            color: Colors.white,
            fontWeight: FontWeight.bold,
            fontSize: 22,
          ),
        ),
        centerTitle: true,
        actions: [
          IconButton(
            icon: const Icon(Icons.logout_rounded, color: Colors.white),
            onPressed: _showAccountLogoutDialog,
            tooltip: 'Se déconnecter (compte)',
          ),
        ],
      ),
      body: Stack(
        children: [
          Container(
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
                colors: [
                  const Color(0xFF16A34A).withOpacity(0.05),
                  Colors.white,
                ],
              ),
            ),
            child: RefreshIndicator(
              onRefresh: () async {
                HapticFeedback.mediumImpact();
                switch (section) {
                  case AppSection.dashboard:
                    await notifier.syncOnce();
                    break;
                  case AppSection.campaigns:
                    break;
                  case AppSection.messages:
                    await notifier.refreshInboxMessages(silent: false);
                    break;
                  case AppSection.history:
                    await notifier.refreshOutboxHistory(silent: false);
                    break;
                  case AppSection.subscription:
                    await notifier.refreshSubscription(silent: false);
                    break;
                  case AppSection.devices:
                    await notifier.refreshDeviceStatus(silent: false);
                    break;
                  case AppSection.profile:
                    await notifier.refreshAccountInfo();
                    await notifier.refreshSubscription(silent: true);
                    break;
                }
              },
              color: const Color(0xFF16A34A),
              child: _buildSectionContent(section, appState, notifier),
            ),
          ),
          if (appState.updateVersion != null)
            Positioned(
              top: MediaQuery.of(context).padding.top + kToolbarHeight + 8,
              left: 16,
              right: 16,
              child: _UpdateBanner(appState: appState, notifier: notifier),
            ),
        ],
      ),
    );
  }

  String _sectionTitle(AppSection section) {
    switch (section) {
      case AppSection.dashboard:
        return 'Dashboard';
      case AppSection.campaigns:
        return 'Campagnes';
      case AppSection.messages:
        return 'Messages';
      case AppSection.history:
        return 'Messages';
      case AppSection.subscription:
        return 'Mon abonnement';
      case AppSection.devices:
        return 'Appareils';
      case AppSection.profile:
        return 'Profil';
    }
  }

  Widget _buildSectionContent(
    AppSection section,
    AppState appState,
    AppNotifier notifier,
  ) {
    switch (section) {
      case AppSection.dashboard:
        return _DashboardSection(appState: appState, notifier: notifier);
      case AppSection.campaigns:
        return _CampaignsSection(appState: appState, notifier: notifier, onSetSection: _setSection);
      case AppSection.messages:
        return _MessagesSection(appState: appState, notifier: notifier);
      case AppSection.history:
        return _HistorySection(appState: appState, notifier: notifier);
      case AppSection.subscription:
        return _SubscriptionSection(appState: appState, notifier: notifier);
      case AppSection.devices:
        return _DevicesSection(appState: appState, notifier: notifier);
      case AppSection.profile:
        return _ProfileSection(appState: appState, notifier: notifier);
    }
  }
}

// ============================================================================
// COMPOSANTS RÉUTILISABLES
// ============================================================================

/// Bouton animé avec effet de scaling au press
class _AnimatedButton extends StatefulWidget {
  const _AnimatedButton({
    required this.onPressed,
    required this.icon,
    required this.label,
    this.isPrimary = false,
    this.isLoading = false,
  });

  final VoidCallback? onPressed;
  final IconData icon;
  final String label;
  final bool isPrimary;
  final bool isLoading;

  @override
  State<_AnimatedButton> createState() => _AnimatedButtonState();
}

class _AnimatedButtonState extends State<_AnimatedButton>
    with SingleTickerProviderStateMixin {
  late AnimationController _controller;
  late Animation<double> _scaleAnimation;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 100),
    );
    _scaleAnimation = Tween<double>(begin: 1.0, end: 0.95).animate(
      CurvedAnimation(parent: _controller, curve: Curves.easeInOut),
    );
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return ScaleTransition(
      scale: _scaleAnimation,
      child: ElevatedButton.icon(
        onPressed: widget.onPressed == null
            ? null
            : () {
                _controller.forward().then((_) => _controller.reverse());
                widget.onPressed!();
              },
        style: ElevatedButton.styleFrom(
          backgroundColor: widget.isPrimary
              ? const Color(0xFF16A34A)
              : Colors.white,
          foregroundColor: widget.isPrimary
              ? Colors.white
              : const Color(0xFF16A34A),
          elevation: widget.isPrimary ? 2 : 0,
          padding: const EdgeInsets.symmetric(vertical: 16),
          side: widget.isPrimary
              ? null
              : BorderSide(color: Colors.grey.shade300, width: 1.5),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(16),
          ),
        ),
        icon: widget.isLoading
            ? SizedBox(
                width: 20,
                height: 20,
                child: CircularProgressIndicator(
                  strokeWidth: 2,
                  color: widget.isPrimary ? Colors.white : const Color(0xFF16A34A),
                ),
              )
            : Icon(widget.icon, size: 22),
        label: Text(
          widget.label,
          style: const TextStyle(
            fontSize: 15,
            fontWeight: FontWeight.w600,
          ),
        ),
      ),
    );
  }
}

/// Card de statut avec icône et message
class _StatusCard extends StatelessWidget {
  const _StatusCard({required this.message});

  final String message;

  @override
  Widget build(BuildContext context) {
    final isSuccess = message.toLowerCase().contains('enregistré') ||
        message.toLowerCase().contains('success');
    final isError = message.toLowerCase().contains('erreur') ||
        message.toLowerCase().contains('error');

    Color bgColor;
    Color textColor;
    IconData icon;

    if (isSuccess) {
      bgColor = const Color(0xFF16A34A).withOpacity(0.1);
      textColor = const Color(0xFF16A34A);
      icon = Icons.check_circle_rounded;
    } else if (isError) {
      bgColor = Colors.red.shade50;
      textColor = Colors.red.shade700;
      icon = Icons.error_rounded;
    } else {
      bgColor = Colors.blue.shade50;
      textColor = Colors.blue.shade700;
      icon = Icons.info_rounded;
    }

    return TweenAnimationBuilder<double>(
      duration: const Duration(milliseconds: 300),
      tween: Tween(begin: 0.0, end: 1.0),
      builder: (context, value, child) {
        return Opacity(
          opacity: value,
          child: Transform.translate(
            offset: Offset(0, 20 * (1 - value)),
            child: child,
          ),
        );
      },
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: bgColor,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(
            color: textColor.withOpacity(0.3),
            width: 1,
          ),
        ),
        child: Row(
          children: [
            Icon(icon, color: textColor, size: 24),
            const SizedBox(width: 12),
            Expanded(
              child: Text(
                message,
                style: TextStyle(
                  color: textColor,
                  fontSize: 14,
                  fontWeight: FontWeight.w500,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Card moderne avec support gradient
class _ModernCard extends StatelessWidget {
  const _ModernCard({
    required this.child,
    this.gradient,
  });

  final Widget child;
  final Gradient? gradient;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        gradient: gradient,
        color: gradient == null ? Colors.white : null,
        borderRadius: BorderRadius.circular(24),
        border: gradient == null
            ? Border.all(color: Colors.grey.shade200, width: 1)
            : null,
        boxShadow: [
          BoxShadow(
            color: (gradient != null
                    ? const Color(0xFF16A34A)
                    : Colors.black)
                .withOpacity(gradient != null ? 0.2 : 0.05),
            blurRadius: gradient != null ? 24 : 10,
            offset: Offset(0, gradient != null ? 8 : 2),
          ),
        ],
      ),
      padding: const EdgeInsets.all(24),
      child: child,
    );
  }
}

/// Tile pour afficher un message dans la liste
class _MessageTile extends StatelessWidget {
  const _MessageTile({
    required this.message,
    required this.index,
  });

  final Message message;
  final int index;

  @override
  Widget build(BuildContext context) {
    return TweenAnimationBuilder<double>(
      duration: Duration(milliseconds: 300 + (index * 50)),
      tween: Tween(begin: 0.0, end: 1.0),
      builder: (context, value, child) {
        return Opacity(
          opacity: value,
          child: Transform.translate(
            offset: Offset(0, 30 * (1 - value)),
            child: child,
          ),
        );
      },
      child: Container(
        margin: EdgeInsets.only(
          bottom: index < 9 ? 12 : 0,
        ),
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: Colors.grey.shade50,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(
            color: Colors.grey.shade200,
            width: 1,
          ),
        ),
        child: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: const Color(0xFF16A34A).withOpacity(0.1),
                borderRadius: BorderRadius.circular(12),
              ),
              child: const Icon(
                Icons.sms_rounded,
                color: Color(0xFF16A34A),
                size: 20,
              ),
            ),
            const SizedBox(width: 16),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    message.to,
                    style: const TextStyle(
                      fontWeight: FontWeight.w600,
                      fontSize: 15,
                      color: Colors.black87,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    message.content,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      fontSize: 13,
                      color: Colors.grey.shade600,
                      height: 1.4,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(width: 12),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: Colors.grey.shade300),
              ),
              child: Text(
                '#${message.tryCount}',
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                  color: Colors.grey.shade700,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ============================================================================//
// CAMPAIGNS SECTION
// ============================================================================//

class _CampaignsSection extends ConsumerStatefulWidget {
  const _CampaignsSection({
    required this.appState,
    required this.notifier,
    required this.onSetSection,
  });

  final AppState appState;
  final AppNotifier notifier;
  final ValueChanged<AppSection> onSetSection;

  @override
  ConsumerState<_CampaignsSection> createState() => _CampaignsSectionState();
}

class _CampaignsSectionState extends ConsumerState<_CampaignsSection> {
  List<Map<String, dynamic>> _campaigns = [];
  bool _loading = true;
  String? _error;
  String _filterStatus = 'all';

  // Pagination
  int _page = 1;
  int _totalCampaigns = 0;
  bool _loadingMore = false;
  final _scrollCtrl = ScrollController();
  static const _pageSize = 20;

  // Create campaign form
  bool _showCreate = false;
  bool _creating = false;
  final _nameCtrl = TextEditingController();
  final _messageCtrl = TextEditingController();
  final _contactsCtrl = TextEditingController();
  int _priority = 0;
  int? _simSlot;
  List<Map<String, dynamic>> _templates = [];
  bool _importingFile = false;
  int _importedCount = 0;

  // Detail view
  Map<String, dynamic>? _detailCampaign;
  Map<String, dynamic>? _detailStats;
  bool _loadingDetail = false;

  @override
  void initState() {
    super.initState();
    _loadCampaigns();
    _scrollCtrl.addListener(_onScroll);
  }

  @override
  void dispose() {
    _nameCtrl.dispose();
    _messageCtrl.dispose();
    _contactsCtrl.dispose();
    _scrollCtrl.dispose();
    super.dispose();
  }

  void _onScroll() {
    if (_scrollCtrl.position.pixels >= _scrollCtrl.position.maxScrollExtent - 200) {
      _loadMoreCampaigns();
    }
  }

  Future<void> _loadCampaigns() async {
    final token = widget.appState.deviceToken;
    if (token == null) return;
    setState(() { _loading = true; _error = null; _page = 1; });
    try {
      final res = await ref.read(deviceServiceProvider).listCampaigns(
        deviceToken: token,
        page: 1,
        limit: _pageSize,
        status: _filterStatus == 'all' ? null : _filterStatus,
      );
      final list = (res['campaigns'] as List?) ?? [];
      setState(() {
        _campaigns = list.map((e) => Map<String, dynamic>.from(e as Map)).toList();
        _totalCampaigns = (res['total'] as int?) ?? list.length;
        _loading = false;
      });
    } catch (e) {
      setState(() { _error = e.toString(); _loading = false; });
    }
  }

  Future<void> _loadMoreCampaigns() async {
    if (_loadingMore || _campaigns.length >= _totalCampaigns) return;
    final token = widget.appState.deviceToken;
    if (token == null) return;
    setState(() => _loadingMore = true);
    try {
      final nextPage = _page + 1;
      final res = await ref.read(deviceServiceProvider).listCampaigns(
        deviceToken: token,
        page: nextPage,
        limit: _pageSize,
        status: _filterStatus == 'all' ? null : _filterStatus,
      );
      final list = (res['campaigns'] as List?) ?? [];
      setState(() {
        _campaigns.addAll(list.map((e) => Map<String, dynamic>.from(e as Map)));
        _page = nextPage;
        _loadingMore = false;
      });
    } catch (_) {
      setState(() => _loadingMore = false);
    }
  }

  Future<void> _importContactsFromFile() async {
    try {
      final result = await FilePicker.platform.pickFiles(
        type: FileType.custom,
        allowedExtensions: ['txt', 'csv', 'xlsx', 'xls'],
        allowMultiple: false,
      );
      if (result == null || result.files.isEmpty) return;
      setState(() => _importingFile = true);

      final file = result.files.first;
      final path = file.path;
      if (path == null) {
        setState(() => _importingFile = false);
        return;
      }

      final extension = file.extension?.toLowerCase() ?? '';
      List<String> numbers = [];

      if (extension == 'txt') {
        final content = await File(path).readAsString();
        numbers = _extractNumbers(content);
      } else if (extension == 'csv') {
        final content = await File(path).readAsString();
        final lines = content.split(RegExp(r'[\r\n]+'));
        for (final line in lines) {
          final cells = line.split(RegExp(r'[,;\t]+'));
          for (final cell in cells) {
            final val = cell.replaceAll('"', '').trim();
            if (_looksLikePhone(val)) numbers.add(val);
          }
        }
      } else if (extension == 'xlsx' || extension == 'xls') {
        final bytes = await File(path).readAsBytes();
        final excel = xl.Excel.decodeBytes(bytes);
        for (final sheet in excel.tables.keys) {
          for (final row in excel.tables[sheet]!.rows) {
            for (final cell in row) {
              if (cell == null) continue;
              final val = cell.value?.toString().trim() ?? '';
              if (_looksLikePhone(val)) numbers.add(val);
            }
          }
        }
      }

      numbers = numbers.toSet().toList();

      if (numbers.isNotEmpty) {
        final existing = _contactsCtrl.text.trim();
        if (existing.isNotEmpty) {
          _contactsCtrl.text = '$existing\n${numbers.join('\n')}';
        } else {
          _contactsCtrl.text = numbers.join('\n');
        }
        _importedCount = numbers.length;
      }

      setState(() => _importingFile = false);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('${numbers.length} numeros importes depuis ${file.name}'),
            backgroundColor: numbers.isNotEmpty ? const Color(0xFF16A34A) : Colors.orange,
          ),
        );
      }
    } catch (e) {
      setState(() => _importingFile = false);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Erreur import: $e'), backgroundColor: Colors.red),
        );
      }
    }
  }

  List<String> _extractNumbers(String content) {
    final lines = content.split(RegExp(r'[\n,;]+'));
    return lines
        .map((e) => e.trim())
        .where((e) => _looksLikePhone(e))
        .toList();
  }

  bool _looksLikePhone(String val) {
    if (val.isEmpty) return false;
    final cleaned = val.replaceAll(RegExp(r'[\s\-\.\(\)]'), '');
    return RegExp(r'^\+?\d{7,15}$').hasMatch(cleaned);
  }

  Future<void> _loadTemplates() async {
    final token = widget.appState.deviceToken;
    if (token == null) return;
    try {
      final res = await ref.read(deviceServiceProvider).listTemplates(deviceToken: token);
      setState(() {
        _templates = ((res['templates'] as List?) ?? [])
            .map((e) => Map<String, dynamic>.from(e as Map))
            .toList();
      });
    } catch (_) {}
  }

  Future<void> _createCampaign() async {
    final token = widget.appState.deviceToken;
    if (token == null) return;

    final name = _nameCtrl.text.trim();
    final message = _messageCtrl.text.trim();
    final rawContacts = _contactsCtrl.text.trim();

    if (name.isEmpty || message.isEmpty || rawContacts.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Remplissez tous les champs')),
      );
      return;
    }

    final contacts = rawContacts
        .split(RegExp(r'[\n,;]+'))
        .map((e) => e.trim())
        .where((e) => e.isNotEmpty)
        .toList();

    if (contacts.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Aucun contact valide')),
      );
      return;
    }

    setState(() => _creating = true);
    try {
      await ref.read(deviceServiceProvider).createCampaign(
        deviceToken: token,
        name: name,
        message: message,
        contacts: contacts,
        simSlotIndex: _simSlot,
        priority: _priority,
      );
      _nameCtrl.clear();
      _messageCtrl.clear();
      _contactsCtrl.clear();
      setState(() { _showCreate = false; _creating = false; _priority = 0; _simSlot = null; });
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Campagne lancee avec succes !'), backgroundColor: Color(0xFF16A34A)),
      );
      _loadCampaigns();
      widget.notifier.refreshActiveCampaign(silent: false);
    } catch (e) {
      setState(() => _creating = false);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Erreur: $e'), backgroundColor: Colors.red),
      );
    }
  }

  Future<void> _openDetail(String id) async {
    final token = widget.appState.deviceToken;
    if (token == null) return;
    setState(() { _loadingDetail = true; });
    try {
      final res = await ref.read(deviceServiceProvider).campaignDetail(
        deviceToken: token, campaignId: id,
      );
      setState(() {
        _detailCampaign = Map<String, dynamic>.from(res['campaign'] as Map);
        _detailStats = Map<String, dynamic>.from((res['message_stats'] as Map?) ?? {});
        _loadingDetail = false;
      });
    } catch (e) {
      setState(() { _loadingDetail = false; });
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Erreur: $e')),
      );
    }
  }

  Future<void> _controlCampaign(String action) async {
    final token = widget.appState.deviceToken;
    final id = _detailCampaign?['id']?.toString();
    if (token == null || id == null) return;
    try {
      await ref.read(deviceServiceProvider).campaignControl(
        action: action, campaignId: id, deviceToken: token,
      );
      await _openDetail(id);
      _loadCampaigns();
      widget.notifier.refreshActiveCampaign(silent: false);
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Erreur: $e')),
      );
    }
  }

  Color _statusColor(String? status) {
    switch (status) {
      case 'running': return const Color(0xFF16A34A);
      case 'paused': return Colors.orange;
      case 'queued': return Colors.blue;
      case 'completed': return Colors.grey;
      case 'canceled': return Colors.red;
      default: return Colors.grey;
    }
  }

  String _statusLabel(String? status) {
    switch (status) {
      case 'running': return 'En cours';
      case 'paused': return 'En pause';
      case 'queued': return 'En attente';
      case 'completed': return 'Terminee';
      case 'canceled': return 'Annulee';
      default: return status ?? '-';
    }
  }

  String _priorityLabel(int? p) {
    switch (p) {
      case 2: return 'Urgente';
      case 1: return 'Haute';
      default: return 'Normale';
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_detailCampaign != null) return _buildDetail();
    if (_showCreate) return _buildCreateForm();
    return _buildList();
  }

  Widget _buildList() {
    const green = Color(0xFF16A34A);
    final hasMore = _campaigns.length < _totalCampaigns;

    return ListView(
      controller: _scrollCtrl,
      physics: const BouncingScrollPhysics(),
      padding: const EdgeInsets.only(top: 120, left: 16, right: 16, bottom: 100),
      children: [
        // Filter chips
        SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          child: Row(
            children: [
              for (final f in [
                {'key': 'all', 'label': 'Toutes'},
                {'key': 'running', 'label': 'En cours'},
                {'key': 'paused', 'label': 'En pause'},
                {'key': 'completed', 'label': 'Terminees'},
                {'key': 'canceled', 'label': 'Annulees'},
              ])
                Padding(
                  padding: const EdgeInsets.only(right: 8),
                  child: ChoiceChip(
                    label: Text(f['label']!),
                    selected: _filterStatus == f['key'],
                    onSelected: (_) {
                      setState(() => _filterStatus = f['key']!);
                      _loadCampaigns();
                    },
                    selectedColor: green.withValues(alpha: 0.15),
                    labelStyle: TextStyle(
                      color: _filterStatus == f['key'] ? green : Colors.grey.shade700,
                      fontWeight: _filterStatus == f['key'] ? FontWeight.w600 : FontWeight.normal,
                    ),
                  ),
                ),
            ],
          ),
        ),
        const SizedBox(height: 16),

        // New campaign button
        SizedBox(
          width: double.infinity,
          height: 50,
          child: FilledButton.icon(
            onPressed: () {
              _loadTemplates();
              setState(() => _showCreate = true);
            },
            icon: const Icon(Icons.add_rounded),
            label: const Text('Nouvelle campagne', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600)),
            style: FilledButton.styleFrom(
              backgroundColor: green,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
            ),
          ),
        ),
        const SizedBox(height: 16),

        if (_loading)
          const Center(child: Padding(padding: EdgeInsets.all(40), child: CircularProgressIndicator()))
        else if (_error != null)
          Center(child: Padding(
            padding: const EdgeInsets.all(40),
            child: Text(_error!, style: const TextStyle(color: Colors.red)),
          ))
        else if (_campaigns.isEmpty)
          Center(child: Padding(
            padding: const EdgeInsets.all(40),
            child: Column(
              children: [
                Icon(Icons.campaign_outlined, size: 48, color: Colors.grey.shade300),
                const SizedBox(height: 12),
                Text('Aucune campagne', style: TextStyle(color: Colors.grey.shade500, fontSize: 16)),
              ],
            ),
          ))
        else
          ..._campaigns.map((c) {
            final status = c['status']?.toString() ?? '';
            final total = c['total_count'] ?? 0;
            final sent = c['sent_count'] ?? 0;
            final progress = total > 0 ? sent / total : 0.0;

            return GestureDetector(
              onTap: () => _openDetail(c['id'].toString()),
              child: Container(
                margin: const EdgeInsets.only(bottom: 10),
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: Colors.grey.shade200),
                  boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.03), blurRadius: 8, offset: const Offset(0, 2))],
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: Text(
                            c['name']?.toString() ?? 'Sans nom',
                            style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 15),
                            maxLines: 1, overflow: TextOverflow.ellipsis,
                          ),
                        ),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                          decoration: BoxDecoration(
                            color: _statusColor(status).withValues(alpha: 0.12),
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: Text(
                            _statusLabel(status),
                            style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: _statusColor(status)),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 10),
                    ClipRRect(
                      borderRadius: BorderRadius.circular(4),
                      child: LinearProgressIndicator(
                        value: progress,
                        minHeight: 6,
                        backgroundColor: Colors.grey.shade100,
                        valueColor: AlwaysStoppedAnimation(_statusColor(status)),
                      ),
                    ),
                    const SizedBox(height: 8),
                    Row(
                      children: [
                        Text('$sent / $total SMS', style: TextStyle(fontSize: 12, color: Colors.grey.shade600)),
                        const Spacer(),
                        if ((c['priority'] ?? 0) > 0)
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                            decoration: BoxDecoration(
                              color: (c['priority'] == 2 ? Colors.red : Colors.orange).withValues(alpha: 0.1),
                              borderRadius: BorderRadius.circular(4),
                            ),
                            child: Text(
                              _priorityLabel(c['priority']),
                              style: TextStyle(fontSize: 10, fontWeight: FontWeight.w600, color: c['priority'] == 2 ? Colors.red : Colors.orange),
                            ),
                          ),
                        const SizedBox(width: 8),
                        Icon(Icons.chevron_right_rounded, size: 20, color: Colors.grey.shade400),
                      ],
                    ),
                  ],
                ),
              ),
            );
          }),

        if (_loadingMore)
          const Padding(
            padding: EdgeInsets.symmetric(vertical: 20),
            child: Center(child: CircularProgressIndicator(strokeWidth: 2)),
          )
        else if (hasMore && !_loading && _campaigns.isNotEmpty)
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 12),
            child: Center(
              child: TextButton.icon(
                onPressed: _loadMoreCampaigns,
                icon: const Icon(Icons.expand_more_rounded),
                label: Text(
                  'Charger plus (${_campaigns.length}/$_totalCampaigns)',
                  style: const TextStyle(fontSize: 13),
                ),
              ),
            ),
          )
        else if (!_loading && _campaigns.isNotEmpty)
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 12),
            child: Center(
              child: Text(
                '${_campaigns.length} campagne${_campaigns.length > 1 ? 's' : ''} au total',
                style: TextStyle(fontSize: 12, color: Colors.grey.shade500),
              ),
            ),
          ),
      ],
    );
  }

  Widget _buildCreateForm() {
    const green = Color(0xFF16A34A);
    final sims = widget.appState.availableSims;

    return ListView(
      physics: const BouncingScrollPhysics(),
      padding: const EdgeInsets.only(top: 120, left: 16, right: 16, bottom: 40),
      children: [
        Row(
          children: [
            IconButton(
              onPressed: () => setState(() => _showCreate = false),
              icon: const Icon(Icons.arrow_back_rounded),
            ),
            const Text('Nouvelle campagne', style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold)),
          ],
        ),
        const SizedBox(height: 16),

        // Name
        TextField(
          controller: _nameCtrl,
          decoration: InputDecoration(
            labelText: 'Nom de la campagne',
            hintText: 'Ex: Promo Noel 2026',
            prefixIcon: const Icon(Icons.campaign_rounded),
            border: OutlineInputBorder(borderRadius: BorderRadius.circular(14)),
          ),
        ),
        const SizedBox(height: 14),

        // Templates
        if (_templates.isNotEmpty) ...[
          SizedBox(
            height: 40,
            child: ListView(
              scrollDirection: Axis.horizontal,
              children: [
                for (final t in _templates)
                  Padding(
                    padding: const EdgeInsets.only(right: 8),
                    child: ActionChip(
                      avatar: const Icon(Icons.text_snippet_rounded, size: 16),
                      label: Text(t['name']?.toString() ?? '', style: const TextStyle(fontSize: 12)),
                      onPressed: () {
                        _messageCtrl.text = t['body']?.toString() ?? '';
                      },
                    ),
                  ),
              ],
            ),
          ),
          const SizedBox(height: 10),
        ],

        // Message
        TextField(
          controller: _messageCtrl,
          maxLines: 4,
          decoration: InputDecoration(
            labelText: 'Message SMS',
            hintText: 'Bonjour {nom}, profitez de notre promo...',
            alignLabelWithHint: true,
            prefixIcon: const Padding(padding: EdgeInsets.only(bottom: 60), child: Icon(Icons.sms_rounded)),
            border: OutlineInputBorder(borderRadius: BorderRadius.circular(14)),
          ),
        ),
        Padding(
          padding: const EdgeInsets.only(top: 4, left: 4),
          child: Text(
            '${_messageCtrl.text.length} caracteres',
            style: TextStyle(fontSize: 11, color: Colors.grey.shade500),
          ),
        ),
        const SizedBox(height: 14),

        // Contacts
        TextField(
          controller: _contactsCtrl,
          maxLines: 5,
          decoration: InputDecoration(
            labelText: 'Numeros de telephone',
            hintText: 'Un numero par ligne, ou separes par virgule\n+22507xxxxxxxx\n+33612345678',
            alignLabelWithHint: true,
            prefixIcon: const Padding(padding: EdgeInsets.only(bottom: 90), child: Icon(Icons.contacts_rounded)),
            border: OutlineInputBorder(borderRadius: BorderRadius.circular(14)),
          ),
        ),
        Padding(
          padding: const EdgeInsets.only(top: 4, left: 4),
          child: Text(
            '${_contactsCtrl.text.split(RegExp(r"[\n,;]+")).where((e) => e.trim().isNotEmpty).length} contacts',
            style: TextStyle(fontSize: 11, color: Colors.grey.shade500),
          ),
        ),
        const SizedBox(height: 10),

        // File import buttons
        Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: green.withValues(alpha: 0.05),
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: green.withValues(alpha: 0.2)),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Icon(Icons.upload_file_rounded, size: 18, color: green),
                  const SizedBox(width: 8),
                  const Text(
                    'Importer des contacts',
                    style: TextStyle(fontWeight: FontWeight.w600, fontSize: 13),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              Text(
                'Importez depuis un fichier TXT, CSV ou Excel (.xlsx)',
                style: TextStyle(fontSize: 11, color: Colors.grey.shade600),
              ),
              const SizedBox(height: 10),
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton.icon(
                      onPressed: _importingFile ? null : _importContactsFromFile,
                      icon: _importingFile
                        ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2))
                        : const Icon(Icons.file_open_rounded, size: 18),
                      label: Text(
                        _importingFile ? 'Import...' : 'Choisir un fichier',
                        style: const TextStyle(fontSize: 12),
                      ),
                      style: OutlinedButton.styleFrom(
                        foregroundColor: green,
                        side: BorderSide(color: green.withValues(alpha: 0.4)),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                        padding: const EdgeInsets.symmetric(vertical: 10),
                      ),
                    ),
                  ),
                  if (_importedCount > 0) ...[
                    const SizedBox(width: 10),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                      decoration: BoxDecoration(
                        color: green.withValues(alpha: 0.12),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Text(
                        '+$_importedCount',
                        style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: green),
                      ),
                    ),
                  ],
                ],
              ),
              if (_contactsCtrl.text.isNotEmpty) ...[
                const SizedBox(height: 8),
                Row(
                  children: [
                    Icon(Icons.check_circle_outline_rounded, size: 14, color: green),
                    const SizedBox(width: 4),
                    Text(
                      '${_contactsCtrl.text.split(RegExp(r"[\n,;]+")).where((e) => e.trim().isNotEmpty).length} numeros au total',
                      style: TextStyle(fontSize: 11, color: green, fontWeight: FontWeight.w500),
                    ),
                    const Spacer(),
                    GestureDetector(
                      onTap: () => setState(() { _contactsCtrl.clear(); _importedCount = 0; }),
                      child: Text('Effacer', style: TextStyle(fontSize: 11, color: Colors.red.shade400, fontWeight: FontWeight.w500)),
                    ),
                  ],
                ),
              ],
            ],
          ),
        ),
        const SizedBox(height: 14),

        // SIM selector
        if (sims.isNotEmpty) ...[
          DropdownButtonFormField<int?>(
            value: _simSlot,
            decoration: InputDecoration(
              labelText: 'Carte SIM',
              prefixIcon: const Icon(Icons.sim_card_rounded),
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(14)),
            ),
            items: [
              const DropdownMenuItem(value: null, child: Text('Automatique')),
              ...sims.map((s) => DropdownMenuItem(
                value: s.simSlotIndex,
                child: Text(s.label()),
              )),
            ],
            onChanged: (v) => setState(() => _simSlot = v),
          ),
          const SizedBox(height: 14),
        ],

        // Priority
        Row(
          children: [
            const Icon(Icons.flag_rounded, size: 20, color: Colors.grey),
            const SizedBox(width: 8),
            const Text('Priorite: ', style: TextStyle(fontWeight: FontWeight.w500)),
            const SizedBox(width: 8),
            for (final p in [
              {'v': 0, 'l': 'Normale', 'c': Colors.green},
              {'v': 1, 'l': 'Haute', 'c': Colors.orange},
              {'v': 2, 'l': 'Urgente', 'c': Colors.red},
            ])
              Padding(
                padding: const EdgeInsets.only(right: 6),
                child: ChoiceChip(
                  label: Text(p['l'] as String, style: TextStyle(fontSize: 12, color: _priority == p['v'] ? Colors.white : p['c'] as Color)),
                  selected: _priority == p['v'],
                  onSelected: (_) => setState(() => _priority = p['v'] as int),
                  selectedColor: p['c'] as Color,
                ),
              ),
          ],
        ),
        const SizedBox(height: 24),

        // Submit
        SizedBox(
          width: double.infinity,
          height: 54,
          child: FilledButton.icon(
            onPressed: _creating ? null : _createCampaign,
            icon: Icon(_creating ? Icons.hourglass_empty_rounded : Icons.send_rounded),
            label: Text(
              _creating ? 'Lancement...' : 'Lancer la campagne',
              style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w600),
            ),
            style: FilledButton.styleFrom(
              backgroundColor: green,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildDetail() {
    const green = Color(0xFF16A34A);
    final c = _detailCampaign!;
    final stats = _detailStats ?? {};
    final status = c['status']?.toString() ?? '';
    final total = c['total_count'] ?? 0;
    final sent = c['sent_count'] ?? 0;
    final progress = total > 0 ? sent / total : 0.0;

    final queued = stats['queued'] ?? 0;
    final sending = stats['sending'] ?? 0;
    final sentStat = stats['sent'] ?? 0;
    final failed = stats['failed'] ?? 0;

    return ListView(
      physics: const BouncingScrollPhysics(),
      padding: const EdgeInsets.only(top: 120, left: 16, right: 16, bottom: 40),
      children: [
        Row(
          children: [
            IconButton(
              onPressed: () => setState(() { _detailCampaign = null; _detailStats = null; }),
              icon: const Icon(Icons.arrow_back_rounded),
            ),
            Expanded(
              child: Text(
                c['name']?.toString() ?? 'Campagne',
                style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                maxLines: 1, overflow: TextOverflow.ellipsis,
              ),
            ),
            IconButton(
              onPressed: () => _openDetail(c['id'].toString()),
              icon: const Icon(Icons.refresh_rounded),
            ),
          ],
        ),
        const SizedBox(height: 16),

        // Status + progress
        Container(
          padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(20),
            border: Border.all(color: Colors.grey.shade200),
          ),
          child: Column(
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Container(
                    width: 12, height: 12,
                    decoration: BoxDecoration(
                      color: _statusColor(status),
                      shape: BoxShape.circle,
                    ),
                  ),
                  const SizedBox(width: 8),
                  Text(
                    _statusLabel(status),
                    style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: _statusColor(status)),
                  ),
                ],
              ),
              const SizedBox(height: 16),
              Stack(
                alignment: Alignment.center,
                children: [
                  SizedBox(
                    width: 100, height: 100,
                    child: CircularProgressIndicator(
                      value: progress,
                      strokeWidth: 8,
                      backgroundColor: Colors.grey.shade100,
                      valueColor: AlwaysStoppedAnimation(_statusColor(status)),
                    ),
                  ),
                  Text(
                    '${(progress * 100).round()}%',
                    style: const TextStyle(fontSize: 22, fontWeight: FontWeight.bold),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              Text('$sent / $total SMS envoyes', style: TextStyle(color: Colors.grey.shade600)),
            ],
          ),
        ),
        const SizedBox(height: 16),

        // Stats grid
        Row(
          children: [
            _statCard('En attente', '$queued', Colors.blue),
            const SizedBox(width: 8),
            _statCard('En cours', '$sending', Colors.orange),
            const SizedBox(width: 8),
            _statCard('Envoyes', '$sentStat', green),
            const SizedBox(width: 8),
            _statCard('Echoues', '$failed', Colors.red),
          ],
        ),
        const SizedBox(height: 16),

        // Priority
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: Colors.grey.shade200),
          ),
          child: Row(
            children: [
              const Icon(Icons.flag_rounded, size: 20),
              const SizedBox(width: 8),
              const Text('Priorite: ', style: TextStyle(fontWeight: FontWeight.w500)),
              Text(_priorityLabel(c['priority']), style: const TextStyle(fontWeight: FontWeight.w600)),
              const Spacer(),
              if (c['sim_slot_index'] != null) ...[
                const Icon(Icons.sim_card_rounded, size: 18, color: Colors.grey),
                const SizedBox(width: 4),
                Text('SIM ${(c['sim_slot_index'] as int) + 1}', style: TextStyle(color: Colors.grey.shade600, fontSize: 13)),
              ],
            ],
          ),
        ),
        const SizedBox(height: 20),

        // Action buttons
        if (status == 'running' || status == 'paused') ...[
          Row(
            children: [
              Expanded(
                child: FilledButton.icon(
                  onPressed: () => _controlCampaign(status == 'running' ? 'pause' : 'resume'),
                  icon: Icon(status == 'running' ? Icons.pause_rounded : Icons.play_arrow_rounded),
                  label: Text(status == 'running' ? 'Pause' : 'Reprendre'),
                  style: FilledButton.styleFrom(
                    backgroundColor: status == 'running' ? Colors.orange : green,
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                  ),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: () => _controlCampaign('cancel'),
                  icon: const Icon(Icons.cancel_rounded, color: Colors.red),
                  label: const Text('Annuler', style: TextStyle(color: Colors.red)),
                  style: OutlinedButton.styleFrom(
                    side: const BorderSide(color: Colors.red),
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                  ),
                ),
              ),
            ],
          ),
        ],

        if (_loadingDetail)
          const Padding(padding: EdgeInsets.all(20), child: Center(child: CircularProgressIndicator())),
      ],
    );
  }

  Widget _statCard(String label, String value, Color color) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 8),
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.08),
          borderRadius: BorderRadius.circular(12),
        ),
        child: Column(
          children: [
            Text(value, style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: color)),
            const SizedBox(height: 2),
            Text(label, style: TextStyle(fontSize: 10, color: color.withValues(alpha: 0.8)), textAlign: TextAlign.center),
          ],
        ),
      ),
    );
  }
}

// ============================================================================//
// NAVIGATION DRAWER + SECTIONS
// ============================================================================//

class _AppDrawer extends StatelessWidget {
  const _AppDrawer({
    required this.selected,
    required this.onSelect,
    required this.onLogout,
    this.onCheckUpdate,
  });

  final AppSection selected;
  final ValueChanged<AppSection> onSelect;
  final VoidCallback onLogout;
  final VoidCallback? onCheckUpdate;

  @override
  Widget build(BuildContext context) {
    return Drawer(
      child: Container(
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [
              const Color(0xFF16A34A).withOpacity(0.05),
              const Color(0xFF3B82F6).withOpacity(0.02),
              Colors.white,
            ],
          ),
        ),
        child: SafeArea(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // Header avec gradient
              Container(
                margin: const EdgeInsets.all(16),
                padding: const EdgeInsets.all(20),
                decoration: BoxDecoration(
                  gradient: const LinearGradient(
                    colors: [Color(0xFF16A34A), Color(0xFF22C55E)],
                  ),
                  borderRadius: BorderRadius.circular(20),
                  boxShadow: [
                    BoxShadow(
                      color: const Color(0xFF16A34A).withOpacity(0.3),
                      blurRadius: 12,
                      offset: const Offset(0, 4),
                    ),
                  ],
                ),
                child: Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: Colors.white.withOpacity(0.2),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: const Icon(
                        Icons.sms_rounded,
                        color: Colors.white,
                        size: 28,
                      ),
                    ),
                    const SizedBox(width: 16),
                    const Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'SMSenvoie',
                            style: TextStyle(
                              color: Colors.white,
                              fontSize: 18,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                          SizedBox(height: 4),
                          Text(
                            'Pilotage appareil',
                            style: TextStyle(
                              color: Colors.white70,
                              fontSize: 13,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
              
              const SizedBox(height: 8),
              
              // Navigation items
              Expanded(
        child: ListView(
                  physics: const BouncingScrollPhysics(),
                  padding: const EdgeInsets.symmetric(horizontal: 8),
                  children: [
                    _navItem(
                      context,
                      icon: Icons.dashboard_rounded,
                      label: 'Dashboard',
                      section: AppSection.dashboard,
                    ),
                    const SizedBox(height: 4),
                    _navItem(
                      context,
                      icon: Icons.campaign_rounded,
                      label: 'Campagnes',
                      section: AppSection.campaigns,
                    ),
                    const SizedBox(height: 4),
                    _navItem(
                      context,
                      icon: Icons.message_rounded,
                      label: 'Messages',
                      section: AppSection.messages,
                    ),
                    const SizedBox(height: 4),
                    _navItem(
                      context,
                      icon: Icons.history_rounded,
                      label: 'Historique',
                      section: AppSection.history,
                    ),
                    const SizedBox(height: 4),
                    _navItem(
                      context,
                      icon: Icons.receipt_long_rounded,
                      label: 'Abonnement',
                      section: AppSection.subscription,
                    ),
                    const SizedBox(height: 4),
                    _navItem(
                      context,
                      icon: Icons.devices_other_rounded,
                      label: 'Appareils',
                      section: AppSection.devices,
                    ),
                    const SizedBox(height: 4),
                    _navItem(
                      context,
                      icon: Icons.person_rounded,
                      label: 'Profil',
                      section: AppSection.profile,
                    ),
                    const SizedBox(height: 12),
                    Container(
                      margin: const EdgeInsets.symmetric(horizontal: 8),
                      decoration: BoxDecoration(
                        color: Colors.grey.shade50,
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: Colors.grey.shade200),
                      ),
                      child: ListTile(
                        leading: Container(
                          padding: const EdgeInsets.all(8),
                          decoration: BoxDecoration(
                            color: Colors.grey.shade100,
                            borderRadius: BorderRadius.circular(10),
                          ),
                          child: Icon(
                            Icons.open_in_new_rounded,
                            color: Colors.grey.shade700,
                            size: 22,
                          ),
                        ),
                        title: const Text(
                          'Ouvrir le dashboard web',
                          style: TextStyle(
                            fontWeight: FontWeight.w600,
                            color: Colors.black87,
                            fontSize: 15,
                          ),
                        ),
                        onTap: () async {
                          HapticFeedback.mediumImpact();
                          Navigator.of(context).pop();
                          final uri = Uri.parse('${AppConfig.webApiBaseUrl}/dashboard');
                          await launchUrl(uri, mode: LaunchMode.externalApplication);
                        },
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12),
                        ),
                      ),
                    ),
                    const SizedBox(height: 8),
                    Container(
                      margin: const EdgeInsets.symmetric(horizontal: 8),
                      decoration: BoxDecoration(
                        gradient: LinearGradient(
                          colors: [const Color(0xFFF59E0B).withOpacity(0.1), const Color(0xFFFBBF24).withOpacity(0.05)],
                        ),
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: const Color(0xFFF59E0B).withOpacity(0.3)),
                      ),
                      child: ListTile(
                        leading: Container(
                          padding: const EdgeInsets.all(8),
                          decoration: BoxDecoration(
                            color: const Color(0xFFF59E0B).withOpacity(0.15),
                            borderRadius: BorderRadius.circular(10),
                          ),
                          child: const Icon(
                            Icons.system_update_rounded,
                            color: Color(0xFFF59E0B),
                            size: 22,
                          ),
                        ),
                        title: const Text(
                          'Verifier les mises a jour',
                          style: TextStyle(
                            fontWeight: FontWeight.w600,
                            color: Colors.black87,
                            fontSize: 15,
                          ),
                        ),
                        onTap: () {
                          HapticFeedback.mediumImpact();
                          Navigator.of(context).pop();
                          onCheckUpdate?.call();
                        },
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              
              // Logout button
              Container(
                margin: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: Colors.red.shade50,
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(
                    color: Colors.red.shade200,
                    width: 1,
                  ),
                ),
                child: ListTile(
                  leading: Icon(
                    Icons.link_off_rounded,
                    color: Colors.red.shade600,
                  ),
                  title: Text(
                    'Désappairer l’appareil',
                    style: TextStyle(
                      color: Colors.red.shade600,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  onTap: () {
                    HapticFeedback.mediumImpact();
                    onLogout();
                  },
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(16),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _navItem(
    BuildContext context, {
    required IconData icon,
    required String label,
    required AppSection section,
  }) {
    final isActive = section == selected;
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 8),
      decoration: BoxDecoration(
        color: isActive
            ? const Color(0xFF16A34A).withOpacity(0.1)
            : Colors.transparent,
        borderRadius: BorderRadius.circular(12),
        border: isActive
            ? Border.all(
                color: const Color(0xFF16A34A).withOpacity(0.3),
                width: 1,
              )
            : null,
      ),
      child: ListTile(
        leading: Container(
          padding: const EdgeInsets.all(8),
          decoration: BoxDecoration(
            color: isActive
                ? const Color(0xFF16A34A).withOpacity(0.2)
                : Colors.grey.shade100,
            borderRadius: BorderRadius.circular(10),
          ),
          child: Icon(
            icon,
            color: isActive ? const Color(0xFF16A34A) : Colors.grey.shade600,
            size: 22,
          ),
        ),
        title: Text(
          label,
          style: TextStyle(
            fontWeight: isActive ? FontWeight.w700 : FontWeight.w500,
            color: isActive ? const Color(0xFF16A34A) : Colors.black87,
            fontSize: 15,
          ),
        ),
        trailing: isActive
            ? Container(
                width: 8,
                height: 8,
                decoration: const BoxDecoration(
                  color: Color(0xFF16A34A),
                  shape: BoxShape.circle,
                ),
              )
            : null,
        onTap: () {
          HapticFeedback.lightImpact();
          Navigator.of(context).pop();
          onSelect(section);
        },
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(12),
        ),
      ),
    );
  }
}

class _UpdateBanner extends StatelessWidget {
  const _UpdateBanner({required this.appState, required this.notifier});
  final AppState appState;
  final AppNotifier notifier;

  @override
  Widget build(BuildContext context) {
    final version = appState.updateVersion ?? '';
    final notes = appState.updateNotes;

    return Container(
          padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        gradient: const LinearGradient(colors: [Color(0xFFF59E0B), Color(0xFFFBBF24)]),
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(color: const Color(0xFFF59E0B).withOpacity(0.3), blurRadius: 12, offset: const Offset(0, 4)),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
          children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(color: Colors.white.withOpacity(0.3), borderRadius: BorderRadius.circular(10)),
                child: const Icon(Icons.system_update_rounded, color: Colors.white, size: 24),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Mise \u00e0 jour $version', style: const TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold)),
                    if (notes != null && notes.isNotEmpty)
                      Text(notes, style: TextStyle(color: Colors.white.withOpacity(0.9), fontSize: 12), maxLines: 2, overflow: TextOverflow.ellipsis),
                  ],
                ),
              ),
              IconButton(
                onPressed: () => notifier.dismissUpdate(),
                icon: const Icon(Icons.close_rounded, color: Colors.white, size: 20),
                style: IconButton.styleFrom(backgroundColor: Colors.white.withOpacity(0.2)),
              ),
            ],
            ),
            const SizedBox(height: 12),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton.icon(
              onPressed: () {
                HapticFeedback.mediumImpact();
                notifier.launchUpdate();
              },
              style: ElevatedButton.styleFrom(
                backgroundColor: Colors.white,
                foregroundColor: const Color(0xFFF59E0B),
                padding: const EdgeInsets.symmetric(vertical: 12),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              ),
              icon: const Icon(Icons.download_rounded, size: 20),
              label: const Text('T\u00e9l\u00e9charger la mise \u00e0 jour', style: TextStyle(fontWeight: FontWeight.bold)),
            ),
          ),
        ],
      ),
    );
  }
}

class _DashboardSection extends StatefulWidget {
  const _DashboardSection({
    required this.appState,
    required this.notifier,
  });

  final AppState appState;
  final AppNotifier notifier;

  @override
  State<_DashboardSection> createState() => _DashboardSectionState();
}

class _DashboardSectionState extends State<_DashboardSection> {
  Map<String, int> _counts = {};
  bool _loadingCounts = false;

  @override
  void initState() {
    super.initState();
    _loadCounts();
  }

  Future<void> _loadCounts() async {
    if (_loadingCounts) return;
    setState(() => _loadingCounts = true);
    try {
      final c = await widget.notifier.fetchMessageCounts();
      if (mounted) setState(() => _counts = c);
    } catch (_) {}
    if (mounted) setState(() => _loadingCounts = false);
  }

  void _goToHistoryWithFilter(String status) {
    final container = ProviderScope.containerOf(context);
    container.read(sectionProvider.notifier).state = AppSection.history;
    container.read(_historyFilterProvider.notifier).state = status;
  }

  @override
  Widget build(BuildContext context) {
    final appState = widget.appState;
    final notifier = widget.notifier;
    final hasCampaign = appState.campaignIdSending != null &&
        appState.campaignStatusSending != 'completed' &&
        appState.campaignStatusSending != 'canceled';
    final hasUpdate = appState.updateVersion != null;

    final sent = appState.campaignSentCount ?? 0;
    final total = appState.campaignTotalCount ?? 0;
    final pending = (total - sent).clamp(0, 999999);
    final used = appState.smsUsedThisMonth ?? 0;
    final quota = appState.planSmsQuotaMonth ?? 0;
    final remaining = appState.quotaRemaining ?? (quota - used).clamp(0, 999999);

    final cAll = _counts['all'] ?? 0;
    final cSent = _counts['sent'] ?? 0;
    final cQueued = _counts['queued'] ?? 0;
    final cFailed = _counts['failed'] ?? 0;
    final cSending = _counts['sending'] ?? 0;

    return ListView(
      physics: const BouncingScrollPhysics(),
      padding: EdgeInsets.only(top: hasUpdate ? 200 : 120, left: 20, right: 20, bottom: 20),
      children: [
        if (hasCampaign) _CampaignProgressCard(appState: appState, notifier: notifier),
        if (hasCampaign) const SizedBox(height: 16),

        // Stats overview row
        Row(
          children: [
            Expanded(child: _DashStatTile(
              icon: Icons.email_rounded, label: 'Total', value: '$cAll',
              color: const Color(0xFF3B82F6),
              onTap: () => _goToHistoryWithFilter('all'),
            )),
            const SizedBox(width: 10),
            Expanded(child: _DashStatTile(
              icon: Icons.check_circle_rounded, label: 'Envoy\u00e9s', value: '$cSent',
              color: const Color(0xFF16A34A),
              onTap: () => _goToHistoryWithFilter('sent'),
            )),
          ],
        ),
        const SizedBox(height: 10),
        Row(
          children: [
            Expanded(child: _DashStatTile(
              icon: Icons.hourglass_top_rounded, label: 'En attente', value: '$cQueued',
              color: Colors.orange,
              onTap: () => _goToHistoryWithFilter('queued'),
            )),
            const SizedBox(width: 10),
            Expanded(child: _DashStatTile(
              icon: Icons.error_rounded, label: '\u00c9checs', value: '$cFailed',
              color: Colors.red,
              onTap: () => _goToHistoryWithFilter('failed'),
            )),
          ],
        ),
        const SizedBox(height: 10),
        Row(
          children: [
            Expanded(child: _DashStatTile(
              icon: Icons.send_rounded, label: 'En cours', value: '$cSending',
              color: const Color(0xFF8B5CF6),
              onTap: () => _goToHistoryWithFilter('sending'),
            )),
            const SizedBox(width: 10),
            Expanded(child: _DashStatTile(
              icon: Icons.data_usage_rounded, label: 'Quota', value: '$remaining',
              color: const Color(0xFF0EA5E9),
              onTap: () {
                final container = ProviderScope.containerOf(context);
                container.read(sectionProvider.notifier).state = AppSection.subscription;
              },
            )),
          ],
        ),
        const SizedBox(height: 8),
        Align(
          alignment: Alignment.centerRight,
          child: TextButton.icon(
            onPressed: _loadingCounts ? null : _loadCounts,
            icon: _loadingCounts
                ? const SizedBox(width: 14, height: 14, child: CircularProgressIndicator(strokeWidth: 2))
                : const Icon(Icons.refresh_rounded, size: 16),
            label: Text(_loadingCounts ? 'Chargement...' : 'Actualiser'),
            style: TextButton.styleFrom(foregroundColor: Colors.grey.shade600),
          ),
        ),
        const SizedBox(height: 12),

        _QueueManagementCard(appState: appState, notifier: notifier),
        const SizedBox(height: 16),
        _SyncCard(appState: appState, notifier: notifier),
        const SizedBox(height: 16),
        _DashRecentMessages(appState: appState, onViewAll: () => _goToHistoryWithFilter('all')),
      ],
    );
  }
}

final _historyFilterProvider = StateProvider<String>((_) => 'all');

class _DashStatTile extends StatelessWidget {
  const _DashStatTile({
    required this.icon, required this.label, required this.value,
    required this.color, this.onTap,
  });
  final IconData icon;
  final String label;
  final String value;
  final Color color;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.white,
      borderRadius: BorderRadius.circular(14),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(14),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: color.withOpacity(0.15)),
          ),
          child: Row(
            children: [
              Container(
                padding: const EdgeInsets.all(7),
                decoration: BoxDecoration(
                  color: color.withOpacity(0.1),
                  borderRadius: BorderRadius.circular(9),
                ),
                child: Icon(icon, color: color, size: 18),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      value,
                      style: TextStyle(
                          fontSize: 18, fontWeight: FontWeight.bold, color: color, height: 1.1),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      label,
                      style: TextStyle(
                          fontSize: 11, color: Colors.grey.shade600, fontWeight: FontWeight.w500),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _DashRecentMessages extends StatelessWidget {
  const _DashRecentMessages({required this.appState, required this.onViewAll});
  final AppState appState;
  final VoidCallback onViewAll;

  @override
  Widget build(BuildContext context) {
    final outbox = appState.outboxHistory;
    return _ModernCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text('Derniers messages', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Colors.black87)),
              InkWell(
                borderRadius: BorderRadius.circular(20),
                onTap: onViewAll,
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                  decoration: BoxDecoration(
                    color: const Color(0xFF3B82F6).withOpacity(0.1),
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: const Text('Voir tout', style: TextStyle(color: Color(0xFF3B82F6), fontWeight: FontWeight.bold, fontSize: 13)),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          if (outbox.isEmpty)
            Center(
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Column(
                  children: [
                    Icon(Icons.inbox_rounded, size: 48, color: Colors.grey.shade300),
                    const SizedBox(height: 12),
                    Text('Aucun message', style: TextStyle(color: Colors.grey.shade500, fontSize: 15)),
                  ],
                ),
              ),
            )
          else
            ...outbox.take(5).map((m) => _compactMessageRow(m)),
        ],
      ),
    );
  }

  Widget _compactMessageRow(OutboxMessage m) {
    final statusInfo = _statusBadge(m.status);
    final preview = m.body.length > 40 ? '${m.body.substring(0, 40)}\u2026' : m.body;
    final time = m.sentAt ?? m.createdAt;
    final hh = time.hour.toString().padLeft(2, '0');
    final mm = time.minute.toString().padLeft(2, '0');
    return Container(
      margin: const EdgeInsets.only(top: 6),
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: Colors.grey.shade50,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        children: [
          Container(
            width: 8, height: 8,
            decoration: BoxDecoration(shape: BoxShape.circle, color: statusInfo.$2),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(m.toPhoneE164, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13)),
                Text(preview, style: TextStyle(color: Colors.grey.shade600, fontSize: 11), maxLines: 1, overflow: TextOverflow.ellipsis),
              ],
            ),
          ),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(color: statusInfo.$3, borderRadius: BorderRadius.circular(10)),
                child: Text(statusInfo.$1, style: TextStyle(color: statusInfo.$2, fontSize: 10, fontWeight: FontWeight.w700)),
              ),
              const SizedBox(height: 4),
              Text('$hh:$mm', style: TextStyle(color: Colors.grey.shade500, fontSize: 10)),
            ],
          ),
        ],
      ),
    );
  }

  (String, Color, Color) _statusBadge(String status) {
    switch (status) {
      case 'sent': return ('Envoy\u00e9', Colors.green.shade700, Colors.green.shade50);
      case 'failed': return ('\u00c9chec', Colors.red.shade700, Colors.red.shade50);
      case 'sending': return ('En cours', Colors.orange.shade700, Colors.orange.shade50);
      default: return ('En attente', Colors.blue.shade700, Colors.blue.shade50);
    }
  }
}

/// Carte de progression de campagne en cours avec boutons Pause/Reprendre/Annuler
class _CampaignProgressCard extends StatefulWidget {
  const _CampaignProgressCard({
    required this.appState,
    required this.notifier,
  });

  final AppState appState;
  final AppNotifier notifier;

  @override
  State<_CampaignProgressCard> createState() => _CampaignProgressCardState();
}

class _CampaignProgressCardState extends State<_CampaignProgressCard> {
  bool _busy = false;

  Future<void> _runAction(Future<void> Function() fn, String okMsg) async {
    if (_busy) return;
    setState(() => _busy = true);
    try {
      await fn();
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(okMsg)));
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Erreur: $e'), backgroundColor: Colors.red.shade700),
      );
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final appState = widget.appState;
    final notifier = widget.notifier;

    final campaignName = appState.campaignNameSending ?? 'Campagne';
    final status = (appState.campaignStatusSending ?? '').toLowerCase();
    final sent = appState.campaignSentCount ?? 0;
    final total = appState.campaignTotalCount ?? 0;
    final remaining = (total - sent).clamp(0, 1 << 30);
    final progress = total > 0 ? (sent / total).clamp(0.0, 1.0) : 0.0;
    final percentText = total > 0 ? '${(progress * 100).toStringAsFixed(0)}%' : '—';

    final isRunning = status == 'running';
    final isPaused = status == 'paused';
    final isQueued = status == 'queued';

    final statusLine = isPaused
        ? '⏸️ En pause'
        : isQueued
            ? '⏳ En attente de démarrage'
            : '📤 Envoi en cours...';

    final leftLabel = isRunning ? 'Pause' : 'Reprendre';
    final leftIcon = isRunning ? Icons.pause_rounded : Icons.play_arrow_rounded;

    return _ModernCard(
      gradient: const LinearGradient(
        colors: [Color(0xFF3B82F6), Color(0xFF60A5FA)],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(9),
                decoration: BoxDecoration(
                  color: Colors.white.withOpacity(0.2),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: const Icon(
                  Icons.campaign_rounded,
                  color: Colors.white,
                  size: 22,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      campaignName,
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 15,
                        fontWeight: FontWeight.bold,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                    const SizedBox(height: 2),
                    Text(
                      statusLine,
                      style: TextStyle(
                        color: Colors.white.withOpacity(0.9),
                        fontSize: 12,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(
                          '$sent / $total SMS',
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 14,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                        Text(
                          percentText,
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 14,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 6),
                    ClipRRect(
                      borderRadius: BorderRadius.circular(10),
                      child: LinearProgressIndicator(
                        value: progress,
                        minHeight: 8,
                        backgroundColor: Colors.white.withOpacity(0.3),
                        valueColor: const AlwaysStoppedAnimation<Color>(Colors.white),
                      ),
                    ),
                    const SizedBox(height: 6),
                    Text(
                      'Reste $remaining SMS à envoyer',
                      style: TextStyle(
                        color: Colors.white.withOpacity(0.85),
                        fontSize: 11.5,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          Row(
            children: [
              Expanded(
                child: ElevatedButton.icon(
                  onPressed: _busy
                      ? null
                      : () async {
                          if (isRunning) {
                            await _runAction(() => notifier.pauseActiveCampaign(), '⏸️ Campagne mise en pause');
                          } else if (isPaused || isQueued) {
                            await _runAction(() => notifier.resumeActiveCampaign(), '▶️ Campagne relancée');
                          } else {
                            await _runAction(() => notifier.resumeActiveCampaign(), '▶️ Campagne relancée');
                          }
                        },
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Colors.white,
                    foregroundColor: const Color(0xFF3B82F6),
                    padding: const EdgeInsets.symmetric(vertical: 10),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(11),
                    ),
                  ),
                  icon: Icon(leftIcon, size: 16),
                  label: Text(
                    leftLabel,
                    style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
                  ),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: _busy
                      ? null
                      : () async {
                          final confirm = await showDialog<bool>(
                            context: context,
                            builder: (ctx) => AlertDialog(
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(20),
                              ),
                              title: const Text('Annuler la campagne ?'),
                              content: const Text(
                                'Les SMS déjà envoyés ne seront pas annulés. '
                                'Les SMS restants ne seront pas envoyés.',
                              ),
                              actions: [
                                TextButton(
                                  onPressed: () => Navigator.of(ctx).pop(false),
                                  child: const Text('Non'),
                                ),
                                FilledButton(
                                  onPressed: () => Navigator.of(ctx).pop(true),
                                  style: FilledButton.styleFrom(
                                    backgroundColor: Colors.red,
                                  ),
                                  child: const Text('Oui, annuler'),
                                ),
                              ],
                            ),
                          );
                          if (confirm == true) {
                            await _runAction(() => notifier.cancelActiveCampaign(), '🚫 Campagne annulée');
                          }
                        },
                  style: OutlinedButton.styleFrom(
                    foregroundColor: Colors.white,
                    side: const BorderSide(color: Colors.white, width: 2),
                    padding: const EdgeInsets.symmetric(vertical: 10),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(11),
                    ),
                  ),
                  icon: const Icon(Icons.cancel_rounded, size: 16),
                  label: const Text(
                    'Annuler',
                    style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

/// Queue management card: force send, retry failed, queue status
class _QueueManagementCard extends StatefulWidget {
  const _QueueManagementCard({required this.appState, required this.notifier});
  final AppState appState;
  final AppNotifier notifier;

  @override
  State<_QueueManagementCard> createState() => _QueueManagementCardState();
}

class _QueueManagementCardState extends State<_QueueManagementCard> {
  bool _forceBusy = false;
  bool _retryBusy = false;

  @override
  Widget build(BuildContext context) {
    final sent = widget.appState.campaignSentCount ?? 0;
    final total = widget.appState.campaignTotalCount ?? 0;
    final pending = (total - sent).clamp(0, 999999);
    final used = widget.appState.smsUsedThisMonth ?? 0;
    final quota = widget.appState.planSmsQuotaMonth ?? 0;
    final remaining = widget.appState.quotaRemaining ?? (quota - used).clamp(0, 999999);

    return _ModernCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: const Color(0xFF8B5CF6).withOpacity(0.1),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: const Icon(Icons.queue_rounded, color: Color(0xFF8B5CF6), size: 24),
              ),
              const SizedBox(width: 12),
              const Expanded(
                child: Text(
                  'File d\'attente SMS',
                  style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Colors.black87),
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              _QueueStat(label: 'En attente', value: '$pending', color: Colors.orange),
              const SizedBox(width: 12),
              _QueueStat(label: 'Envoy\u00e9s', value: '$sent', color: Colors.green),
              const SizedBox(width: 12),
              _QueueStat(label: 'Quota restant', value: '$remaining', color: Colors.blue),
            ],
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              Expanded(
                child: ElevatedButton.icon(
                  onPressed: (_forceBusy || widget.appState.syncing)
                      ? null
                      : () async {
                          setState(() => _forceBusy = true);
                          HapticFeedback.mediumImpact();
                          try {
                            await widget.notifier.forceSyncNow();
                            if (mounted) {
                              ScaffoldMessenger.of(context).showSnackBar(
                                const SnackBar(content: Text('Envoi forc\u00e9 lanc\u00e9')),
                              );
                            }
                          } catch (e) {
                            if (mounted) {
                              ScaffoldMessenger.of(context).showSnackBar(
                                SnackBar(content: Text('Erreur: $e'), backgroundColor: Colors.red.shade700),
                              );
                            }
                          } finally {
                            if (mounted) setState(() => _forceBusy = false);
                          }
                        },
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF8B5CF6),
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                  icon: _forceBusy
                      ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                      : const Icon(Icons.bolt_rounded, size: 20),
                  label: Text(_forceBusy ? 'Envoi...' : 'Forcer l\'envoi', style: const TextStyle(fontWeight: FontWeight.bold)),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: _retryBusy
                      ? null
                      : () async {
                          setState(() => _retryBusy = true);
                          HapticFeedback.mediumImpact();
                          try {
                            final count = await widget.notifier.retryFailedMessages();
                            if (mounted) {
                              ScaffoldMessenger.of(context).showSnackBar(
                                SnackBar(content: Text('$count message(s) remis en file d\'attente')),
                              );
                            }
                          } catch (e) {
                            if (mounted) {
                              ScaffoldMessenger.of(context).showSnackBar(
                                SnackBar(content: Text('Erreur: $e'), backgroundColor: Colors.red.shade700),
                              );
                            }
                          } finally {
                            if (mounted) setState(() => _retryBusy = false);
                          }
                        },
                  style: OutlinedButton.styleFrom(
                    foregroundColor: Colors.orange.shade700,
                    side: BorderSide(color: Colors.orange.shade300),
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                  icon: _retryBusy
                      ? SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.orange.shade700))
                      : const Icon(Icons.replay_rounded, size: 20),
                  label: Text(_retryBusy ? 'Relance...' : 'Relancer \u00e9checs', style: const TextStyle(fontWeight: FontWeight.bold)),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _QueueStat extends StatelessWidget {
  const _QueueStat({required this.label, required this.value, required this.color});
  final String label;
  final String value;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 8),
        decoration: BoxDecoration(
          color: color.withOpacity(0.08),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: color.withOpacity(0.2)),
        ),
        child: Column(
          children: [
            Text(value, style: TextStyle(fontSize: 22, fontWeight: FontWeight.bold, color: color)),
            const SizedBox(height: 4),
            Text(label, style: TextStyle(fontSize: 11, color: color.withOpacity(0.8), fontWeight: FontWeight.w500), textAlign: TextAlign.center),
          ],
        ),
      ),
    );
  }
}

class _StatusCardDashboard extends StatelessWidget {
  const _StatusCardDashboard({required this.appState});
  final AppState appState;

  @override
  Widget build(BuildContext context) {
    return _ModernCard(
      gradient: const LinearGradient(
        colors: [Color(0xFF16A34A), Color(0xFF22C55E)],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: Colors.white.withOpacity(0.2),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: const Icon(
                  Icons.check_circle_rounded,
                  color: Colors.white,
                  size: 28,
                ),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'Appareil connecté',
                      style: TextStyle(
                        color: Colors.white,
                        fontSize: 18,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      appState.syncing ? 'Synchronisation...' : 'Prêt à envoyer',
                      style: TextStyle(
                        color: Colors.white.withOpacity(0.9),
                        fontSize: 14,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 20),
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: Colors.white.withOpacity(0.15),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(
                color: Colors.white.withOpacity(0.3),
              ),
            ),
            child: Row(
              children: [
                const Icon(
                  Icons.key_rounded,
                  color: Colors.white,
                  size: 20,
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Text(
                    _formatDeviceTokenForUi(appState.deviceToken),
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 12,
                      fontFamily: 'monospace',
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _SyncCard extends StatelessWidget {
  const _SyncCard({required this.appState, required this.notifier});
  final AppState appState;
  final AppNotifier notifier;

  @override
  Widget build(BuildContext context) {
    return _ModernCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Synchronisation',
            style: TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.bold,
              color: Colors.black87,
            ),
          ),
          const SizedBox(height: 16),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton.icon(
              onPressed: appState.syncing
                  ? null
                  : () {
                      HapticFeedback.mediumImpact();
                      notifier.syncOnce();
                    },
              style: ElevatedButton.styleFrom(
                padding: const EdgeInsets.symmetric(vertical: 18),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(16),
                ),
              ),
                    icon: appState.syncing
                        ? const SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        color: Colors.white,
                      ),
                    )
                  : const Icon(Icons.sync_rounded, size: 24),
              label: Text(
                appState.syncing
                    ? 'Synchronisation en cours...'
                    : 'Synchroniser et envoyer',
                style: const TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
          ),
          if (appState.lastStatus != null) ...[
            const SizedBox(height: 16),
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: Colors.grey.shade50,
                borderRadius: BorderRadius.circular(12),
              ),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Icon(
                    Icons.info_outline_rounded,
                    color: Colors.grey.shade600,
                    size: 20,
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Text(
                      appState.lastStatus!,
                      style: TextStyle(
                        color: Colors.grey.shade700,
                        fontSize: 14,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }
}

// _MessagesCard removed -- replaced by _DashRecentMessages in dashboard

class _MessagesSection extends StatelessWidget {
  const _MessagesSection({required this.appState, required this.notifier});
  final AppState appState;
  final AppNotifier notifier;

  @override
  Widget build(BuildContext context) {
    return ListView(
      physics: const BouncingScrollPhysics(),
      padding: const EdgeInsets.only(top: 120, left: 20, right: 20, bottom: 20),
      children: [
        _ModernCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text(
                    'Boîte de réception',
                    style: TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.bold,
                      color: Colors.black87,
                    ),
                  ),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                    decoration: BoxDecoration(
                      color: const Color(0xFF16A34A).withOpacity(0.08),
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: Text(
                      '${appState.inboxMessages.length}',
                      style: const TextStyle(
                        color: Color(0xFF16A34A),
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              if (appState.inboxMessages.isEmpty)
                Padding(
                  padding: const EdgeInsets.all(12.0),
                  child: Text(
                    'Aucun message reçu pour l’instant.',
                    style: TextStyle(color: Colors.grey.shade700),
                  ),
                )
              else
                ...appState.inboxMessages.map((m) {
                  final preview = m.body.length > 70 ? '${m.body.substring(0, 70)}…' : m.body;
                  return Container(
                    margin: const EdgeInsets.only(top: 10),
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(
                      color: Colors.grey.shade50,
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(color: Colors.grey.shade200),
                    ),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Container(
                          width: 10,
                          height: 10,
                          margin: const EdgeInsets.only(top: 6),
                          decoration: BoxDecoration(
                            shape: BoxShape.circle,
                            color: m.read ? Colors.grey.shade400 : const Color(0xFF16A34A),
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                m.fromPhoneE164,
                                style: const TextStyle(fontWeight: FontWeight.w700),
                              ),
                              const SizedBox(height: 6),
                              Text(
                                preview,
                                style: TextStyle(color: Colors.grey.shade700),
                  ),
                  const SizedBox(height: 8),
                  Text(
                                _formatDateTimeFr(m.receivedAt),
                                style: TextStyle(color: Colors.grey.shade600, fontSize: 12),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  );
                }),
            ],
          ),
        ),
      ],
    );
  }
}

class _HistorySection extends ConsumerStatefulWidget {
  const _HistorySection({required this.appState, required this.notifier});
  final AppState appState;
  final AppNotifier notifier;

  @override
  ConsumerState<_HistorySection> createState() => _HistorySectionState();
}

class _HistorySectionState extends ConsumerState<_HistorySection> {
  String _status = 'all';
  String _phoneQuery = '';
  String _bodyQuery = '';
  String _simFilter = 'all';
  int _page = 0;
  static const int _pageSize = 50;
  bool _loading = false;
  bool _showFilters = false;
  final _phoneController = TextEditingController();
  final _bodyController = TextEditingController();

  Future<void> _load({bool resetPage = false}) async {
    if (_loading) return;
    setState(() {
      _loading = true;
      if (resetPage) _page = 0;
    });
    try {
      await widget.notifier.refreshOutboxHistory(
        silent: false,
        status: _status,
        phoneQuery: _phoneQuery,
        bodyQuery: _bodyQuery,
        simFilter: _simFilter,
        page: _page,
        pageSize: _pageSize,
      );
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  void initState() {
    super.initState();
    scheduleMicrotask(() {
      final initialFilter = ref.read(_historyFilterProvider);
      if (initialFilter != 'all') {
        setState(() => _status = initialFilter);
        ref.read(_historyFilterProvider.notifier).state = 'all';
      }
      _load();
    });
  }

  @override
  void dispose() {
    _phoneController.dispose();
    _bodyController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final list = widget.appState.outboxHistory;
    final sims = widget.appState.availableSims;

    final statusCounts = <String, int>{};
    for (final m in list) {
      statusCounts[m.status] = (statusCounts[m.status] ?? 0) + 1;
    }

    return ListView(
      physics: const BouncingScrollPhysics(),
      padding: const EdgeInsets.only(top: 120, left: 16, right: 16, bottom: 20),
      children: [
        // Header with count
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
          decoration: BoxDecoration(
            gradient: const LinearGradient(colors: [Color(0xFF3B82F6), Color(0xFF60A5FA)]),
            borderRadius: BorderRadius.circular(16),
          ),
          child: Row(
            children: [
              const Icon(Icons.email_rounded, color: Colors.white, size: 28),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Messages (${list.length}${list.length >= _pageSize ? '+' : ''})',
                      style: const TextStyle(color: Colors.white, fontSize: 20, fontWeight: FontWeight.bold),
                    ),
                    Text(
                      'Page ${_page + 1} \u2022 $_pageSize par page',
                      style: TextStyle(color: Colors.white.withOpacity(0.8), fontSize: 13),
                    ),
                  ],
                ),
              ),
              IconButton(
                onPressed: _loading ? null : () => _load(resetPage: true),
                icon: _loading
                    ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                    : const Icon(Icons.refresh_rounded, color: Colors.white),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 12),

        // Search bar
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: Colors.grey.shade200),
          ),
          child: Row(
            children: [
              Icon(Icons.search_rounded, color: Colors.grey.shade400),
              const SizedBox(width: 10),
              Expanded(
                child: TextField(
                  controller: _phoneController,
                  decoration: const InputDecoration(
                    hintText: 'Rechercher un num\u00e9ro...',
                    border: InputBorder.none,
                    isDense: true,
                    contentPadding: EdgeInsets.symmetric(vertical: 8),
                  ),
                  onChanged: (v) => _phoneQuery = v,
                  onSubmitted: (_) => _load(resetPage: true),
                ),
              ),
              IconButton(
                icon: Icon(
                  _showFilters ? Icons.filter_list_off_rounded : Icons.filter_list_rounded,
                  color: _showFilters ? const Color(0xFF3B82F6) : Colors.grey.shade500,
                ),
                onPressed: () => setState(() => _showFilters = !_showFilters),
                tooltip: 'Filtres avanc\u00e9s',
              ),
              FilledButton(
                onPressed: _loading ? null : () => _load(resetPage: true),
                style: FilledButton.styleFrom(
                  backgroundColor: const Color(0xFF3B82F6),
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                ),
                child: const Text('Rechercher'),
              ),
            ],
          ),
        ),
        const SizedBox(height: 8),

        // Advanced filters
        if (_showFilters)
          Container(
            padding: const EdgeInsets.all(14),
            margin: const EdgeInsets.only(bottom: 8),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: Colors.grey.shade200),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Filtres avanc\u00e9s', style: TextStyle(fontWeight: FontWeight.bold, color: Colors.grey.shade800)),
                const SizedBox(height: 12),
                // Message body search
                TextField(
                  controller: _bodyController,
                  decoration: InputDecoration(
                    prefixIcon: const Icon(Icons.message_rounded, size: 20),
                    hintText: 'Rechercher dans le contenu...',
                    isDense: true,
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide(color: Colors.grey.shade300)),
                    contentPadding: const EdgeInsets.symmetric(vertical: 10, horizontal: 12),
                  ),
                  onChanged: (v) => _bodyQuery = v,
                  onSubmitted: (_) => _load(resetPage: true),
                ),
                const SizedBox(height: 10),
                Row(
                  children: [
                    // SIM filter
                    if (sims.isNotEmpty) ...[
                      Expanded(
                        child: DropdownButtonFormField<String>(
                          value: _simFilter,
                          decoration: InputDecoration(
                            labelText: 'SIM',
                            isDense: true,
                            border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                            contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                          ),
                          items: [
                            const DropdownMenuItem(value: 'all', child: Text('Toutes les SIM')),
                            ...sims.map((s) => DropdownMenuItem(
                              value: s.subscriptionId.toString(),
                              child: Text(s.displayName.isNotEmpty ? s.displayName : 'SIM ${s.simSlotIndex + 1}'),
                            )),
                          ],
                          onChanged: (v) {
                            if (v == null) return;
                            setState(() => _simFilter = v);
                            _load(resetPage: true);
                          },
                        ),
                      ),
                      const SizedBox(width: 10),
                    ],
                  ],
                ),
                const SizedBox(height: 10),
                OutlinedButton.icon(
                  onPressed: () {
                    setState(() {
                      _phoneQuery = '';
                      _bodyQuery = '';
                      _simFilter = 'all';
                      _status = 'all';
                      _phoneController.clear();
                      _bodyController.clear();
                    });
                    _load(resetPage: true);
                  },
                  icon: const Icon(Icons.clear_all_rounded, size: 18),
                  label: const Text('R\u00e9initialiser les filtres'),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: Colors.grey.shade600,
                    side: BorderSide(color: Colors.grey.shade300),
                  ),
                ),
              ],
            ),
          ),

        // Status filter chips
        SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          child: Row(
            children: [
              _filterChip('Tous', 'all', null),
              _filterChip('En attente', 'queued', Colors.blue),
              _filterChip('En cours', 'sending', Colors.orange),
              _filterChip('Envoy\u00e9s', 'sent', Colors.green),
              _filterChip('\u00c9checs', 'failed', Colors.red),
              _filterChip('Opt-out', 'skipped_optout', Colors.grey),
            ],
          ),
        ),
        const SizedBox(height: 8),

        // Results header
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
          decoration: BoxDecoration(
            color: Colors.grey.shade100,
            borderRadius: BorderRadius.circular(10),
          ),
          child: Row(
            children: [
              Expanded(flex: 3, child: Text('Destinataire', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 12, color: Colors.grey.shade700))),
              Expanded(flex: 3, child: Text('Message', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 12, color: Colors.grey.shade700))),
              Expanded(flex: 2, child: Text('Status', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 12, color: Colors.grey.shade700), textAlign: TextAlign.center)),
              Expanded(flex: 2, child: Text('Date', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 12, color: Colors.grey.shade700), textAlign: TextAlign.right)),
            ],
          ),
        ),

        // Message list
        if (_loading && list.isEmpty)
          const Padding(
            padding: EdgeInsets.all(40),
            child: Center(child: CircularProgressIndicator()),
          )
        else if (list.isEmpty)
          Padding(
            padding: const EdgeInsets.all(40),
            child: Column(
              children: [
                Icon(Icons.inbox_rounded, size: 64, color: Colors.grey.shade300),
                const SizedBox(height: 16),
                Text('Aucun message trouv\u00e9', style: TextStyle(color: Colors.grey.shade500, fontSize: 16)),
                const SizedBox(height: 8),
                Text('Essayez de modifier vos filtres', style: TextStyle(color: Colors.grey.shade400, fontSize: 13)),
              ],
            ),
          )
        else
          ...list.asMap().entries.map((entry) {
            final i = entry.key;
            final m = entry.value;
            return _messageRow(m, i);
          }),

        const SizedBox(height: 12),

        // Pagination
        Container(
          padding: const EdgeInsets.symmetric(vertical: 8),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              OutlinedButton.icon(
                onPressed: (_loading || _page == 0)
                    ? null
                    : () { setState(() => _page -= 1); _load(); },
                icon: const Icon(Icons.chevron_left_rounded, size: 18),
                label: const Text('Pr\u00e9c\u00e9dent'),
                style: OutlinedButton.styleFrom(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                decoration: BoxDecoration(
                  color: const Color(0xFF3B82F6).withOpacity(0.1),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Text('Page ${_page + 1}', style: const TextStyle(fontWeight: FontWeight.bold, color: Color(0xFF3B82F6))),
              ),
              OutlinedButton.icon(
                onPressed: (_loading || list.length < _pageSize)
                    ? null
                    : () { setState(() => _page += 1); _load(); },
                icon: const Icon(Icons.chevron_right_rounded, size: 18),
                label: const Text('Suivant'),
                style: OutlinedButton.styleFrom(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                    ),
            ),
          ],
        ),
      ),
      ],
    );
  }

  Widget _filterChip(String label, String value, Color? color) {
    final selected = _status == value;
    return Padding(
      padding: const EdgeInsets.only(right: 6),
      child: FilterChip(
        selected: selected,
        label: Text(label, style: TextStyle(fontSize: 12, fontWeight: selected ? FontWeight.bold : FontWeight.w500)),
        selectedColor: (color ?? const Color(0xFF3B82F6)).withOpacity(0.15),
        backgroundColor: Colors.grey.shade100,
        checkmarkColor: color ?? const Color(0xFF3B82F6),
        side: BorderSide(
          color: selected ? (color ?? const Color(0xFF3B82F6)) : Colors.grey.shade300,
        ),
        onSelected: (_) {
          setState(() => _status = value);
          _load(resetPage: true);
        },
      ),
    );
  }

  Widget _messageRow(OutboxMessage m, int index) {
    final statusInfo = _statusInfo(m.status);
    final preview = m.body.length > 35 ? '${m.body.substring(0, 35)}\u2026' : m.body;
    final time = m.sentAt ?? m.createdAt;
    final simLabel = m.simSubscriptionId != null ? 'SIM ${m.simSubscriptionId}' : '';

    return InkWell(
      onTap: () => _showMessageDetail(m),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        decoration: BoxDecoration(
          color: index.isEven ? Colors.white : Colors.grey.shade50,
          border: Border(bottom: BorderSide(color: Colors.grey.shade200, width: 0.5)),
        ),
        child: Row(
          children: [
            Expanded(
              flex: 3,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(m.toPhoneE164, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13)),
                  if (simLabel.isNotEmpty)
                    Text(simLabel, style: TextStyle(fontSize: 10, color: Colors.grey.shade500)),
                ],
              ),
            ),
            Expanded(
              flex: 3,
              child: Text(preview, style: TextStyle(color: Colors.grey.shade700, fontSize: 12), maxLines: 2, overflow: TextOverflow.ellipsis),
            ),
            Expanded(
              flex: 2,
              child: Center(
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(
                    color: statusInfo.$3,
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Text(statusInfo.$1, style: TextStyle(color: statusInfo.$2, fontWeight: FontWeight.w700, fontSize: 10)),
                ),
              ),
            ),
            Expanded(
              flex: 2,
              child: Text(
                _shortDate(time),
                style: TextStyle(color: Colors.grey.shade600, fontSize: 11),
                textAlign: TextAlign.right,
              ),
            ),
          ],
        ),
      ),
    );
  }

  void _showMessageDetail(OutboxMessage m) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (ctx) {
        final statusInfo = _statusInfo(m.status);
        return DraggableScrollableSheet(
          expand: false,
          initialChildSize: 0.55,
          minChildSize: 0.3,
          maxChildSize: 0.85,
          builder: (_, scrollCtrl) => ListView(
            controller: scrollCtrl,
            padding: const EdgeInsets.all(24),
            children: [
              Center(
                child: Container(width: 40, height: 4, decoration: BoxDecoration(color: Colors.grey.shade300, borderRadius: BorderRadius.circular(2))),
              ),
              const SizedBox(height: 20),
              Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(color: statusInfo.$3, borderRadius: BorderRadius.circular(12)),
                    child: Icon(
                      m.status == 'sent' ? Icons.check_circle_rounded
                          : m.status == 'failed' ? Icons.error_rounded
                          : m.status == 'sending' ? Icons.send_rounded
                          : Icons.hourglass_top_rounded,
                      color: statusInfo.$2, size: 24,
                    ),
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(m.toPhoneE164, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
                        const SizedBox(height: 4),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                          decoration: BoxDecoration(color: statusInfo.$3, borderRadius: BorderRadius.circular(12)),
                          child: Text(statusInfo.$1, style: TextStyle(color: statusInfo.$2, fontWeight: FontWeight.w700, fontSize: 12)),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 20),
              _detailRow('Message', m.body),
              if (m.simSubscriptionId != null) _detailRow('SIM', 'SIM ${m.simSubscriptionId}'),
              _detailRow('Cr\u00e9\u00e9', _formatDateTimeFr(m.createdAt)),
              if (m.sentAt != null) _detailRow('Envoy\u00e9', _formatDateTimeFr(m.sentAt!)),
              _detailRow('Tentatives', '${m.tryCount}'),
              if (m.lastError != null && m.lastError!.isNotEmpty)
                _detailRow('Erreur', m.lastError!, isError: true),
            ],
          ),
        );
      },
    );
  }

  Widget _detailRow(String label, String value, {bool isError = false}) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: TextStyle(fontWeight: FontWeight.w600, fontSize: 12, color: Colors.grey.shade600)),
          const SizedBox(height: 4),
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: isError ? Colors.red.shade50 : Colors.grey.shade50,
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: isError ? Colors.red.shade200 : Colors.grey.shade200),
            ),
            child: Text(value, style: TextStyle(color: isError ? Colors.red.shade700 : Colors.black87, fontSize: 14)),
          ),
        ],
      ),
    );
  }

  (String, Color, Color) _statusInfo(String status) {
    switch (status) {
      case 'sent': return ('Envoy\u00e9', Colors.green.shade700, Colors.green.shade50);
      case 'failed': return ('\u00c9chec', Colors.red.shade700, Colors.red.shade50);
      case 'sending': return ('En cours', Colors.orange.shade700, Colors.orange.shade50);
      case 'skipped_optout': return ('Opt-out', Colors.grey.shade700, Colors.grey.shade100);
      default: return ('En attente', Colors.blue.shade700, Colors.blue.shade50);
    }
  }

  String _shortDate(DateTime d) {
    final now = DateTime.now();
    final diff = now.difference(d);
    if (diff.inMinutes < 1) return '\u00e0 l\'instant';
    if (diff.inHours < 1) return 'il y a ${diff.inMinutes}m';
    if (diff.inDays < 1) {
      final hh = d.hour.toString().padLeft(2, '0');
      final mm = d.minute.toString().padLeft(2, '0');
      return '$hh:$mm';
    }
    final dd = d.day.toString().padLeft(2, '0');
    final mo = d.month.toString().padLeft(2, '0');
    return '$dd/$mo/${d.year}';
  }
}

class _SubscriptionSection extends StatelessWidget {
  const _SubscriptionSection({required this.appState, required this.notifier});
  final AppState appState;
  final AppNotifier notifier;

  @override
  Widget build(BuildContext context) {
    final planName = appState.planName ?? 'Essai';
    final quota = appState.planSmsQuotaMonth;
    final used = appState.smsUsedThisMonth ?? 0;
    final remaining = appState.quotaRemaining;
    final maxDevices = appState.planMaxDevices;
    final end = appState.subscriptionPeriodEnd;
    return ListView(
      physics: const BouncingScrollPhysics(),
      padding: const EdgeInsets.only(top: 120, left: 20, right: 20, bottom: 20),
      children: [
        // Plan actuel avec gradient
        _ModernCard(
          gradient: const LinearGradient(
            colors: [Color(0xFF3B82F6), Color(0xFF60A5FA)],
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Container(
        padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: Colors.white.withOpacity(0.2),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: const Icon(
                      Icons.workspace_premium_rounded,
                      color: Colors.white,
                      size: 28,
                    ),
                  ),
                  const SizedBox(width: 16),
                  Expanded(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
                        Text(
                          'Plan: $planName',
                          style: TextStyle(
                            color: Colors.white,
                            fontSize: 20,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                        SizedBox(height: 4),
                        Text(
                          end == null ? 'Abonnement actif' : 'Actif jusqu’au ${_formatDateFr(end)}',
                          style: TextStyle(
                            color: Colors.white70,
                            fontSize: 13,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 20),
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: Colors.white.withOpacity(0.15),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(
                    color: Colors.white.withOpacity(0.3),
                  ),
                ),
                child: Column(
                  children: [
                    _StatRow(
                      label: 'Quota SMS mensuel',
                      value: quota == null ? '—' : '${quota.toString()} SMS',
                      icon: Icons.sms_rounded,
                    ),
                    SizedBox(height: 12),
                    _StatRow(
                      label: 'Appareils autorisés',
                      value: maxDevices == null ? '—' : '$maxDevices appareils',
                      icon: Icons.devices_rounded,
                    ),
                    SizedBox(height: 12),
                    _StatRow(
                      label: 'Renouvellement',
                      value: 'Mensuel',
                      icon: Icons.autorenew_rounded,
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 20),
        
        // Statistiques d'utilisation
        _ModernCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'Utilisation ce mois-ci',
                style: TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.bold,
                  color: Colors.black87,
                ),
              ),
              const SizedBox(height: 20),
              // Barre de progression
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text(
                        'SMS envoyés',
                        style: TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                      Text(
                        quota == null
                            ? '—'
                            : (quota == 0
                                ? '$used / ∞'
                                : '$used / $quota (reste ${remaining ?? (quota - used).clamp(0, quota)})'),
                        style: TextStyle(
                          fontSize: 14,
                          color: Colors.grey.shade600,
                        ),
                      ),
                    ],
                  ),
            const SizedBox(height: 8),
                  ClipRRect(
                    borderRadius: BorderRadius.circular(10),
                    child: LinearProgressIndicator(
                      // quota == 0 => illimité: ne pas afficher une barre "infinie" (ça donne l'impression de boucle).
                      value: (quota == null)
                          ? null
                          : (quota == 0 ? 1.0 : (quota > 0 ? (used / quota).clamp(0.0, 1.0) : null)),
                      minHeight: 8,
                      backgroundColor: Colors.grey.shade200,
                      valueColor: const AlwaysStoppedAnimation<Color>(
                        Color(0xFF16A34A),
                      ),
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    quota == null
                        ? '—'
                        : (quota == 0
                            ? 'Illimité'
                            : '${((used / quota) * 100).clamp(0, 100).toStringAsFixed(0)}% utilisé • reste ${remaining ?? (quota - used).clamp(0, quota)}'),
                    style: TextStyle(
                      fontSize: 12,
                      color: Colors.grey.shade600,
                    ),
                  ),
                  if (quota != null && quota > 0 && (remaining ?? 0) <= 0) ...[
                    const SizedBox(height: 10),
                    Container(
                      width: double.infinity,
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: Colors.red.shade50,
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: Colors.red.shade200),
                      ),
                      child: Text(
                        '🚫 Quota gratuit atteint: 0 SMS restant ce mois.\nLes messages restants restent en attente jusqu’au renouvellement ou un upgrade.',
                        style: TextStyle(color: Colors.red.shade700, fontWeight: FontWeight.w600, fontSize: 12),
                      ),
                    ),
                  ],
                ],
              ),
              const SizedBox(height: 24),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton.icon(
                  onPressed: () {
                    HapticFeedback.mediumImpact();
                    notifier.refreshSubscription(silent: false);
                  },
                  style: ElevatedButton.styleFrom(
                    padding: const EdgeInsets.symmetric(vertical: 16),
                  ),
                  icon: const Icon(Icons.upgrade_rounded),
                  label: const Text('Actualiser mon abonnement'),
                ),
              ),
              const SizedBox(height: 12),
              SizedBox(
                width: double.infinity,
                child: OutlinedButton.icon(
                  onPressed: !appState.authenticated
                      ? null
                      : () async {
                          HapticFeedback.mediumImpact();
                          final uri = Uri.parse('${AppConfig.webApiBaseUrl}/billing/plans');
                          final ok = await launchUrl(uri, mode: LaunchMode.externalApplication);
                          if (!ok && context.mounted) {
                            ScaffoldMessenger.of(context).showSnackBar(
                              const SnackBar(content: Text('Impossible d’ouvrir la page des plans.')),
                            );
                          }
                        },
                  style: OutlinedButton.styleFrom(
                    padding: const EdgeInsets.symmetric(vertical: 16),
                  ),
                  icon: const Icon(Icons.shopping_cart_checkout_rounded),
                  label: const Text('Voir les plans & s’abonner'),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _StatRow extends StatelessWidget {
  const _StatRow({
    required this.label,
    required this.value,
    required this.icon,
  });

  final String label;
  final String value;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Icon(icon, color: Colors.white, size: 20),
        const SizedBox(width: 12),
        Expanded(
          child: Text(
            label,
            style: const TextStyle(
              color: Colors.white70,
              fontSize: 14,
            ),
          ),
        ),
        Text(
          value,
          style: const TextStyle(
            color: Colors.white,
            fontSize: 14,
            fontWeight: FontWeight.w600,
          ),
        ),
      ],
    );
  }
}

class _DevicesSection extends StatelessWidget {
  const _DevicesSection({required this.appState, required this.notifier});
  final AppState appState;
  final AppNotifier notifier;

  @override
  Widget build(BuildContext context) {
    return ListView(
      physics: const BouncingScrollPhysics(),
      padding: const EdgeInsets.only(top: 120, left: 20, right: 20, bottom: 20),
      children: [
        if (appState.deviceToken != null) ...[
          // Card appareil actuel
          _ModernCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: const Color(0xFF16A34A).withOpacity(0.1),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: const Icon(
                        Icons.phone_android_rounded,
                        color: Color(0xFF16A34A),
                        size: 28,
                      ),
                    ),
                    const SizedBox(width: 16),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text(
                            'Cet appareil',
                            style: TextStyle(
                              fontSize: 18,
                              fontWeight: FontWeight.bold,
                              color: Colors.black87,
                            ),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            (appState.deviceName == null || appState.deviceName!.isEmpty)
                                ? 'Android'
                                : '${appState.deviceName} • Android',
                            style: TextStyle(
                              color: Colors.grey.shade600,
                              fontSize: 14,
                            ),
                          ),
                          if (appState.lastHeartbeatAt != null) ...[
                            const SizedBox(height: 4),
                            Text(
                              'Dernier ping: ${_formatDateTimeFr(appState.lastHeartbeatAt!)}',
                              style: TextStyle(color: Colors.grey.shade600, fontSize: 12),
                            ),
                          ],
                        ],
                      ),
                    ),
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 12,
                        vertical: 6,
                      ),
                      decoration: BoxDecoration(
                        color: appState.syncing
                            ? Colors.orange.shade50
                            : const Color(0xFF16A34A).withOpacity(0.1),
                        borderRadius: BorderRadius.circular(20),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Container(
                            width: 8,
                            height: 8,
                            decoration: BoxDecoration(
                              color: appState.syncing
                                  ? Colors.orange
                                  : const Color(0xFF16A34A),
                              shape: BoxShape.circle,
                            ),
                          ),
                          const SizedBox(width: 6),
                          Text(
                            appState.syncing ? 'Sync...' : 'En ligne',
                            style: TextStyle(
                              color: appState.syncing
                                  ? Colors.orange.shade700
                                  : const Color(0xFF16A34A),
                              fontSize: 12,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 20),
                Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: Colors.grey.shade50,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: Colors.grey.shade200),
                  ),
                  child: Row(
                    children: [
                      Icon(
                        Icons.key_rounded,
                        color: Colors.grey.shade600,
                        size: 20,
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'Token',
                              style: TextStyle(
                                fontSize: 12,
                                color: Colors.grey.shade600,
                              ),
                            ),
                            const SizedBox(height: 4),
                            Text(
                              appState.deviceToken!,
                              style: const TextStyle(
                                fontSize: 13,
                                fontFamily: 'monospace',
                                fontWeight: FontWeight.w500,
                              ),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 16),
                Row(
                  children: [
                    Expanded(
                      child: OutlinedButton.icon(
                        onPressed: () {
                          HapticFeedback.lightImpact();
                          notifier.refreshDeviceStatus(silent: false);
                        },
                        icon: const Icon(Icons.refresh_rounded),
                        label: const Text('Actualiser'),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: OutlinedButton.icon(
                        onPressed: () {
                          HapticFeedback.lightImpact();
                          final tokenUi = _formatDeviceTokenForUi(appState.deviceToken);
                          ScaffoldMessenger.of(context).showSnackBar(
                            SnackBar(content: Text('Token: $tokenUi')),
                          );
                        },
                        icon: const Icon(Icons.info_outline_rounded),
                        label: const Text('Détails'),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ] else ...[
          // Empty state
          _ModernCard(
            child: Center(
              child: Padding(
                padding: const EdgeInsets.all(32.0),
                child: Column(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(24),
                      decoration: BoxDecoration(
                        color: Colors.grey.shade100,
                        shape: BoxShape.circle,
                      ),
                      child: Icon(
                        Icons.devices_other_rounded,
                        size: 64,
                        color: Colors.grey.shade400,
                      ),
                    ),
                    const SizedBox(height: 24),
                    Text(
                      'Aucun appareil jumelé',
                      style: TextStyle(
                        color: Colors.grey.shade800,
                        fontSize: 18,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      'Scannez un QR code depuis le dashboard web pour jumeler cet appareil',
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        color: Colors.grey.shade600,
                        fontSize: 14,
                      ),
                    ),
                    const SizedBox(height: 24),
                    ElevatedButton.icon(
                      onPressed: () {
                        HapticFeedback.mediumImpact();
                      },
                      icon: const Icon(Icons.qr_code_scanner_rounded),
                      label: const Text('Scanner un QR code'),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ],
      ],
    );
  }
}

class _ProfileSection extends StatelessWidget {
  const _ProfileSection({required this.appState, required this.notifier});
  final AppState appState;
  final AppNotifier notifier;

  @override
  Widget build(BuildContext context) {
    return ListView(
      physics: const BouncingScrollPhysics(),
      padding: const EdgeInsets.only(top: 120, left: 20, right: 20, bottom: 20),
      children: [
        // Avatar et informations
        _ModernCard(
          child: Column(
            children: [
              Container(
                width: 80,
                height: 80,
                decoration: BoxDecoration(
                  gradient: const LinearGradient(
                    colors: [Color(0xFF16A34A), Color(0xFF22C55E)],
                  ),
                  shape: BoxShape.circle,
                  boxShadow: [
                    BoxShadow(
                      color: const Color(0xFF16A34A).withOpacity(0.3),
                      blurRadius: 12,
                      offset: const Offset(0, 4),
                    ),
                  ],
                ),
                child: const Icon(
                  Icons.person_rounded,
                  size: 40,
                  color: Colors.white,
                ),
              ),
              const SizedBox(height: 16),
              Text(
                appState.userEmail ?? 'Utilisateur',
                style: const TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.bold,
                  color: Colors.black87,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                appState.orgName ?? 'Compte Supabase',
                style: TextStyle(
                  fontSize: 14,
                  color: Colors.grey.shade600,
                ),
              ),
              const SizedBox(height: 24),
              // Informations
              _ProfileInfoTile(
                icon: Icons.email_rounded,
                label: 'Email',
                value: appState.userEmail ?? '—',
              ),
              const SizedBox(height: 12),
              _ProfileInfoTile(
                icon: Icons.business_rounded,
                label: 'Organisation',
                value: appState.orgName ?? '—',
              ),
              const SizedBox(height: 12),
              _ProfileInfoTile(
                icon: Icons.calendar_today_rounded,
                label: 'Membre depuis',
                value: appState.memberSince == null ? '—' : _formatDateFr(appState.memberSince!),
              ),
            ],
          ),
        ),
        const SizedBox(height: 20),
        
        // Actions
        _ModernCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'Actions',
                style: TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.bold,
                  color: Colors.black87,
                ),
              ),
              const SizedBox(height: 16),
              _ActionButton(
                icon: Icons.lock_reset_rounded,
                label: 'Changer le mot de passe',
                onTap: () async {
                  HapticFeedback.mediumImpact();
                  await _showChangePasswordDialog(context, notifier);
                },
              ),
              const SizedBox(height: 12),
              _ActionButton(
                icon: Icons.settings_rounded,
                label: 'Paramètres',
                onTap: () async {
                  HapticFeedback.lightImpact();
                  await _showSettingsSheet(context);
                },
              ),
              const SizedBox(height: 12),
              _ActionButton(
                icon: Icons.help_outline_rounded,
                label: 'Aide & Support',
                onTap: () async {
                  HapticFeedback.lightImpact();
                  final uri = Uri.parse('https://wa.me/2250778030075?text=Bonjour%20Support%20SMS%20Gateway');
                  final ok = await launchUrl(uri, mode: LaunchMode.externalApplication);
                  if (!ok && context.mounted) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(content: Text('Impossible d’ouvrir WhatsApp.')),
                    );
                  }
                },
              ),
              const SizedBox(height: 12),
              _ActionButton(
                icon: Icons.open_in_new_rounded,
                label: 'Ouvrir le dashboard web',
                onTap: () async {
                  HapticFeedback.mediumImpact();
                  final uri = Uri.parse('${AppConfig.webApiBaseUrl}/dashboard');
                  await launchUrl(uri, mode: LaunchMode.externalApplication);
                },
              ),
              const SizedBox(height: 12),
              _ActionButton(
                icon: Icons.info_outline_rounded,
                label: 'À propos',
                onTap: () {
                  HapticFeedback.lightImpact();
                },
                trailing: Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 8,
                    vertical: 4,
                  ),
                  decoration: BoxDecoration(
                    color: const Color(0xFF16A34A).withOpacity(0.1),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text(
                    'v${appState.appVersion ?? '—'}',
                    style: const TextStyle(
                      fontSize: 12,
                      color: Color(0xFF16A34A),
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
              ),
              const SizedBox(height: 12),
              _ActionButton(
                icon: Icons.refresh_rounded,
                label: 'Actualiser mes infos',
                onTap: () async {
                  HapticFeedback.mediumImpact();
                  await notifier.refreshAccountInfo();
                  await notifier.refreshSubscription(silent: true);
                  await notifier.refreshInboxMessages(silent: true);
                  await notifier.refreshOutboxHistory(silent: true);
                  await notifier.refreshDeviceStatus(silent: true);
                  if (context.mounted) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(content: Text('Infos actualisées ✅')),
                    );
                  }
                },
              ),
            ],
          ),
        ),
      ],
    );
  }
}

Future<void> _showSettingsSheet(BuildContext context) async {
  await showModalBottomSheet<void>(
    context: context,
    showDragHandle: true,
    isScrollControlled: true,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
    ),
    builder: (ctx) {
      return StatefulBuilder(
        builder: (ctx, setState) {
          bool loading = false;
          bool enabled = false;
          bool paused = false;
          int delayMs = AppSettings.defaultDelayMs;
          bool delayLoaded = false;

          Future<void> load() async {
            final e = await BackgroundSyncService.isEnabled();
            final p = await BackgroundSyncService.isPaused();
            final d = await AppSettings.getSmsDelayMs();
            setState(() {
              enabled = e;
              paused = p;
              delayMs = d;
              delayLoaded = true;
            });
          }

          scheduleMicrotask(load);

          Future<void> toggleEnabled(bool v) async {
            setState(() => loading = true);
            await BackgroundSyncService.setEnabled(v);
            if (v) {
              await BackgroundSyncService.setPaused(false);
              await BackgroundSyncService.start();
            } else {
              await BackgroundSyncService.stop();
            }
            await load();
            setState(() => loading = false);
          }

          Future<void> togglePause() async {
            setState(() => loading = true);
            await BackgroundSyncService.setPaused(!paused);
            await load();
            setState(() => loading = false);
          }

          Future<void> stop() async {
            setState(() => loading = true);
            await BackgroundSyncService.setPaused(false);
            await BackgroundSyncService.setEnabled(false);
            await BackgroundSyncService.stop();
            await load();
            setState(() => loading = false);
          }

          Future<void> saveDelay(int ms) async {
            await AppSettings.setSmsDelayMs(ms);
            setState(() => delayMs = ms);
          }

          String delayLabel() {
            if (!delayLoaded) return 'Chargement...';
            if (delayMs < 1000) return '${delayMs}ms (rapide)';
            final secs = (delayMs / 1000).toStringAsFixed(delayMs % 1000 == 0 ? 0 : 1);
            return '${secs}s';
          }

          return SafeArea(
            child: SingleChildScrollView(
              padding: const EdgeInsets.fromLTRB(20, 4, 20, 24),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.all(8),
                        decoration: BoxDecoration(
                          color: Colors.blue.shade50,
                          borderRadius: BorderRadius.circular(10),
                        ),
                        child: Icon(Icons.settings_rounded, color: Colors.blue.shade700, size: 22),
                      ),
                      const SizedBox(width: 12),
                      const Text(
                        'Paramètres',
                        style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                      ),
                    ],
                  ),
                  const SizedBox(height: 18),

                  // ─── Délai entre SMS ─────────────────────────────────────
                  Row(
                    children: [
                      Icon(Icons.timer_outlined, size: 18, color: Colors.grey.shade700),
                      const SizedBox(width: 8),
                      const Text('Délai entre chaque SMS',
                          style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600)),
                      const Spacer(),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                        decoration: BoxDecoration(
                          color: Colors.blue.shade50,
                          borderRadius: BorderRadius.circular(10),
                        ),
                        child: Text(delayLabel(),
                            style: TextStyle(
                                fontSize: 13,
                                fontWeight: FontWeight.bold,
                                color: Colors.blue.shade700)),
                      ),
                    ],
                  ),
                  const SizedBox(height: 6),
                  Slider(
                    min: AppSettings.minDelayMs.toDouble(),
                    max: AppSettings.maxDelayMs.toDouble(),
                    divisions: (AppSettings.maxDelayMs - AppSettings.minDelayMs) ~/ 500,
                    value: delayMs
                        .clamp(AppSettings.minDelayMs, AppSettings.maxDelayMs)
                        .toDouble(),
                    label: delayLabel(),
                    onChanged: !delayLoaded
                        ? null
                        : (v) {
                            setState(() => delayMs = (v / 500).round() * 500);
                          },
                    onChangeEnd: !delayLoaded ? null : (v) => saveDelay((v / 500).round() * 500),
                  ),
                  Text(
                    'Plus rapide = plus de risque que l\'opérateur bloque les SMS. '
                    'Recommandé : 1,5s à 2s.',
                    style: TextStyle(fontSize: 11.5, color: Colors.grey.shade600),
                  ),
                  const SizedBox(height: 18),
                  const Divider(),
                  const SizedBox(height: 12),

                  // ─── Envoi en arrière-plan ────────────────────────────────
                  Row(
                    children: [
                      Icon(Icons.cloud_sync_outlined, size: 18, color: Colors.grey.shade700),
                      const SizedBox(width: 8),
                      const Text('Envoi en arrière-plan',
                          style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600)),
                    ],
                  ),
                  const SizedBox(height: 6),
                  Text(
                    'Active une notification permanente pour continuer l\'envoi '
                    'même si tu fermes l\'application.',
                    style: TextStyle(color: Colors.grey.shade600, fontSize: 12),
                  ),
                  SwitchListTile(
                    contentPadding: EdgeInsets.zero,
                    dense: true,
                    title: const Text('Continuer en arrière-plan',
                        style: TextStyle(fontSize: 14)),
                    subtitle: const Text('Recommandé pour envoyer sans interruption',
                        style: TextStyle(fontSize: 12)),
                    value: enabled,
                    onChanged: loading ? null : toggleEnabled,
                  ),
                  if (enabled) ...[
                    Row(
                      children: [
                        Expanded(
                          child: OutlinedButton.icon(
                            onPressed: loading ? null : togglePause,
                            icon: Icon(
                                paused ? Icons.play_arrow_rounded : Icons.pause_rounded,
                                size: 18),
                            label: Text(paused ? 'Reprendre' : 'Pause',
                                style: const TextStyle(fontSize: 13)),
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: OutlinedButton.icon(
                            onPressed: loading ? null : stop,
                            icon: const Icon(Icons.stop_rounded, size: 18),
                            label: const Text('Arrêter', style: TextStyle(fontSize: 13)),
                            style: OutlinedButton.styleFrom(
                              foregroundColor: Colors.red.shade700,
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 8),
                    Text(
                      paused ? 'Statut : en pause' : 'Statut : actif',
                      style: TextStyle(
                          color: paused ? Colors.orange.shade700 : Colors.green.shade700,
                          fontSize: 12),
                    ),
                  ],
                  const SizedBox(height: 22),
                  SizedBox(
                    width: double.infinity,
                    child: FilledButton(
                      onPressed: () => Navigator.of(ctx).pop(),
                      child: const Text('Fermer'),
                    ),
                  ),
                ],
              ),
            ),
          );
        },
      );
    },
  );
}

Future<void> _showChangePasswordDialog(BuildContext context, AppNotifier notifier) async {
  final c1 = TextEditingController();
  final c2 = TextEditingController();
  bool saving = false;
  String? error;

  await showDialog<void>(
    context: context,
    builder: (ctx) {
      return StatefulBuilder(
        builder: (ctx, setState) {
          Future<void> submit() async {
            final p1 = c1.text;
            final p2 = c2.text;
            if (p1.length < 8) {
              setState(() => error = 'Mot de passe trop court (min 8 caractères).');
              return;
            }
            if (p1 != p2) {
              setState(() => error = 'Les mots de passe ne correspondent pas.');
              return;
            }

            setState(() {
              saving = true;
              error = null;
            });
            try {
              final supabase = notifier.ref.read(supabaseClientProvider);
              if (supabase.auth.currentUser == null) {
                throw Exception('Non connecté');
              }
              await supabase.auth.updateUser(UserAttributes(password: p1));
              if (ctx.mounted) Navigator.of(ctx).pop();
              if (context.mounted) {
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('Mot de passe mis à jour ✅')),
                );
              }
            } catch (e) {
              setState(() => error = e.toString());
            } finally {
              setState(() => saving = false);
            }
          }

          return AlertDialog(
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
            title: const Text('Changer le mot de passe'),
            content: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                TextField(
                  controller: c1,
                  obscureText: true,
                  decoration: const InputDecoration(
                    labelText: 'Nouveau mot de passe',
                  ),
                ),
                const SizedBox(height: 10),
                TextField(
                  controller: c2,
                  obscureText: true,
                  decoration: const InputDecoration(
                    labelText: 'Confirmer le mot de passe',
                  ),
                ),
                if (error != null) ...[
                  const SizedBox(height: 12),
                  Text(error!, style: TextStyle(color: Colors.red.shade700)),
                ],
              ],
            ),
            actions: [
              TextButton(
                onPressed: saving ? null : () => Navigator.of(ctx).pop(),
                child: const Text('Annuler'),
              ),
              FilledButton(
                onPressed: saving ? null : submit,
                child: Text(saving ? 'Mise à jour…' : 'Valider'),
              ),
            ],
          );
        },
      );
    },
  );
}

class _ProfileInfoTile extends StatelessWidget {
  const _ProfileInfoTile({
    required this.icon,
    required this.label,
    required this.value,
  });

  final IconData icon;
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.grey.shade50,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: Colors.grey.shade200),
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: const Color(0xFF16A34A).withOpacity(0.1),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Icon(
              icon,
              color: const Color(0xFF16A34A),
              size: 20,
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  label,
                  style: TextStyle(
                    fontSize: 12,
                    color: Colors.grey.shade600,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  value,
                  style: const TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                    color: Colors.black87,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _ActionButton extends StatelessWidget {
  const _ActionButton({
    required this.icon,
    required this.label,
    required this.onTap,
    this.trailing,
  });

  final IconData icon;
  final String label;
  final VoidCallback onTap;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          border: Border.all(color: Colors.grey.shade200),
          borderRadius: BorderRadius.circular(12),
        ),
        child: Row(
          children: [
            Icon(
              icon,
              color: Colors.grey.shade700,
              size: 22,
            ),
            const SizedBox(width: 16),
            Expanded(
              child: Text(
                label,
                style: const TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.w500,
                  color: Colors.black87,
                ),
              ),
            ),
            trailing ??
                Icon(
                  Icons.chevron_right_rounded,
                  color: Colors.grey.shade400,
                ),
          ],
        ),
      ),
    );
  }
}

