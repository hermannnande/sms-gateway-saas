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

  /// Pull the SMS delay from the web dashboard (`user_settings.message_delay_seconds`)
  /// and mirror it locally. Safe to call repeatedly; silently ignores any
  /// network/RLS error so it never blocks login.
  static Future<int?> syncFromSupabase(SupabaseClient client) async {
    try {
      final user = client.auth.currentUser;
      if (user == null) return null;
      final row = await client
          .from('user_settings')
          .select('message_delay_seconds')
          .eq('user_id', user.id)
          .maybeSingle();
      if (row == null) return null;
      final raw = row['message_delay_seconds'];
      if (raw == null) return null;
      int seconds;
      if (raw is int) {
        seconds = raw;
      } else if (raw is num) {
        seconds = raw.toInt();
      } else {
        seconds = int.tryParse(raw.toString()) ?? -1;
      }
      if (seconds < 0) return null;
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
      await client.from('user_settings').upsert(
        {
          'user_id': user.id,
          'message_delay_seconds': seconds,
          'updated_at': DateTime.now().toUtc().toIso8601String(),
        },
        onConflict: 'user_id',
      );
    } catch (_) {}
  }
}
