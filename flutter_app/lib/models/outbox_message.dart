class OutboxMessage {
  OutboxMessage({
    required this.id,
    required this.toPhoneE164,
    required this.body,
    required this.status,
    required this.createdAt,
    required this.tryCount,
    this.lastError,
    this.sentAt,
    this.simSubscriptionId,
  });

  final String id;
  final String toPhoneE164;
  final String body;
  final String status;
  final DateTime createdAt;
  final int tryCount;
  final String? lastError;
  final DateTime? sentAt;
  final String? simSubscriptionId;

  factory OutboxMessage.fromJson(Map<String, dynamic> json) {
    int safeInt(dynamic v) {
      if (v == null) return 0;
      if (v is int) return v;
      if (v is double) return v.toInt();
      return int.tryParse(v.toString()) ?? 0;
    }

    DateTime safeDate(dynamic v) {
      final s = v?.toString();
      if (s == null || s.isEmpty) return DateTime.fromMillisecondsSinceEpoch(0);
      return DateTime.tryParse(s) ?? DateTime.fromMillisecondsSinceEpoch(0);
    }

    DateTime? safeDateNullable(dynamic v) {
      final s = v?.toString();
      if (s == null || s.isEmpty) return null;
      return DateTime.tryParse(s);
    }

    return OutboxMessage(
      id: json['id'].toString(),
      toPhoneE164: (json['to_phone_e164'] ?? '').toString(),
      body: (json['body_final'] ?? '').toString(),
      status: (json['status'] ?? '').toString(),
      createdAt: safeDate(json['created_at']),
      tryCount: safeInt(json['try_count']),
      lastError: json['last_error']?.toString(),
      sentAt: safeDateNullable(json['sent_at']),
      simSubscriptionId: json['sim_subscription_id']?.toString(),
    );
  }
}


