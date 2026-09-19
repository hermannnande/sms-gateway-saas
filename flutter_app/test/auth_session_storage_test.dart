import 'dart:convert';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:supabase/supabase.dart';
import 'package:smsgateway_flutter/services/auth_session_storage.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  setUp(() => SharedPreferences.setMockInitialValues({}));

  Session session(String refresh) {
    final payload = base64Url
        .encode(utf8.encode(jsonEncode({
          'sub': 'user-a',
          'exp': DateTime.now().millisecondsSinceEpoch ~/ 1000 + 3600,
        })))
        .replaceAll('=', '');
    return Session(
        accessToken: 'e30.$payload.signature',
        tokenType: 'bearer',
        refreshToken: refresh,
        user: User(
            id: 'user-a',
            appMetadata: {},
            userMetadata: {},
            aud: 'authenticated',
            createdAt: '2026-09-19T00:00:00Z'));
  }

  test('restores the complete session offline without any HTTP request',
      () async {
    final storage = AuthSessionStorage();
    await storage.saveSession(session('refresh-1'));
    final client = SupabaseClient('https://example.supabase.co', 'test',
        httpClient: MockClient((_) async {
      fail('Offline restoration must not need HTTP');
    }));
    expect(await storage.restore(client), isTrue);
    expect(client.auth.currentUser?.id, 'user-a');
    expect(client.auth.currentSession?.refreshToken, 'refresh-1');
    await client.dispose();
  });

  test('a transient legacy refresh failure keeps the stored token', () async {
    final storage = AuthSessionStorage();
    await storage.saveRefreshToken('keep-me');
    final client = SupabaseClient('https://example.supabase.co', 'test',
        httpClient: MockClient((_) async =>
            http.Response('{"message":"temporarily unavailable"}', 429)));
    final subscription =
        client.auth.onAuthStateChange.listen((_) {}, onError: (_) {});
    expect(await storage.restore(client), isFalse);
    expect(await storage.loadRefreshToken(), 'keep-me');
    await subscription.cancel();
    await client.dispose();
  });

  test('confirmed revoked refresh token is cleared', () async {
    final storage = AuthSessionStorage();
    await storage.saveRefreshToken('revoked');
    final client = SupabaseClient('https://example.supabase.co', 'test',
        httpClient: MockClient((_) async => http.Response(
            '{"code":"refresh_token_not_found","error_code":"refresh_token_not_found","message":"Invalid Refresh Token"}',
            400)));
    final subscription =
        client.auth.onAuthStateChange.listen((_) {}, onError: (_) {});
    expect(await storage.restore(client), isFalse);
    expect(await storage.loadRefreshToken(), isNull);
    await subscription.cancel();
    await client.dispose();
  });

  test('logout wins over queued session writes and clears all persisted auth',
      () async {
    final storage = AuthSessionStorage();
    final first = storage.saveSession(session('old'));
    final rotated = storage.saveSession(session('new'));
    final logout = storage.clear();
    await Future.wait([first, rotated, logout]);
    expect(await storage.loadRefreshToken(), isNull);
    final prefs = await SharedPreferences.getInstance();
    expect(prefs.getString('supabase_persisted_session'), isNull);
  });
}
