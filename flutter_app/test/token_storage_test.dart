import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:smsgateway_flutter/services/token_storage.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  test('restored account pairing also restores the background sender identity', () async {
    SharedPreferences.setMockInitialValues({'device_token_user-a': 'token-a'});
    final storage = TokenStorage();
    expect(await storage.loadForUser('user-a'), 'token-a');
    expect(await storage.loadLegacy(), 'token-a');
    expect(await storage.loadOwnerUserId(), 'user-a');
  });

  test('switching to a saved account replaces both active background keys', () async {
    SharedPreferences.setMockInitialValues({
      'device_token_user-a': 'token-a',
      'device_token': 'token-b',
      'device_token_owner_user_id': 'user-b',
    });
    final storage = TokenStorage();
    expect(await storage.loadForUser('user-a'), 'token-a');
    expect(await storage.loadLegacy(), 'token-a');
    expect(await storage.loadOwnerUserId(), 'user-a');
  });

  test('an account without saved pairing cannot adopt another account token', () async {
    SharedPreferences.setMockInitialValues({
      'device_token': 'token-b',
      'device_token_owner_user_id': 'user-b',
    });
    expect(await TokenStorage().loadForUser('user-a'), isNull);
  });
}
