import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:smsgateway_flutter/services/background_sync_service.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  test('automatic maintenance respects an explicitly disabled sender and pause',
      () async {
    SharedPreferences.setMockInitialValues({
      'device_token': 'device-a',
      'device_token_owner_user_id': 'user-a',
      'bg_sync_enabled': false,
      'bg_sync_paused': true,
    });
    await BackgroundSyncService.ensureAutoSync();
    expect(await BackgroundSyncService.isEnabled(), isFalse);
    expect(await BackgroundSyncService.isPaused(), isTrue);
  });
  test('legacy lock without timestamp cannot block sending forever', () async {
    SharedPreferences.setMockInitialValues({'bg_sync_fg_lock': true});
    expect(await BackgroundSyncService.isForegroundLocked(), isFalse);
  });
  test('a fresh manual lock is respected; an abandoned lock expires', () async {
    SharedPreferences.setMockInitialValues({});
    await BackgroundSyncService.setForegroundLock(true);
    expect(await BackgroundSyncService.isForegroundLocked(), isTrue);
    final prefs = await SharedPreferences.getInstance();
    await prefs.setInt(
        'bg_sync_fg_lock_at', DateTime.now().millisecondsSinceEpoch - 180000);
    expect(await BackgroundSyncService.isForegroundLocked(), isFalse);
  });
}
