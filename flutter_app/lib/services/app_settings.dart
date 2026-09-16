import 'dart:math';

import 'package:shared_preferences/shared_preferences.dart';
import 'package:supabase/supabase.dart';

import 'package:smsgateway_flutter/config.dart';

/// Instantané cohérent des réglages de cadence utilisés pendant un envoi.
///
/// Il est volontairement immutable : le moteur peut comparer deux lectures et
/// recalculer l'attente en cours seulement lorsque l'utilisateur a vraiment
/// enregistré une nouvelle valeur sur le tableau de bord.
class SmsPacingSettings {
  const SmsPacingSettings({
    required this.minDelayMs,
    required this.maxDelayMs,
    required this.batchPauseEnabled,
    required this.batchPauseCount,
    required this.batchPauseMinMs,
    required this.batchPauseMaxMs,
    this.turboEnabled = false,
  });

  final int minDelayMs;
  final int maxDelayMs;
  final bool batchPauseEnabled;
  final int batchPauseCount;
  final int batchPauseMinMs;
  final int batchPauseMaxMs;

  /// Mode turbo demandé depuis le tableau de bord : cadence plate d'un SMS par
  /// seconde, sans aléatoire, sans pause par lot et sans backoff d'échec.
  final bool turboEnabled;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is SmsPacingSettings &&
          minDelayMs == other.minDelayMs &&
          maxDelayMs == other.maxDelayMs &&
          batchPauseEnabled == other.batchPauseEnabled &&
          batchPauseCount == other.batchPauseCount &&
          batchPauseMinMs == other.batchPauseMinMs &&
          batchPauseMaxMs == other.batchPauseMaxMs &&
          // Indispensable : `waitWithLiveRefresh` ne recalcule l'attente que si
          // l'instantané a changé. Sans ce champ, activer le turbo au milieu
          // d'une campagne serait totalement invisible.
          turboEnabled == other.turboEnabled;

  @override
  int get hashCode => Object.hash(
        minDelayMs,
        maxDelayMs,
        batchPauseEnabled,
        batchPauseCount,
        batchPauseMinMs,
        batchPauseMaxMs,
        turboEnabled,
      );
}

class LivePacingWaitResult {
  const LivePacingWaitResult({
    required this.settings,
    required this.usedBatchPause,
    required this.interrupted,
  });

  final SmsPacingSettings settings;
  final bool usedBatchPause;
  final bool interrupted;
}

/// Centralized read/write of user-configurable runtime settings.
///
/// The web dashboard at /dashboard/profile is the SOURCE OF TRUTH for the
/// per-user SMS delay (stored in `public.user_settings.message_delay_seconds`).
/// We mirror that value into SharedPreferences so the background isolate can
/// read it cheaply on every batch.
///
/// IMPORTANT: every reader (foreground UI and background isolate) MUST
/// call `prefs.reload()` before reading, because the background isolate
/// keeps its own SharedPreferences cache and would otherwise serve a stale
/// value after the user changes a setting from the UI.
class AppSettings {
  static const _kSmsDelayMs = 'cfg_sms_delay_ms';
  static const _kSmsDelayMaxMs = 'cfg_sms_delay_max_ms';
  static const _kBatchPauseEnabled = 'cfg_batch_pause_enabled';
  static const _kBatchPauseCount = 'cfg_batch_pause_count';
  static const _kBatchPauseMinMs = 'cfg_batch_pause_min_ms';
  static const _kBatchPauseMaxMs = 'cfg_batch_pause_max_ms';
  static const _kTurboEnabled = 'cfg_turbo_mode_enabled';
  static final _rng = Random();

  /// Fréquence de consultation du tableau de bord pendant une attente active.
  /// Une valeur enregistrée est donc normalement appliquée en moins de 2 s.
  static const Duration liveRefreshInterval = Duration(seconds: 2);
  static const Duration liveWaitTick = Duration(milliseconds: 500);

