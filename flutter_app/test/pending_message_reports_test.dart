import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:smsgateway_flutter/services/pending_message_reports.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  setUp(() => SharedPreferences.setMockInitialValues({}));
  const body = {'device_token': 'phone-a', 'message_id': 'sms-1', 'status': 'sent'};

  test('un résultat hors ligne est rejoué sans renvoyer le SMS', () async {
    await expectLater(PendingMessageReports.submit(deviceToken: 'phone-a', body: body,
      post: (_) async => throw Exception('offline')), throwsException);
    final replayed = <Map<String, dynamic>>[];
    await PendingMessageReports.flush(deviceToken: 'phone-a', post: (saved) async {
      replayed.add(saved);
      return {'success': true};
    });
    expect(replayed, [body]);
    await PendingMessageReports.flush(deviceToken: 'phone-a', post: (_) async {
      fail('Un résultat confirmé ne doit plus être rejoué');
    });
  });

  test('une reprise échouée conserve le résultat pour la prochaine connexion', () async {
    Future<Map<String, dynamic>> offline(Map<String, dynamic> _) async => throw Exception('offline');
    await expectLater(PendingMessageReports.submit(deviceToken: 'phone-a', body: body, post: offline), throwsException);
    await expectLater(PendingMessageReports.flush(deviceToken: 'phone-a', post: offline), throwsException);
    var count = 0;
    await PendingMessageReports.flush(deviceToken: 'phone-a', post: (_) async {
      count++;
      return {'success': true};
    });
    expect(count, 1);
  });

  test('les résultats sont isolés par jeton appareil', () async {
    await expectLater(PendingMessageReports.submit(deviceToken: 'phone-a', body: body,
      post: (_) async => throw Exception('offline')), throwsException);
    await PendingMessageReports.flush(deviceToken: 'phone-b', post: (_) async {
      fail('Un autre compte ne doit pas recevoir ce résultat');
    });
  });
}
