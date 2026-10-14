/// A fresh decision is required for every SMS, including messages already
/// claimed before an API request arrived. A transport/protocol error throws;
/// it must never be recorded as a failed SMS attempt.
class DispatchPermission {
  static Future<bool> check({
    required String deviceToken,
    required String messageId,
    required Future<Map<String, dynamic>> Function(Map<String, dynamic>) post,
    required Future<void> Function(String reason) onDeferred,
  }) async {
    final decision = await post({
      'device_token': deviceToken,
      'message_id': messageId,
    });
    if (decision['allowed'] is! bool) {
      throw StateError('Autorisation d’envoi indisponible');
    }
    if (decision['allowed'] == true) return true;
    await onDeferred(decision['reason']?.toString() ?? 'message_inactive');
    return false;
  }
}
