import 'package:flutter_test/flutter_test.dart';
import 'package:smsgateway_flutter/services/dispatch_permission.dart';

void main() {
  test('each cached campaign SMS is rechecked; API defers and campaign resumes', () async {
    var apiPending = false;
    var sent = 0;
    var deferred = 0;
    final posted = <String>[];
    Future<void> attempt(String id) async {
      final allowed = await DispatchPermission.check(
        deviceToken: 'phone-a', messageId: id,
        post: (body) async {
          expect(body['device_token'], 'phone-a');
          posted.add(body['message_id'] as String);
          return {'allowed': !apiPending, 'reason': apiPending ? 'api_priority' : 'ready'};
        },
        onDeferred: (reason) async { expect(reason, 'api_priority'); deferred++; },
      );
      if (allowed) sent++;
    }
    await attempt('campaign-1');
    apiPending = true;
    await attempt('campaign-2');
    expect(sent, 1); expect(deferred, 1);
    apiPending = false;
    await attempt('campaign-2');
    expect(sent, 2); expect(posted, ['campaign-1', 'campaign-2', 'campaign-2']);
  });
  test('network/protocol failures stop dispatch without reporting an SMS failure', () async {
    var deferred = false;
    for (final response in <Map<String, dynamic>>[{}, {'allowed': 'true'}]) {
      await expectLater(DispatchPermission.check(deviceToken:'phone-a',messageId:'sms',
        post: (_) async => response, onDeferred: (_) async { deferred = true; }), throwsStateError);
    }
    await expectLater(DispatchPermission.check(deviceToken:'phone-a',messageId:'sms',
      post: (_) async => throw StateError('offline'), onDeferred: (_) async { deferred = true; }), throwsStateError);
    expect(deferred, false);
  });
  test('manual pause or cancelled campaign is never approved or resumed', () async {
    String? reason;
    expect(await DispatchPermission.check(deviceToken:'phone-a',messageId:'sms',
      post: (_) async => {'allowed':false,'reason':'message_inactive'},
      onDeferred: (value) async { reason=value; }), false);
    expect(reason,'message_inactive');
  });
}
