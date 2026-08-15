import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:logger/logger.dart';
import 'package:smsgateway_flutter/models/message.dart';
import 'package:smsgateway_flutter/services/sms_sender.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  const channel = MethodChannel('com.smsgateway.app/sms');
  final messenger =
      TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger;

  tearDown(() async {
    messenger.setMockMethodCallHandler(channel, null);
  });

  test('attend le résultat natif et conserve le routage SIM', () async {
    messenger.setMockMethodCallHandler(channel, (call) async {
      expect(call.method, 'sendSms');
      final args = Map<String, dynamic>.from(call.arguments as Map);
      expect(args['subscriptionId'], 24);
      expect(args['simSlotIndex'], 1);
      return true;
    });

    final result = await SmsSender(Logger()).send(
      Message(id: 'm1', to: '+2250000000000', content: 'Test'),
      subscriptionIdOverride: 24,
      simSlotIndexOverride: 1,
    );

    expect(result.success, isTrue);
    expect(result.error, isNull);
    expect(result.code, isNull);
  });

  test('propage un rejet opérateur au lieu de déclarer un succès', () async {
    messenger.setMockMethodCallHandler(channel, (call) async {
      throw PlatformException(
        code: 'SMS_NETWORK_REJECTED',
        message: "Le réseau ou l'opérateur a refusé le SMS (code Android 112)",
        details: const {'androidResultCode': 112, 'subscriptionId': 24},
      );
    });

    final result = await SmsSender(Logger()).send(
      Message(id: 'm2', to: '+2250000000001', content: 'Test'),
    );

    expect(result.success, isFalse);
    expect(result.code, 'SMS_NETWORK_REJECTED');
    expect(result.error, contains('code Android 112'));
  });
}
