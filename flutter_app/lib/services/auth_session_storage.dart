import 'dart:async';
import 'dart:convert';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:supabase/supabase.dart';

/// Stockage persistant de la session Supabase (via refresh token).
///
/// Objectif: garder l'utilisateur connecté même après fermeture de l'app.
class AuthSessionStorage {
  static const _refreshTokenKey = 'supabase_refresh_token';
  static const _sessionKey = 'supabase_persisted_session';
  Future<void> _writes = Future.value();

  Future<void> _write(Future<void> Function() action) {
    final next = _writes.then((_) => action());
    _writes = next.catchError((Object _) {});
    return next;
  }

  /// Persist the complete session so opening offline does not require a login.
  /// Serialize writes: a late persistence operation must not undo logout.
  Future<void> saveSession(Session session) => _write(() async {
        final prefs = await SharedPreferences.getInstance();
        await prefs.setString(_sessionKey, jsonEncode(session.toJson()));
        final token = session.refreshToken;
        if (token != null) await prefs.setString(_refreshTokenKey, token);
      });

  static bool isInvalidSession(Object error) =>
      error is AuthException &&
      const {
        'refresh_token_not_found',
        'refresh_token_already_used',
        'session_not_found',
        'session_expired',
        'user_banned',
        'user_not_found'
      }.contains(error.code);

  /// false means no restored session yet; transient failures keep all tokens.
  Future<bool> restore(SupabaseClient client) async {
    if (client.auth.currentSession != null) return true;
    await _writes;
    final prefs = await SharedPreferences.getInstance();
    final saved = prefs.getString(_sessionKey);
    if (saved != null) {
      try {
        await client.auth.setInitialSession(saved);
        client.auth.startAutoRefresh();
        return true;
      } on FormatException {
        await prefs.remove(_sessionKey);
      }
    }
    final token = await loadRefreshToken();
    if (token == null) return false;
    try {
      final result = await client.auth
          .refreshSession(token)
          .timeout(const Duration(seconds: 15));
      if (result.session == null) return false;
      await saveSession(result.session!);
      return true;
    } catch (error) {
      if (isInvalidSession(error)) await clear();
      return false;
    }
  }

  Future<String?> loadRefreshToken() async {
    final prefs = await SharedPreferences.getInstance();
    final v = prefs.getString(_refreshTokenKey);
    if (v == null) return null;
    final trimmed = v.trim();
    return trimmed.isEmpty ? null : trimmed;
  }

  Future<void> saveRefreshToken(String refreshToken) => _write(() async {
        final prefs = await SharedPreferences.getInstance();
        await prefs.setString(_refreshTokenKey, refreshToken.trim());
      });

  Future<void> clear() => _write(() async {
        final prefs = await SharedPreferences.getInstance();
        await prefs.remove(_refreshTokenKey);
        await prefs.remove(_sessionKey);
      });
}
