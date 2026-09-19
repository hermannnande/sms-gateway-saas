import 'package:flutter_foreground_task/flutter_foreground_task.dart';
import 'package:flutter_foreground_task/flutter_foreground_task_platform_interface.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:smsgateway_flutter/services/background_sync_service.dart';

class _SenderPlatform extends FlutterForegroundTaskPlatform {
  bool running = false;
  bool launchWorker = true;
  bool replyWithWrongId = false;
  int starts = 0;
  int updates = 0;
  int restarts = 0;
  Function? installedCallback;
  TaskHandler? worker;

  @override
  Future<bool> get isRunningService async => running;

  @override
  Future<void> startService({
    required AndroidNotificationOptions androidNotificationOptions,
    required IOSNotificationOptions iosNotificationOptions,
    required ForegroundTaskOptions foregroundTaskOptions,
    int? serviceId,
    List<ForegroundServiceTypes>? serviceTypes,
    required String notificationTitle,
    required String notificationText,
    NotificationIcon? notificationIcon,
    List<NotificationButton>? notificationButtons,
    String? notificationInitialRoute,
    Function? callback,
  }) async {
    starts++;
    running = true;
    installedCallback = callback;
    if (launchWorker) callback?.call();
  }

  @override
  Future<void> updateService({
    ForegroundTaskOptions? foregroundTaskOptions,
    String? notificationTitle,
    String? notificationText,
    NotificationIcon? notificationIcon,
    List<NotificationButton>? notificationButtons,
    String? notificationInitialRoute,
    Function? callback,
  }) async {
    updates++;
    installedCallback = callback;
    if (launchWorker) callback?.call();
  }

  @override
  Future<void> restartService() async {
    restarts++;
  }

  @override
  void setTaskHandler(TaskHandler handler) {
    worker = handler;
    // Do not call onStart: these tests never access the network or telephony.
  }

  @override
  void sendDataToTask(Object data) {
    if (data is! Map || data['type'] != 'sender_ping') return;
    if (replyWithWrongId) {
      FlutterForegroundTask.sendDataToMain({
        'type': 'sender_pong',
        'probe_id': 'unrelated-probe',
      });
    } else {
      worker?.onReceiveData(data);
    }
  }
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  final originalPlatform = FlutterForegroundTaskPlatform.instance;
  final originalTimeout = BackgroundSyncService.workerResponseTimeout;
  late _SenderPlatform platform;

  setUpAll(() async {
    await BackgroundSyncService.init();
    BackgroundSyncService.workerResponseTimeout =
        const Duration(milliseconds: 35);
  });

  setUp(() {
    platform = _SenderPlatform();
    FlutterForegroundTaskPlatform.instance = platform;
    SharedPreferences.setMockInitialValues({
      'device_token': 'fake-device',
      'device_token_owner_user_id': 'fake-owner',
      'bg_sync_enabled': true,
      'bg_sync_paused': false,
    });
  });

  tearDown(() async {
    await platform.worker?.onDestroy(DateTime.now(), false);
    expect(FlutterForegroundTask.dataCallbacks, isEmpty,
        reason:
            'Health probes must unregister their callback after completion.');
  });

  tearDownAll(() {
    BackgroundSyncService.workerResponseTimeout = originalTimeout;
    FlutterForegroundTaskPlatform.instance = originalPlatform;
    FlutterForegroundTask.resetStatic();
  });

  test(
      'concurrent maintenance starts one worker and waits for its actual reply',
      () async {
    await Future.wait(
        List.generate(6, (_) => BackgroundSyncService.ensureAutoSync()));
    expect(platform.starts, 1);
    expect(platform.updates, 0);
    expect(platform.restarts, 0);
    expect(platform.installedCallback, same(smsBackgroundTaskEntryPoint));
  });

  test('an existing responsive worker is never replaced', () async {
    platform.running = true;
    smsBackgroundTaskEntryPoint();
    await BackgroundSyncService.ensureRunning();
    expect(platform.starts, 0);
    expect(platform.updates, 0);
    expect(platform.restarts, 0);
  });

  test('an Android service without a Dart worker receives the current callback',
      () async {
    platform.running = true;
    await Future.wait(
        List.generate(6, (_) => BackgroundSyncService.ensureRunning()));
    expect(platform.starts, 0);
    expect(platform.updates, 1);
    expect(platform.installedCallback, same(smsBackgroundTaskEntryPoint));
    expect(platform.worker, isNotNull);
  });

  test('native running flag alone cannot report a successful startup',
      () async {
    platform.running = true;
    platform.launchWorker = false;
    await expectLater(
        BackgroundSyncService.ensureRunning(),
        throwsA(isA<StateError>().having((error) => error.message, 'message',
            contains('le moteur d’envoi ne répond pas'))));
    expect(platform.updates, 1);
    expect(platform.restarts, 0);
  });

  test('a reply from an unrelated probe does not mark the worker healthy',
      () async {
    platform.running = true;
    platform.replyWithWrongId = true;
    platform.launchWorker = false;
    await expectLater(BackgroundSyncService.ensureRunning(), throwsStateError);
  });

  test('checking a paused worker preserves its pause', () async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool('bg_sync_paused', true);
    await BackgroundSyncService.ensureRunning();
    expect(await BackgroundSyncService.isPaused(), isTrue);
    expect(platform.updates, 0);
  });
}
