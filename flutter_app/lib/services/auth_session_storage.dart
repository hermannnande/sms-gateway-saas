import 'package:shared_preferences/shared_preferences.dart';

/// Stockage persistant de la session Supabase (via refresh token).
///
/// Objectif: garder l'utilisateur connecté même après fermeture de l'app.
class AuthSessionStorage {
  static const _refreshTokenKey = 'supabase_refresh_token';

  Future<String?> loadRefreshToken() async {
    final prefs = await SharedPreferences.getInstance();
    final v = prefs.getString(_refreshTokenKey);
    if (v == null) return null;
    final trimmed = v.trim();
    return trimmed.isEmpty ? null : trimmed;
  }

  Future<void> saveRefreshToken(String refreshToken) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_refreshTokenKey, refreshToken.trim());
  }

  Future<void> clear() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_refreshTokenKey);
  }
}


