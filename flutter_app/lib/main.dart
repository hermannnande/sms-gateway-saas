import 'dart:async';
import 'dart:ui';
import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:logger/logger.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import 'package:package_info_plus/package_info_plus.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:smsgateway_flutter/config.dart';
import 'package:smsgateway_flutter/models/inbox_message.dart';
import 'package:smsgateway_flutter/models/message.dart';
import 'package:smsgateway_flutter/models/outbox_message.dart';
import 'package:smsgateway_flutter/services/device_service.dart';
import 'package:smsgateway_flutter/services/app_update_service.dart';
import 'package:smsgateway_flutter/services/sms_sender.dart';
import 'package:smsgateway_flutter/services/token_storage.dart';
import 'package:supabase/supabase.dart';

/// Providers (dépendances partagées)
final loggerProvider = Provider<Logger>((_) => Logger());

final supabaseClientProvider = Provider<SupabaseClient>(
  (ref) => SupabaseClient(
    AppConfig.supabaseUrl,
    AppConfig.supabaseAnonKey,
  ),
);

final tokenStorageProvider = Provider<TokenStorage>((_) => TokenStorage());

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
    );
  }
}

/// Contrôleur d'état (Riverpod)
final appProvider = NotifierProvider<AppNotifier, AppState>(AppNotifier.new);

/// Sections du dashboard (navigation app)
enum AppSection {
  dashboard,
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

    // Vérifier s'il existe déjà une session supabase (auth)
    final supabase = ref.read(supabaseClientProvider);
    final session = supabase.auth.currentSession;
    final hasSession = session != null;
    state = state.copyWith(
      loading: false,
      deviceToken: token,
      authenticated: hasSession,
    );

