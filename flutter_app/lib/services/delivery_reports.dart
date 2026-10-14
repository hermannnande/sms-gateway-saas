import 'package:flutter/services.dart';

/// Native SQLite is the durable outbox. Acknowledge only the exact revision
/// accepted by the server, so a receipt arriving during HTTP is not lost.
class DeliveryReports {
  static const _channel = MethodChannel('com.smsgateway.app/sms');
  bool _busy = false;

  Future<void> flush({
    required String deviceToken,
    required Future<Map<String, dynamic>> Function(Map<String, dynamic>) post,
  }) async {
    if (_busy) return;
    _busy = true;
    try {
      // Bounded work, with another pass every ten seconds even during a long
      // send batch, a pause, or after campaign completion.
      for (var batch = 0; batch < 4; batch++) {
        final raw = await _channel.invokeMethod<List<dynamic>>(
          'getDeliveryReports', {'device_token': deviceToken});
        if (raw == null || raw.isEmpty) return;
        final reports = raw.map((r) => Map<String, dynamic>.from(r as Map)).toList();
        final response = await post({'device_token': deviceToken, 'reports': reports});
        if (response['ok'] != true || response['acknowledged'] is! List || response['rejected'] is! List) {
          throw StateError('Réponse accusés invalide');
        }
        // Never acknowledge an identity/revision not in this submitted batch.
        List<dynamic> matching(dynamic rows) => (rows as List).where((row) =>
          row is Map && reports.any((r) => r['attempt_id'] == row['attempt_id'] && r['revision'] == row['revision'])).toList();
        final accepted = matching(response['acknowledged']);
        final rejected = matching(response['rejected']);
        if (accepted.isEmpty && rejected.isEmpty) return;
        await _channel.invokeMethod('ackDeliveryReports', {
          'device_token': deviceToken, 'acknowledged': accepted, 'rejected': rejected,
        });
      }
    } finally { _busy = false; }
  }
}
