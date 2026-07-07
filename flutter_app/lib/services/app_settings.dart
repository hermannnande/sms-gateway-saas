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

  /// Minimum allowed delay between two SMS (in ms). Below this value,
  /// some carriers drop or rate-limit messages.
  static const int minDelayMs = 0;

  /// Maximum allowed delay between two SMS (in ms). Aligned with the web
  /// dashboard limit of 120 seconds.
  static const int maxDelayMs = 120000;

  /// Default delay if the user has never customized it.
  static int get defaultDelayMs => AppConfig.smsDelayMs;

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

  /// Read the OPTIONAL upper bound of the random delay, in ms.
  /// Returns 0 when random mode is disabled (no value, or <= the min delay).
  static Future<int> getSmsDelayMaxMs() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.reload();
    final raw = prefs.getInt(_kSmsDelayMaxMs);
    if (raw == null) return 0;
    return raw.clamp(minDelayMs, maxDelayMs);
  }

  /// Persist the upper bound of the random delay. Pass 0 (or a value <= the
  /// min delay) to disable random mode and go back to a fixed delay.
  static Future<void> setSmsDelayMaxMs(int ms) async {
    final prefs = await SharedPreferences.getInstance();
    final clamped = ms.clamp(minDelayMs, maxDelayMs);
    await prefs.setInt(_kSmsDelayMaxMs, clamped);
  }

  /// Pick the delay to apply BEFORE the next SMS.
  /// - If a max > min is configured => uniform random in [min, max] (anti-spam).
  /// - Otherwise => the fixed min delay (100% backward compatible).
  /// Reads once; callers may cache [minMs]/[maxMs] per batch to avoid re-reading.
  static int pickDelayMs(int minMs, int maxMs) {
    if (maxMs > minMs) {
      return minMs + _rng.nextInt(maxMs - minMs + 1);
    }
    return minMs;
  }

  // ─── Pause anti-spam PAR LOT (ex: pause de 20-60s toutes les 10 SMS) ─────
  // Complète le délai par SMS ci-dessus : au-delà d'un certain nombre de SMS
  // envoyés d'affilée, on marque une pause plus longue et ALÉATOIRE pour
  // casser tout motif régulier détectable par l'opérateur (MTN/Orange).

  static const int minBatchPauseCount = 1;
  static const int maxBatchPauseCount = 500;
  static const int defaultBatchPauseCount = 10;

  static const int minBatchPauseMs = 0;
  static const int maxBatchPauseMs = 1800000; // 30 min
  static const int defaultBatchPauseMinMs = 20000;
  static const int defaultBatchPauseMaxMs = 60000;

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

      // Borne haute (aléatoire) — facultative.
      final maxSeconds = toSeconds(row['message_delay_max_seconds']);
      if (maxSeconds != null && maxSeconds >= 0) {
        await setSmsDelayMaxMs((maxSeconds * 1000).clamp(minDelayMs, maxDelayMs));
      } else {
        await setSmsDelayMaxMs(0);
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
