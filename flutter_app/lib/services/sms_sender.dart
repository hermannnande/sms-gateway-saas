import 'dart:async';

import 'package:flutter/services.dart';
import 'package:logger/logger.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:smsgateway_flutter/models/message.dart';

class SmsSendResult {
  SmsSendResult(this.success, {this.error});

  final bool success;
  final String? error;
}

class SmsSender {
  SmsSender(this._logger);

  static const _channel = MethodChannel('com.smsgateway.app/sms');
  final Logger _logger;

  Future<bool> ensurePermissions() async {
    final statuses = await [
      Permission.sms,
      Permission.phone,
    ].request();

    final granted = statuses.values.every((s) => s.isGranted);
    if (!granted) {
      _logger.w('Permissions SMS/Phone refusées: $statuses');
    }
    return granted;
  }

  Future<SmsSendResult> send(Message message) async {
    try {
      final ok = await _channel.invokeMethod<bool>('sendSms', {
            'to': message.to,
            'body': message.content,
            'subscriptionId': message.simSubscriptionId,
          }) ??
          false;

      return SmsSendResult(ok, error: ok ? null : 'Echec natif');
    } on PlatformException catch (e) {
      _logger.e('Erreur envoi SMS (platform)', error: e);
      return SmsSendResult(false, error: e.message);
    } catch (e, st) {
      _logger.e('Erreur envoi SMS', error: e, stackTrace: st);
      return SmsSendResult(false, error: e.toString());
    }
  }
}

