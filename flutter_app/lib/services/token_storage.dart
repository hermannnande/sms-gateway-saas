import 'package:shared_preferences/shared_preferences.dart';

/// Stocke le token appareil par utilisateur pour éviter qu'un changement de
/// compte sur le même téléphone réutilise le device d'un autre compte.
class TokenStorage {
  /// Clé lue par le service arrière-plan (isolate sans session auth).
  static const legacyKey = 'device_token';

  /// Propriétaire du token actif écrit dans [legacyKey].
  static const ownerKey = 'device_token_owner_user_id';

  static String scopedKey(String userId) => 'device_token_$userId';

  Future<String?> loadForUser(String userId) async {
    final prefs = await SharedPreferences.getInstance();
    final scoped = prefs.getString(scopedKey(userId))?.trim();
    if (scoped != null && scoped.isNotEmpty) return scoped;

    // Migration one-shot: ancien token global appartenant à cet utilisateur.
    final owner = prefs.getString(ownerKey)?.trim();
    final legacy = prefs.getString(legacyKey)?.trim();
    if (legacy != null && legacy.isNotEmpty && owner == userId) {
      await prefs.setString(scopedKey(userId), legacy);
      return legacy;
    }
    return null;
  }

  Future<String?> loadLegacy() async {
    final prefs = await SharedPreferences.getInstance();
    final v = prefs.getString(legacyKey)?.trim();
    return (v == null || v.isEmpty) ? null : v;
  }

  Future<String?> loadOwnerUserId() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString(ownerKey)?.trim();
  }

  /// Enregistre le token pour [userId] et synchronise la clé lue par le service BG.
  Future<void> saveForUser(String token, String userId) async {
    final prefs = await SharedPreferences.getInstance();
    final normalized = token.trim();
    await prefs.setString(scopedKey(userId), normalized);
    await prefs.setString(legacyKey, normalized);
    await prefs.setString(ownerKey, userId);
  }

  /// Efface le token d'un utilisateur et la clé globale si elle lui appartient.
  Future<void> clearForUser(String userId) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(scopedKey(userId));
    final owner = prefs.getString(ownerKey)?.trim();
    if (owner == userId) {
      await prefs.remove(legacyKey);
      await prefs.remove(ownerKey);
    }
  }

  /// Efface toutes les clés globales (logout / changement de compte).
  Future<void> clearGlobal() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(legacyKey);
    await prefs.remove(ownerKey);
  }

  /// @deprecated Utiliser [saveForUser].
  Future<void> save(String token) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(legacyKey, token.trim());
  }

  /// @deprecated Utiliser [clearForUser] / [clearGlobal].
  Future<void> clear() async {
    await clearGlobal();
  }
}
