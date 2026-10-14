import 'dart:async';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:smsgateway_flutter/services/delivery_reports.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  const channel = MethodChannel('com.smsgateway.app/sms');
  final messenger = TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger;
  late List<Map<String, dynamic>> pending;
  late List<Map<dynamic, dynamic>> acknowledgements;
  setUp(() {
    pending = [{'attempt_id': 'attempt', 'message_id': 'message', 'status': 'pending', 'revision': 1}];
    acknowledgements = [];
    messenger.setMockMethodCallHandler(channel, (call) async {
      expect(call.arguments['device_token'], 'owner-token');
      if (call.method == 'getDeliveryReports') return pending.map((r) => Map.of(r)).toList();
      if (call.method == 'ackDeliveryReports') {
        acknowledgements.add(Map.from(call.arguments));
        final ack = [...call.arguments['acknowledged'], ...call.arguments['rejected']];
        pending.removeWhere((r) => ack.any((a) => a['attempt_id'] == r['attempt_id'] && a['revision'] == r['revision']));
      }
      return null;
    });
  });
  tearDown(() => messenger.setMockMethodCallHandler(channel, null));

  test('offline receipt remains queued and retries with same identity', () async {
    final sync = DeliveryReports();
    await expectLater(sync.flush(deviceToken: 'owner-token', post: (_) async => throw Exception('offline')), throwsException);
    expect(acknowledgements, isEmpty);
    expect(pending, hasLength(1));
    await sync.flush(deviceToken: 'owner-token', post: (body) async => {
      'ok': true, 'acknowledged': body['reports'], 'rejected': [],
    });
    expect(pending, isEmpty);
  });

  test('a receipt arriving during HTTP is sent as a new revision', () async {
    final sync = DeliveryReports();
    final statuses = <String>[];
    await sync.flush(deviceToken: 'owner-token', post: (body) async {
      final report = (body['reports'] as List).single;
      statuses.add(report['status']);
      if (report['revision'] == 1) pending = [{...pending.single, 'revision': 2, 'status': 'delivered'}];
      return {'ok': true, 'acknowledged': body['reports'], 'rejected': []};
    });
    expect(statuses, ['pending', 'delivered']);
    expect(pending, isEmpty);
  });

  test('invalid response and foreign acknowledgement cannot delete evidence', () async {
    final sync = DeliveryReports();
    await expectLater(sync.flush(deviceToken: 'owner-token', post: (_) async => {'ok': true}), throwsStateError);
    await sync.flush(deviceToken: 'owner-token', post: (_) async => {
      'ok': true, 'acknowledged': [{'attempt_id': 'someone-else', 'revision': 1}], 'rejected': [],
    });
    expect(acknowledgements, isEmpty);
    expect(pending, hasLength(1));
  });

  test('overlapping flushes never duplicate a batch', () async {
    final sync = DeliveryReports();
    final gate = Completer<Map<String, dynamic>>();
    var calls = 0;
    final first = sync.flush(deviceToken: 'owner-token', post: (_) { calls++; return gate.future; });
    await Future<void>.delayed(Duration.zero);
    await sync.flush(deviceToken: 'owner-token', post: (_) async { calls++; return {}; });
    gate.complete({'ok': true, 'acknowledged': pending.toList(), 'rejected': []});
    await first;
    expect(calls, 1);
  });

  test('deleted message is removed without blocking the rest of the queue', () async {
    await DeliveryReports().flush(deviceToken: 'owner-token', post: (body) async => {
      'ok': true, 'acknowledged': [], 'rejected': body['reports'],
    });
    expect(pending, isEmpty);
  });
}