    // Charger infos réelles (profil / org / version / inbox / historique)
    await _loadAppVersion();
    if (hasSession) {
      await refreshAccountInfo();
      await refreshInboxMessages(silent: true);
      await refreshOutboxHistory(silent: true);
      await refreshSubscription(silent: true);
    }
  }

  Future<void> _loadAppVersion() async {
    try {
      final info = await PackageInfo.fromPlatform();
      state = state.copyWith(appVersion: '${info.version}+${info.buildNumber}');
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
    int page = 0,
    int pageSize = 20,
  }) async {
    try {
      final supabase = ref.read(supabaseClientProvider);
      final user = supabase.auth.currentUser;
      if (user == null) return;

      // Assurer org_id
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

  Future<void> refreshSubscription({bool silent = true}) async {
    try {
      final supabase = ref.read(supabaseClientProvider);
      if (supabase.auth.currentUser == null) return;
      if (state.orgId == null) {
        await refreshAccountInfo();
      }
      final orgId = state.orgId;
      if (orgId == null) return;

      final row = await supabase
          .from('subscriptions')
          .select('current_period_end, plans(name, sms_quota_month, max_devices)')
          .eq('org_id', orgId)
          .eq('status', 'active')
          .order('current_period_end', ascending: false)
          .limit(1)
          .maybeSingle();

      if (row == null) {
        state = state.copyWith(
          planName: null,
          planSmsQuotaMonth: null,
          planMaxDevices: null,
          subscriptionPeriodEnd: null,
        );
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
      final payload = await ref.read(deviceServiceProvider).sendHeartbeatVerbose(deviceToken: token);
      final name = payload['device_name']?.toString();
      final ts = payload['timestamp']?.toString();
      state = state.copyWith(
        deviceName: name,
        lastHeartbeatAt: ts == null ? DateTime.now() : (DateTime.tryParse(ts) ?? DateTime.now()),
      );
    } catch (e) {
      if (!silent) setLastStatus('Statut appareil: $e');
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
    state = state.copyWith(authenticated: true);
    await refreshAccountInfo();
    await refreshSubscription(silent: true);
    await refreshInboxMessages(silent: true);
    await refreshOutboxHistory(silent: true);
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
    state = state.copyWith(authenticated: true);
    await refreshAccountInfo();
    await refreshSubscription(silent: true);
    await refreshInboxMessages(silent: true);
    await refreshOutboxHistory(silent: true);
  }

  Future<void> signInWithRefreshToken({
    required String refreshToken,
  }) async {
    final supabase = ref.read(supabaseClientProvider);
    final res = await supabase.auth.refreshSession(refreshToken);
    if (res.session == null) {
      throw Exception('Session invalide. Régénérez le QR sur le web et réessayez.');
    }
    state = state.copyWith(authenticated: true);
    await refreshAccountInfo();
    await refreshSubscription(silent: true);
    await refreshInboxMessages(silent: true);
    await refreshOutboxHistory(silent: true);
  }

  Future<void> syncOnce({bool silentIfEmpty = false}) async {
    final token = state.deviceToken;
    if (token == null || token.isEmpty) {
      state = state.copyWith(lastStatus: 'Aucun token enregistré');
      return;
    }

    state = state.copyWith(syncing: true, lastStatus: 'Synchronisation...');

    try {
      final permissionsOk = await ref.read(smsSenderProvider).ensurePermissions();
      if (!permissionsOk) {
        state = state.copyWith(lastStatus: 'Permissions SMS/Phone nécessaires');
        return;
      }

      // Charger les SIMs une fois si vide (pour router les campagnes SIM1/SIM2).
      if (state.availableSims.isEmpty) {
        await refreshSimCards();
      }

      final messages = await ref.read(deviceServiceProvider).claimMessages(
            deviceToken: token,
            limit: AppConfig.claimBatchSize,
            // La SIM est décidée côté campagne web (via sim_slot_index),
            // claim_messages_atomic renvoie ensuite sim_subscription_id = "slot:X".
            simSubscriptionId: null,
          );

      if (messages.isEmpty) {
        if (!silentIfEmpty) {
          state = state.copyWith(
            lastStatus: 'Aucun message à envoyer',
            lastMessages: const [],
          );
        }
        return;
      }

      final results = <String>[];

      for (final msg in messages) {
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

        final label = sendResult.success ? '✅ sent' : '❌ failed';
        results.add('$label -> ${msg.to}');
      }

      state = state.copyWith(
        lastMessages: messages,
        lastStatus: results.join('\n'),
      );
    } catch (e, st) {
      ref.read(loggerProvider).e('syncOnce error', error: e, stackTrace: st);
      state = state.copyWith(lastStatus: 'Erreur sync: $e');
    } finally {
      state = state.copyWith(syncing: false);
    }
  }
}

void main() {
  WidgetsFlutterBinding.ensureInitialized();
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
  bool _checkedUpdate = false;

  @override
  void initState() {
    super.initState();
    scheduleMicrotask(() => ref.read(appProvider.notifier).init());
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
      cardTheme: CardTheme(
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
            : appState.deviceToken == null
                ? const PairingPage(key: ValueKey('pairing'))
                : const HomePage(key: ValueKey('home')),
      ),
    );
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    // Check update once (after first build)
    if (_checkedUpdate) return;
    _checkedUpdate = true;
    WidgetsBinding.instance.addPostFrameCallback((_) => _checkUpdateIfNeeded());
  }

  Future<void> _checkUpdateIfNeeded() async {
    try {
      final update = await ref.read(appUpdateServiceProvider).checkForUpdate();
      if (!mounted || update == null) return;

      // Ne pas spammer si un dialogue est déjà ouvert
      if (!mounted) return;
      // ignore: use_build_context_synchronously
      await showDialog<void>(
        context: context,
        barrierDismissible: true,
        builder: (ctx) {
          return AlertDialog(
            title: Text('Mise à jour disponible (${update.latestVersion})'),
            content: SingleChildScrollView(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'Une nouvelle version de l’app est disponible.',
                  ),
                  const SizedBox(height: 12),
                  if (update.notes != null && update.notes!.isNotEmpty) ...[
                    const Text('Notes de version :', style: TextStyle(fontWeight: FontWeight.w700)),
                    const SizedBox(height: 6),
                    Text(update.notes!),
                  ],
                ],
              ),
            ),
            actions: [
              TextButton(
                onPressed: () async {
                  await ref.read(appUpdateServiceProvider).ignoreVersion(update.latestVersion);
                  if (ctx.mounted) Navigator.of(ctx).pop();
                },
                child: const Text('Ignorer'),
              ),
              TextButton(
                onPressed: () async {
                  await ref.read(appUpdateServiceProvider).openReleasePage(update.releaseUrl);
                },
                child: const Text('Détails'),
              ),
              FilledButton(
                onPressed: () async {
                  await ref.read(appUpdateServiceProvider).openApkDownload(update.apkUrl);
                },
                child: const Text('Télécharger'),
              ),
            ],
          );
        },
      );
    } catch (e, st) {
      ref.read(loggerProvider).w('Update check failed', error: e, stackTrace: st);
    }
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

    // Demander les permissions dès l’arrivée sur le dashboard (sans refresh).
    scheduleMicrotask(_requestSmsPermissionsOnStart);
    // Charger la liste SIM dès l'arrivée (pour le sélecteur SIM).
    scheduleMicrotask(() => ref.read(appProvider.notifier).refreshSimCards());

    // Auto-sync: permet de réagir quand une campagne démarre côté web.
    _startAutoSync();
  }

  Future<void> _requestSmsPermissionsOnStart() async {
    final ok = await ref.read(smsSenderProvider).ensurePermissions();
    if (!ok) {
      ref.read(appProvider.notifier).setLastStatus(
            'Permissions SMS/Téléphone refusées. Active-les pour envoyer les SMS.',
          );
      if (!mounted) return;
      showDialog<void>(
        context: context,
        builder: (ctx) => AlertDialog(
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
          title: const Text('Permissions requises'),
          content: const Text(
            'Pour envoyer des SMS, l’app a besoin des permissions SMS et Téléphone. '
            'Accepte-les pour que les campagnes puissent démarrer.',
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(ctx).pop(),
              child: const Text('Plus tard'),
            ),
            FilledButton(
              onPressed: () async {
                Navigator.of(ctx).pop();
                await ref.read(smsSenderProvider).ensurePermissions();
              },
              child: const Text('Autoriser'),
            ),
          ],
        ),
      );
    }
  }

  void _startAutoSync() {
    // Premier check après 5s
    Future<void>.delayed(const Duration(seconds: 5), () {
      if (!mounted) return;
      final appState = ref.read(appProvider);
      if (appState.authenticated && (appState.deviceToken?.isNotEmpty ?? false)) {
        ref.read(appProvider.notifier).syncOnce(silentIfEmpty: true);
      }
    });

    _autoSyncTimer?.cancel();
    _autoSyncTimer = Timer.periodic(const Duration(seconds: 25), (_) {
      final appState = ref.read(appProvider);
      if (!appState.authenticated) return;
      if (!(appState.deviceToken?.isNotEmpty ?? false)) return;
      if (appState.syncing) return;
      ref.read(appProvider.notifier).syncOnce(silentIfEmpty: true);
    });
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

  @override
  void dispose() {
    _heartbeatTimer?.cancel();
    _autoSyncTimer?.cancel();
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
      body: Container(
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
    );
  }

  String _sectionTitle(AppSection section) {
    switch (section) {
      case AppSection.dashboard:
        return 'Dashboard';
      case AppSection.messages:
        return 'Messages';
      case AppSection.history:
        return 'Historique';
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
// NAVIGATION DRAWER + SECTIONS
// ============================================================================//

class _AppDrawer extends StatelessWidget {
  const _AppDrawer({
    required this.selected,
    required this.onSelect,
    required this.onLogout,
  });

  final AppSection selected;
  final ValueChanged<AppSection> onSelect;
  final VoidCallback onLogout;

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
                            'SMS Gateway',
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

// Dashboard (contenu d'origine regroupé)
class _DashboardSection extends StatelessWidget {
  const _DashboardSection({
    required this.appState,
    required this.notifier,
  });

  final AppState appState;
  final AppNotifier notifier;

  @override
  Widget build(BuildContext context) {
    return ListView(
      physics: const BouncingScrollPhysics(),
      padding: const EdgeInsets.only(top: 120, left: 20, right: 20, bottom: 20),
      children: [
        _StatusCardDashboard(appState: appState),
        const SizedBox(height: 20),
        _SyncCard(appState: appState, notifier: notifier),
        const SizedBox(height: 20),
        _MessagesCard(appState: appState),
      ],
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

class _MessagesCard extends StatelessWidget {
  const _MessagesCard({required this.appState});
  final AppState appState;

  @override
  Widget build(BuildContext context) {
    return _ModernCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text(
                'Derniers messages',
                style: TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.bold,
                  color: Colors.black87,
                ),
              ),
              if (appState.lastMessages.isNotEmpty)
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 12,
                    vertical: 6,
                  ),
                  decoration: BoxDecoration(
                    color: const Color(0xFF16A34A).withOpacity(0.1),
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Text(
                    '${appState.lastMessages.length}',
                    style: const TextStyle(
                      color: Color(0xFF16A34A),
                      fontWeight: FontWeight.bold,
                      fontSize: 14,
                    ),
                  ),
                ),
            ],
          ),
          const SizedBox(height: 16),
          if (appState.lastMessages.isEmpty)
            Center(
              child: Padding(
                padding: const EdgeInsets.all(32.0),
                child: Column(
                  children: [
                    Icon(
                      Icons.inbox_rounded,
                      size: 64,
                      color: Colors.grey.shade300,
                    ),
                    const SizedBox(height: 16),
                    Text(
                      'Aucun message traité',
                      style: TextStyle(
                        color: Colors.grey.shade600,
                        fontSize: 16,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ],
                ),
              ),
            )
          else
            ...appState.lastMessages.asMap().entries.map((entry) {
              final index = entry.key;
              final message = entry.value;
              return _MessageTile(
                message: message,
                index: index,
              );
            }),
        ],
      ),
    );
  }
}

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

class _HistorySection extends StatefulWidget {
  const _HistorySection({required this.appState, required this.notifier});
  final AppState appState;
  final AppNotifier notifier;

  @override
  State<_HistorySection> createState() => _HistorySectionState();
}

class _HistorySectionState extends State<_HistorySection> {
  String _status = 'all';
  String _query = '';
  int _page = 0;
  static const int _pageSize = 20;
  bool _loading = false;

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
        phoneQuery: _query,
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
    // Charger la page 1 si vide
    if (widget.appState.outboxHistory.isEmpty) {
      scheduleMicrotask(() => _load());
    }
  }

  @override
  Widget build(BuildContext context) {
    final list = widget.appState.outboxHistory;
    return ListView(
      physics: const BouncingScrollPhysics(),
      padding: const EdgeInsets.only(top: 120, left: 20, right: 20, bottom: 20),
      children: [
        _ModernCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'Historique des envois',
                style: TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.bold,
                  color: Colors.black87,
                ),
              ),
              const SizedBox(height: 12),

              // Filtres
              Row(
                children: [
                  Expanded(
                    child: TextField(
                      decoration: const InputDecoration(
                        prefixIcon: Icon(Icons.search_rounded),
                        hintText: 'Rechercher un numéro (+225...)',
                        isDense: true,
                      ),
                      onChanged: (v) {
                        _query = v;
                      },
                      onSubmitted: (_) => _load(resetPage: true),
                    ),
                  ),
                  const SizedBox(width: 10),
                  DropdownButton<String>(
                    value: _status,
                    items: const [
                      DropdownMenuItem(value: 'all', child: Text('Tous')),
                      DropdownMenuItem(value: 'queued', child: Text('En attente')),
                      DropdownMenuItem(value: 'sending', child: Text('En cours')),
                      DropdownMenuItem(value: 'sent', child: Text('Envoyé')),
                      DropdownMenuItem(value: 'failed', child: Text('Échec')),
                      DropdownMenuItem(value: 'skipped_optout', child: Text('Opt-out')),
                    ],
                    onChanged: (v) {
                      if (v == null) return;
                      setState(() => _status = v);
                      _load(resetPage: true);
                    },
                  ),
                ],
              ),
              const SizedBox(height: 10),
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton.icon(
                      onPressed: _loading ? null : () => _load(resetPage: true),
                      icon: _loading
                          ? const SizedBox(
                              width: 16,
                              height: 16,
                              child: CircularProgressIndicator(strokeWidth: 2),
                            )
                          : const Icon(Icons.refresh_rounded),
                      label: Text(_loading ? 'Chargement…' : 'Actualiser'),
                    ),
                  ),
                ],
              ),

              const SizedBox(height: 16),

              // Liste
              if (list.isEmpty)
                Padding(
                  padding: const EdgeInsets.all(12.0),
                  child: Text(
                    'Aucun historique disponible pour le moment.',
                    style: TextStyle(color: Colors.grey.shade700),
                  ),
                )
              else
                ...list.map((m) {
                  Color badgeBg;
                  Color badgeText;
                  String label;
                  switch (m.status) {
                    case 'sent':
                      badgeBg = Colors.green.shade50;
                      badgeText = Colors.green.shade700;
                      label = 'Envoyé';
                      break;
                    case 'failed':
                      badgeBg = Colors.red.shade50;
                      badgeText = Colors.red.shade700;
                      label = 'Échec';
                      break;
                    case 'sending':
                      badgeBg = Colors.orange.shade50;
                      badgeText = Colors.orange.shade700;
                      label = 'En cours';
                      break;
                    default:
                      badgeBg = Colors.blue.shade50;
                      badgeText = Colors.blue.shade700;
                      label = 'En attente';
                  }

                  final preview = m.body.length > 70 ? '${m.body.substring(0, 70)}…' : m.body;
                  return Container(
                    margin: const EdgeInsets.only(top: 10),
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(
                      color: Colors.grey.shade50,
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(color: Colors.grey.shade200),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Text(m.toPhoneE164, style: const TextStyle(fontWeight: FontWeight.w700)),
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                              decoration: BoxDecoration(
                                color: badgeBg,
                                borderRadius: BorderRadius.circular(18),
                              ),
                              child: Text(
                                label,
                                style: TextStyle(color: badgeText, fontWeight: FontWeight.w700, fontSize: 12),
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 8),
                        Text(preview, style: TextStyle(color: Colors.grey.shade700)),
                        if (m.lastError != null && m.lastError!.isNotEmpty) ...[
                          const SizedBox(height: 6),
                          Text('Erreur: ${m.lastError}', style: TextStyle(color: Colors.red.shade700, fontSize: 12)),
                        ],
                        const SizedBox(height: 8),
                        Text(
                          _formatDateTimeFr(m.sentAt ?? m.createdAt),
                          style: TextStyle(color: Colors.grey.shade600, fontSize: 12),
                        ),
                      ],
                    ),
                  );
                }),

              const SizedBox(height: 16),

              // Pagination (simple)
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  OutlinedButton.icon(
                    onPressed: (_loading || _page == 0)
                        ? null
                        : () {
                            setState(() => _page -= 1);
                            _load();
                          },
                    icon: const Icon(Icons.chevron_left_rounded),
                    label: const Text('Précédent'),
                  ),
                  Text('Page ${_page + 1}', style: TextStyle(color: Colors.grey.shade700)),
                  OutlinedButton.icon(
                    onPressed: (_loading || list.length < _pageSize)
                        ? null
                        : () {
                            setState(() => _page += 1);
                            _load();
                          },
                    icon: const Icon(Icons.chevron_right_rounded),
                    label: const Text('Suivant'),
                  ),
                ],
              ),
            ],
          ),
        ),
      ],
    );
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
                        '1 250 / 10 000',
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
                      value: 0.125,
                      minHeight: 8,
                      backgroundColor: Colors.grey.shade200,
                      valueColor: const AlwaysStoppedAnimation<Color>(
                        Color(0xFF16A34A),
                      ),
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    '12,5% utilisé',
                    style: TextStyle(
                      fontSize: 12,
                      color: Colors.grey.shade600,
                    ),
                  ),
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
      return Padding(
        padding: const EdgeInsets.fromLTRB(20, 12, 20, 24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Paramètres',
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 12),
            const Text(
              'Les réglages avancés arrivent bientôt (notifications, auto-sync, thèmes, etc.).',
              style: TextStyle(color: Colors.black54),
            ),
            const SizedBox(height: 16),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton(
                    onPressed: () => Navigator.of(ctx).pop(),
                    child: const Text('Fermer'),
                  ),
                ),
              ],
            ),
          ],
        ),
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

