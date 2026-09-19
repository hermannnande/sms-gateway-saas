import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:logger/logger.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:smsgateway_flutter/main.dart';
import 'package:smsgateway_flutter/services/sms_sender.dart';

class _PairedNotifier extends AppNotifier {
  @override
  AppState build() {
    super.build();
    return AppState.initial().copyWith(deviceToken: 'fake-device');
  }
}

class _DeniedSmsSender extends SmsSender {
  _DeniedSmsSender() : super(Logger());

  @override
  Future<bool> ensurePermissions() async => false;
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUp(() => SharedPreferences.setMockInitialValues({}));

  test('manual start fails visibly when the device is not paired', () async {
    final container = ProviderContainer();
    addTearDown(container.dispose);
    final notifier = container.read(appProvider.notifier);
    await expectLater(notifier.forceSyncNow(), throwsA(isA<StateError>()));
    expect(container.read(appProvider).syncing, isFalse);
  });

  test('permission denial reaches the force-send button and remains in state', () async {
    final container = ProviderContainer(overrides: [
      appProvider.overrideWith(_PairedNotifier.new),
      smsSenderProvider.overrideWithValue(_DeniedSmsSender()),
    ]);
    addTearDown(container.dispose);
    final notifier = container.read(appProvider.notifier);
    await expectLater(notifier.forceSyncNow(), throwsA(isA<StateError>()));
    final state = container.read(appProvider);
    expect(state.permissionsOk, isFalse);
    expect(state.syncing, isFalse);
    expect(state.lastStatus, contains('SMS et Téléphone'));
  });
}