  /// Temps écoulé depuis la DERNIÈRE consultation réelle du tableau de bord.
  /// Il est `static` pour survivre d'une attente à la suivante : en turbo une
  /// attente ne dure que 1 s, donc aucune d'elles ne peut à elle seule atteindre
  /// l'intervalle de 2 s. En cumulant le temps d'un SMS au suivant, on conserve
  /// exactement une consultation toutes les 2 s environ — sans augmenter la
  /// fréquence d'interrogation — et couper le turbo est vu en ~2 s.
  static final Stopwatch _sinceLastRefresh = Stopwatch()..start();

  /// Minimum responsible pacing between two SMS sends.
  static const int minDelayMs = 5000;

  /// Maximum allowed delay between two SMS (in ms). Aligned with the web
  /// dashboard limit of 120 seconds.
  static const int maxDelayMs = 120000;

  /// Default delay if the user has never customized it.
  static int get defaultDelayMs => AppConfig.smsDelayMs;

  /// Marge bornée ajoutée au délai minimum pour lisser la charge du gateway.
  /// Elle ne remplace pas le consentement, l'identification ni la gestion STOP.
  static const int defaultRandomSpreadMs = 2000;

  /// Attente plate appliquée quand le mode turbo est activé depuis le tableau
  /// de bord : un SMS par seconde, sans aléatoire ni pause de régulation.
  static const int turboDelayMs = 1000;

  /// Clé du réglage « variation automatique du texte ».
  static const _kAutoVaryEnabled = 'cfg_auto_vary_enabled';

