import 'dart:math';

import 'package:shared_preferences/shared_preferences.dart';
import 'package:supabase/supabase.dart';

import 'package:smsgateway_flutter/config.dart';

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
  static final _rng = Random();

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
    final min =
        (prefs.getInt(_kSmsDelayMs) ?? defaultDelayMs).clamp(minDelayMs, maxDelayMs);
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
    await prefs.setInt(_kBatchPauseMinMs, ms.clamp(minBatchPauseMs, maxBatchPauseMs));
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
    await prefs.setInt(_kBatchPauseMaxMs, ms.clamp(minBatchPauseMs, maxBatchPauseMs));
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
              'batch_pause_min_seconds, batch_pause_max_seconds')
          .eq('user_id', user.id)
          .maybeSingle();
      if (row == null) return null;

      int? toSeconds(dynamic raw) {
        if (raw == null) return null;
        if (raw is int) return raw;
        if (raw is num) return raw.toInt();
        return int.tryParse(raw.toString());
      }

      // Borne haute (aléatoire). Si le tableau de bord fournit une valeur, on
      // la respecte (y compris 0 = délai fixe explicitement choisi). Si la
      // colonne est absente/NULL, on NE force PAS 0 : on laisse l'aléatoire
      // par défaut (voir getSmsDelayMaxMs).
      final maxSeconds = toSeconds(row['message_delay_max_seconds']);
      if (maxSeconds != null && maxSeconds >= 0) {
        await setSmsDelayMaxMs((maxSeconds * 1000).clamp(minDelayMs, maxDelayMs));
      }

      // Pause anti-spam par lot (toutes les N SMS).
      final batchEnabled = row['batch_pause_enabled'];
      if (batchEnabled is bool) {
        await setBatchPauseEnabled(batchEnabled);
      }
      final batchCount = toSeconds(row['batch_pause_count']);
      if (batchCount != null && batchCount >= minBatchPauseCount) {
        await setBatchPauseCount(batchCount);
      }
      final batchMinSeconds = toSeconds(row['batch_pause_min_seconds']);
      if (batchMinSeconds != null && batchMinSeconds >= 0) {
        await setBatchPauseMinMs(
            (batchMinSeconds * 1000).clamp(minBatchPauseMs, maxBatchPauseMs));
      }
      final batchMaxSeconds = toSeconds(row['batch_pause_max_seconds']);
      if (batchMaxSeconds != null && batchMaxSeconds >= 0) {
        await setBatchPauseMaxMs(
            (batchMaxSeconds * 1000).clamp(minBatchPauseMs, maxBatchPauseMs));
      }

      final seconds = toSeconds(row['message_delay_seconds']);
      if (seconds == null || seconds < 0) return null;
      final ms = (seconds * 1000).clamp(minDelayMs, maxDelayMs);
      await setSmsDelayMs(ms);
      return ms;
    } catch (_) {
      return null;
    }
  }

  /// Push the SMS delay to the web dashboard so it stays in sync.
  /// Non-blocking: ignores any error (network / RLS).
  static Future<void> pushToSupabase(SupabaseClient client, int ms) async {
    try {
      final user = client.auth.currentUser;
      if (user == null) return;
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
}
