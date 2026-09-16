import 'dart:convert';
import 'package:shared_preferences/shared_preferences.dart';

typedef ReportPost = Future<Map<String, dynamic>> Function(Map<String, dynamic>);

/// Persist results before HTTP. A network retry reports the same result; it
/// must never reclaim and send an already-sent SMS just to recover its count.
class PendingMessageReports {
  static String _key(String token) => 'pending_message_reports_$token';

  static Future<Map<String, dynamic>> submit({
    required String deviceToken,
    required Map<String, dynamic> body,
    required ReportPost post,
  }) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.reload();
    final pending = _read(prefs, deviceToken);
    pending[body['message_id'].toString()] = body;
    await prefs.setString(_key(deviceToken), jsonEncode(pending));
    final response = await post(body);
    pending.remove(body['message_id'].toString());
    await prefs.setString(_key(deviceToken), jsonEncode(pending));
    return response;
  }

  static Future<void> flush({
    required String deviceToken,
    required ReportPost post,
    void Function(Map<String, dynamic>)? onReport,
  }) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.reload();
    final pending = _read(prefs, deviceToken);
    for (final id in pending.keys.toList()) {
      final response = await post(Map<String, dynamic>.from(pending[id] as Map));
      pending.remove(id);
      await prefs.setString(_key(deviceToken), jsonEncode(pending));
      onReport?.call(response);
    }
  }

  static Map<String, dynamic> _read(SharedPreferences prefs, String token) =>
      Map<String, dynamic>.from(jsonDecode(prefs.getString(_key(token)) ?? '{}') as Map);
}