  /// Read the user-configured delay between two SMS sends, in ms.
  static Future<int> getSmsDelayMs() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.reload();
    final raw = prefs.getInt(_kSmsDelayMs);
    if (raw == null) return defaultDelayMs;
    return raw.clamp(minDelayMs, maxDelayMs);
  }

  /// Persist the delay between two SMS sends (clamped to safe bounds).
  static Future<void> setSmsDelayMs(int ms) async {
    final prefs = await SharedPreferences.getInstance();
    final clamped = ms.clamp(minDelayMs, maxDelayMs);
    await prefs.setInt(_kSmsDelayMs, clamped);
  }

  /// Read the upper bound of the random delay, in ms.
  ///
  /// Une borne haute absente, nulle ou <= au minimum applique automatiquement
  /// une marge [min, min + spread]. Une borne explicitement supérieure élargit
  /// cette plage dans la limite de 120 secondes.
  static Future<int> getSmsDelayMaxMs() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.reload();
    final min = (prefs.getInt(_kSmsDelayMs) ?? defaultDelayMs)
        .clamp(minDelayMs, maxDelayMs);
    final raw = prefs.getInt(_kSmsDelayMaxMs);
    if (raw == null || raw <= min) {
      return (min + defaultRandomSpreadMs).clamp(minDelayMs, maxDelayMs);
    }
    return raw.clamp(minDelayMs, maxDelayMs);
  }

  /// Persist the upper bound of the random delay. Une valeur 0 (ou <= au délai
  /// minimum) ne désactive PLUS l'aléatoire : le lecteur `getSmsDelayMaxMs`
  /// applique dans ce cas une bande automatique [min, min + spread].
  static Future<void> setSmsDelayMaxMs(int ms) async {
    final prefs = await SharedPreferences.getInstance();
    final clamped = ms.clamp(minDelayMs, maxDelayMs);
    await prefs.setInt(_kSmsDelayMaxMs, clamped);
  }

  /// Pick the delay to apply BEFORE the next SMS.
  /// - If a max > min is configured => bounded jitter in [min, max].
  /// - Otherwise => the fixed min delay (100% backward compatible).
  /// Reads once; callers may cache [minMs]/[maxMs] per batch to avoid re-reading.
  static int pickDelayMs(int minMs, int maxMs) {
    if (maxMs > minMs) {
      return minMs + _rng.nextInt(maxMs - minMs + 1);
    }
    return minMs;
  }

  /// Extra network backoff after consecutive send failures. Successful sends
  /// reset the counter in the caller.
  static int failureBackoffMs(int consecutiveFailures) {
    if (consecutiveFailures <= 0) return 0;
    return min(40000, consecutiveFailures * 10000);
  }

  // ─── Pause de régulation PAR LOT ─────────────────────────────────────────
  // Complète le délai par SMS par une pause plus longue après plusieurs envois.

  static const int minBatchPauseCount = 1;
  static const int maxBatchPauseCount = 500;
  static const int defaultBatchPauseCount = 10;

  static const int minBatchPauseMs = 30000;
  static const int maxBatchPauseMs = 1800000; // 30 min
  static const int defaultBatchPauseMinMs = 30000;
  static const int defaultBatchPauseMaxMs = 45000;

  static Future<bool> getBatchPauseEnabled() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.reload();
    return prefs.getBool(_kBatchPauseEnabled) ?? true;
  }

  static Future<void> setBatchPauseEnabled(bool enabled) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(_kBatchPauseEnabled, enabled);
  }

  /// Lit le mode turbo (désactivé par défaut).
  static Future<bool> getTurboEnabled() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.reload();
    return prefs.getBool(_kTurboEnabled) ?? false;
  }

  /// Enregistre le mode turbo. Les réglages de cadence de l'utilisateur ne sont
  /// jamais modifiés : les désactiver les restitue à l'identique.
  static Future<void> setTurboEnabled(bool enabled) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(_kTurboEnabled, enabled);
  }

  static Future<int> getBatchPauseCount() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.reload();
    final raw = prefs.getInt(_kBatchPauseCount);
    if (raw == null) return defaultBatchPauseCount;
    return raw.clamp(minBatchPauseCount, maxBatchPauseCount);
  }

  static Future<void> setBatchPauseCount(int count) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setInt(
        _kBatchPauseCount, count.clamp(minBatchPauseCount, maxBatchPauseCount));
  }

  static Future<int> getBatchPauseMinMs() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.reload();
    final raw = prefs.getInt(_kBatchPauseMinMs);
    if (raw == null) return defaultBatchPauseMinMs;
    return raw.clamp(minBatchPauseMs, maxBatchPauseMs);
  }

  static Future<void> setBatchPauseMinMs(int ms) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setInt(
        _kBatchPauseMinMs, ms.clamp(minBatchPauseMs, maxBatchPauseMs));
  }

  static Future<int> getBatchPauseMaxMs() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.reload();
    final raw = prefs.getInt(_kBatchPauseMaxMs);
    if (raw == null) return defaultBatchPauseMaxMs;
    return raw.clamp(minBatchPauseMs, maxBatchPauseMs);
  }

  static Future<void> setBatchPauseMaxMs(int ms) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setInt(
        _kBatchPauseMaxMs, ms.clamp(minBatchPauseMs, maxBatchPauseMs));
  }

  /// Pick the pause duration (ms) to apply after a batch of N SMS.
  /// Uniform random in [min, max]; if max <= min, returns a fixed min pause.
  static int pickBatchPauseMs(int minMs, int maxMs) {
    if (maxMs > minMs) {
      return minMs + _rng.nextInt(maxMs - minMs + 1);
    }
    return minMs;
  }

  /// Prochain seuil de pause par lot, tiré au hasard autour de [count] (±30 %).
  /// Une pause EXACTEMENT toutes les N SMS est elle-même une périodicité
  /// détectable par l'opérateur ; on varie donc aussi le seuil (ex. N=10
  /// => pause après 7 à 13 SMS, re-tiré après chaque pause).
  static int pickBatchThreshold(int count) {
    if (count <= 1) return 1;
    final jitter = (count * 0.3).floor();
    if (jitter <= 0) return count;
    return max(1, count - jitter + _rng.nextInt(2 * jitter + 1));
  }

  // Variation automatique historique du texte. Elle reste désactivée afin que
  // le contenu envoyé soit explicite et auditable.

  static Future<bool> getAutoVaryEnabled() async {
    // Automatic message mutation is intentionally disabled. Legitimate
    // variants must be supplied explicitly by the sender and remain auditable.
    return false;
  }

  /// Lit toutes les valeurs locales avec un seul rechargement de
  /// SharedPreferences. Cela évite de mélanger deux versions du réglage si le
  /// site est enregistré au milieu d'une lecture.
  static Future<SmsPacingSettings> getSmsPacingSettings() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.reload();

    final minDelay = (prefs.getInt(_kSmsDelayMs) ?? defaultDelayMs)
        .clamp(minDelayMs, maxDelayMs);
    final rawMaxDelay = prefs.getInt(_kSmsDelayMaxMs);
    final maxDelay = rawMaxDelay == null || rawMaxDelay <= minDelay
        ? (minDelay + defaultRandomSpreadMs).clamp(minDelayMs, maxDelayMs)
        : rawMaxDelay.clamp(minDelayMs, maxDelayMs);
    final batchCount =
        (prefs.getInt(_kBatchPauseCount) ?? defaultBatchPauseCount)
            .clamp(minBatchPauseCount, maxBatchPauseCount);
    final batchMin = (prefs.getInt(_kBatchPauseMinMs) ?? defaultBatchPauseMinMs)
        .clamp(minBatchPauseMs, maxBatchPauseMs);
    final batchMax = (prefs.getInt(_kBatchPauseMaxMs) ?? defaultBatchPauseMaxMs)
        .clamp(minBatchPauseMs, maxBatchPauseMs);

    // ── Mode turbo ────────────────────────────────────────────────────────
    // Choix explicite de l'utilisateur sur le tableau de bord : on renvoie une
    // cadence plate de [turboDelayMs] sans passer par .clamp(minDelayMs, ...)
    // — le plancher local de 5 s est volontairement contourné ici — ni par la
    // bande aléatoire automatique, qui transformerait sinon ce 1 000 ms en une
    // plage 1 000-3 000 ms. La pause par lot est neutralisée.
    // Les valeurs de cadence ci-dessus restent CONSERVÉES telles quelles dans
    // les préférences : couper le turbo restitue les réglages de l'utilisateur
    // sans migration ni perte de données.
    if (prefs.getBool(_kTurboEnabled) ?? false) {
      return SmsPacingSettings(
        minDelayMs: turboDelayMs,
        maxDelayMs: turboDelayMs,
        batchPauseEnabled: false,
        batchPauseCount: batchCount,
        batchPauseMinMs: batchMin,
        batchPauseMaxMs: max(batchMin, batchMax),
        turboEnabled: true,
      );
    }

    return SmsPacingSettings(
      minDelayMs: minDelay,
      maxDelayMs: maxDelay,
      batchPauseEnabled: prefs.getBool(_kBatchPauseEnabled) ?? true,
      batchPauseCount: batchCount,
      batchPauseMinMs: batchMin,
      batchPauseMaxMs: max(batchMin, batchMax),
    );
  }

  /// Applique un objet provenant soit de Supabase, soit du proxy mobile.
  /// Les bornes locales restent la dernière protection contre une valeur
  /// invalide ou une ancienne version du tableau de bord.
  static Future<void> applyRemoteSettings(Map<String, dynamic> row) async {
    int? toInt(dynamic raw) {
      if (raw == null) return null;
      if (raw is int) return raw;
      if (raw is num) return raw.toInt();
      return int.tryParse(raw.toString());
    }

    final prefs = await SharedPreferences.getInstance();
    final minSeconds = toInt(row['message_delay_seconds']);
    final maxSeconds = toInt(row['message_delay_max_seconds']);
    final batchCount = toInt(row['batch_pause_count']);
    final batchMinSeconds = toInt(row['batch_pause_min_seconds']);
    final batchMaxSeconds = toInt(row['batch_pause_max_seconds']);

    if (minSeconds != null && minSeconds >= 0) {
      await prefs.setInt(
        _kSmsDelayMs,
        (minSeconds * 1000).clamp(minDelayMs, maxDelayMs),
      );
    }
    if (maxSeconds != null && maxSeconds >= 0) {
      await prefs.setInt(
        _kSmsDelayMaxMs,
        (maxSeconds * 1000).clamp(minDelayMs, maxDelayMs),
      );
    }
    final batchEnabled = row['batch_pause_enabled'];
    if (batchEnabled is bool) {
      await prefs.setBool(_kBatchPauseEnabled, batchEnabled);
    }
    // Unique entonnoir pour les deux canaux de réglages (lecture Supabase
    // directe et proxy mobile) : l'isolate d'arrière-plan en hérite donc aussi.
    final turboEnabled = row['turbo_mode_enabled'];
    if (turboEnabled is bool) {
      await prefs.setBool(_kTurboEnabled, turboEnabled);
    }
    if (batchCount != null && batchCount >= minBatchPauseCount) {
      await prefs.setInt(
        _kBatchPauseCount,
        batchCount.clamp(minBatchPauseCount, maxBatchPauseCount),
      );
    }
    if (batchMinSeconds != null && batchMinSeconds >= 0) {
      await prefs.setInt(
        _kBatchPauseMinMs,
        (batchMinSeconds * 1000).clamp(minBatchPauseMs, maxBatchPauseMs),
      );
    }
    if (batchMaxSeconds != null && batchMaxSeconds >= 0) {
      await prefs.setInt(
        _kBatchPauseMaxMs,
        (batchMaxSeconds * 1000).clamp(minBatchPauseMs, maxBatchPauseMs),
      );
    }
  }

  /// Attend avant le prochain SMS tout en relisant les paramètres. Si le
  /// profil est enregistré pendant le compte à rebours, la durée cible est
  /// recalculée immédiatement. Désactiver la pause par lot fait notamment
  /// reprendre le délai SMS normal sans attendre la fin de l'ancienne pause.
  static Future<LivePacingWaitResult> waitWithLiveRefresh({
    required SmsPacingSettings initialSettings,
    required bool useBatchPause,
    required int consecutiveFailures,
    required Future<SmsPacingSettings> Function() refreshSettings,
    Future<bool> Function()? shouldInterrupt,
    Future<void> Function(int remainingMs, bool isBatchPause)? onTick,
    Duration refreshInterval = liveRefreshInterval,
    Duration tick = liveWaitTick,

    /// Temps (ms) que l'appelant a DÉJÀ consacré à ce message : l'accusé
    /// d'envoi natif puis le compte rendu de statut. Il est soustrait du budget
    /// turbo, si bien que la cadence se mesure d'un départ à l'autre
    /// (« send-to-send ») et non de la fin du travail au départ suivant : la
    /// période visée devient max(1 s, temps de travail réel) au lieu de
    /// « temps de travail + 1 s ».
    ///
    /// HORS TURBO ce paramètre est totalement IGNORÉ : la temporisation
    /// aléatoire complète continue de s'appliquer APRÈS le travail, exactement
    /// comme aujourd'hui, car le dispositif anti-spam en dépend.
    int alreadyElapsedMs = 0,
  }) async {
    var settings = initialSettings;
    // Le turbo n'entre JAMAIS en pause par lot, même si l'appelant en demande
    // une : c'est un choix explicite du tableau de bord.
    var batchMode =
        useBatchPause && settings.batchPauseEnabled && !settings.turboEnabled;
    int pickTargetMs() {
      // Turbo : attente plate, sans jitter. Le backoff d'échec est neutralisé
      // ICI, au point d'appel, et non dans `failureBackoffMs` dont les valeurs
      // de retour sont figées par les tests.
      // Cadence à échéance : [turboDelayMs] est une PÉRIODE, pas un supplément.
      // On ne dort donc que le reliquat du budget d'une seconde ; quand l'envoi
      // et le compte rendu l'ont déjà épuisé, la cible vaut 0 et le SMS suivant
      // part immédiatement.
      if (settings.turboEnabled) {
        return max(0, turboDelayMs - alreadyElapsedMs);
      }
      return batchMode
          ? pickBatchPauseMs(settings.batchPauseMinMs, settings.batchPauseMaxMs)
          : pickDelayMs(settings.minDelayMs, settings.maxDelayMs) +
              failureBackoffMs(consecutiveFailures);
    }

    var targetMs = pickTargetMs();
    final stopwatch = Stopwatch()..start();
    var nextRefreshAtMs = refreshInterval.inMilliseconds;

    /// Consulte le tableau de bord si l'échéance de rafraîchissement est
    /// atteinte, réconcilie l'attente en cours et indique par `true` que
    /// l'appelant doit sortir immédiatement (la nouvelle cible est déjà
    /// dépassée). La logique est celle qui vivait dans la boucle : elle a
    /// seulement été extraite pour pouvoir être appelée AUSSI avant d'y entrer.
    Future<bool> maybeRefresh(int elapsedMs) async {
      // En turbo la cible ne vaut au plus que [turboDelayMs], et souvent 0 :
      // l'attente se terminerait toujours avant `refreshInterval` et le tableau
      // de bord ne serait donc plus JAMAIS consulté (couper le turbo ne serait
      // vu qu'au lot suivant). On s'appuie alors sur le chronomètre partagé
      // entre attentes.
      final dueForRefresh = settings.turboEnabled
          ? _sinceLastRefresh.elapsedMilliseconds >=
              refreshInterval.inMilliseconds
          : elapsedMs >= nextRefreshAtMs;
      if (!dueForRefresh) return false;

      final refreshed = await refreshSettings();
      _sinceLastRefresh
        ..reset()
        ..start();
      nextRefreshAtMs =
          stopwatch.elapsedMilliseconds + refreshInterval.inMilliseconds;
      if (refreshed != settings) {
        final previous = settings;
        final wasBatchMode = batchMode;
        settings = refreshed;
        if (batchMode &&
            (!settings.batchPauseEnabled || settings.turboEnabled)) {
          batchMode = false;
        }
        final relevantDurationChanged = batchMode
            ? previous.batchPauseMinMs != settings.batchPauseMinMs ||
                previous.batchPauseMaxMs != settings.batchPauseMaxMs
            : previous.minDelayMs != settings.minDelayMs ||
                previous.maxDelayMs != settings.maxDelayMs;
        // Un simple basculement du turbo doit recalculer la cible même si les
        // durées affichées n'ont pas bougé, sinon l'attente en cours irait
        // jusqu'à son terme.
        if (wasBatchMode != batchMode ||
            relevantDurationChanged ||
            previous.turboEnabled != settings.turboEnabled) {
          targetMs = pickTargetMs();
        }
        if (stopwatch.elapsedMilliseconds >= targetMs) return true;
      }
      return false;
    }

    // Une consultation AVANT la boucle. En turbo la cible vaut fréquemment 0
    // (l'envoi et le compte rendu ont déjà consommé toute la seconde) : le
    // corps de la boucle, qui héberge le rafraîchissement, ne s'exécuterait
    // alors jamais et l'angle mort que `_sinceLastRefresh` avait fermé se
    // rouvrirait — couper le turbo ne serait plus vu qu'au lot suivant, jusqu'à
    // 30 SMS plus tard.
    // HORS TURBO cet appel ne peut pas déclencher de consultation anticipée :
    // l'échéance vaut `elapsedMs >= nextRefreshAtMs`, or le chronomètre vient
    // de démarrer (0 ms) et `nextRefreshAtMs` vaut l'intervalle complet. Les
    // attentes ordinaires se rafraîchissent donc aux mêmes instants qu'avant.
    final stopBeforeLoop = await maybeRefresh(stopwatch.elapsedMilliseconds);

    while (!stopBeforeLoop && stopwatch.elapsedMilliseconds < targetMs) {
      if (shouldInterrupt != null && await shouldInterrupt()) {
        stopwatch.stop();
        return LivePacingWaitResult(
          settings: settings,
          usedBatchPause: batchMode,
          interrupted: true,
        );
      }

      if (await maybeRefresh(stopwatch.elapsedMilliseconds)) break;

      final remainingMs = targetMs - stopwatch.elapsedMilliseconds;
      if (remainingMs <= 0) break;
      if (onTick != null) {
        await onTick(remainingMs, batchMode);
      }
      final waitMs = min(tick.inMilliseconds, remainingMs);
      await Future.delayed(Duration(milliseconds: waitMs));
    }

    stopwatch.stop();
    return LivePacingWaitResult(
      settings: settings,
      usedBatchPause: batchMode,
      interrupted: false,
    );
  }

  static Future<void> setAutoVaryEnabled(bool enabled) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(_kAutoVaryEnabled, enabled);
  }

  /// Pull the SMS delay from the web dashboard (`user_settings.message_delay_seconds`)
  /// and mirror it locally. Safe to call repeatedly; silently ignores any
  /// network/RLS error so it never blocks login.
  static Future<int?> syncFromSupabase(SupabaseClient client) async {
    try {
      final user = client.auth.currentUser;
      if (user == null) return null;
      final row = await client
          .from('user_settings')
          .select('message_delay_seconds, message_delay_max_seconds, '
              'batch_pause_enabled, batch_pause_count, '
              'batch_pause_min_seconds, batch_pause_max_seconds, '
              'turbo_mode_enabled')
          .eq('user_id', user.id)
          .maybeSingle();
      if (row == null) return null;
      await applyRemoteSettings(Map<String, dynamic>.from(row));
      return (await getSmsPacingSettings()).minDelayMs;
    } catch (_) {
      return null;
    }
  }

  /// Synchronise puis renvoie un instantané directement consommable par la
  /// boucle d'envoi. En cas de réseau indisponible, les dernières valeurs
  /// locales enregistrées restent actives.
  static Future<SmsPacingSettings> refreshFromSupabase(
      SupabaseClient client) async {
    await syncFromSupabase(client);
    return getSmsPacingSettings();
  }

  /// Push the SMS delay to the web dashboard so it stays in sync.
  /// Non-blocking: ignores any error (network / RLS).
  static Future<void> pushToSupabase(SupabaseClient client, int ms) async {
    try {
      final user = client.auth.currentUser;
      if (user == null) return;
      // Turbo actif : le délai local est borné à 5 s, le renvoyer écraserait le
      // choix fait sur le tableau de bord.
      if (await getTurboEnabled()) return;
      final seconds = (ms / 1000).round().clamp(0, 120);
      final maxMs = await getSmsDelayMaxMs();
      final maxSeconds = (maxMs / 1000).round().clamp(0, 120);
      await client.from('user_settings').upsert(
        {
          'user_id': user.id,
          'message_delay_seconds': seconds,
          // 0 => délai fixe (pas d'aléatoire)
          'message_delay_max_seconds': maxSeconds,
          'updated_at': DateTime.now().toUtc().toIso8601String(),
        },
        onConflict: 'user_id',
      );
    } catch (_) {}
  }

  /// Push the batch-pause anti-spam settings to the web dashboard.
  /// Non-blocking: ignores any error (network / RLS).
  static Future<void> pushBatchPauseToSupabase(SupabaseClient client) async {
    try {
      final user = client.auth.currentUser;
      if (user == null) return;
      // Turbo actif : la pause par lot est neutralisée, la réécrire remettrait
      // `batch_pause_enabled` à true et annulerait le turbo.
      if (await getTurboEnabled()) return;
      final enabled = await getBatchPauseEnabled();
      final count = await getBatchPauseCount();
      final minMs = await getBatchPauseMinMs();
      final maxMs = await getBatchPauseMaxMs();
      await client.from('user_settings').upsert(
        {
          'user_id': user.id,
          'batch_pause_enabled': enabled,
          'batch_pause_count': count,
          'batch_pause_min_seconds': (minMs / 1000).round().clamp(0, 1800),
          'batch_pause_max_seconds': (maxMs / 1000).round().clamp(0, 1800),
          'updated_at': DateTime.now().toUtc().toIso8601String(),
        },
        onConflict: 'user_id',
      );
    } catch (_) {}
  }

  /// Publie l'état du mode turbo vers le tableau de bord.
  /// Non bloquant : ignore toute erreur (réseau / RLS).
  static Future<void> pushTurboToSupabase(
      SupabaseClient client, bool enabled) async {
    try {
      final user = client.auth.currentUser;
      if (user == null) return;
      await client.from('user_settings').upsert(
        {
          'user_id': user.id,
          'turbo_mode_enabled': enabled,
          'updated_at': DateTime.now().toUtc().toIso8601String(),
        },
        onConflict: 'user_id',
      );
    } catch (_) {}
  }
}
