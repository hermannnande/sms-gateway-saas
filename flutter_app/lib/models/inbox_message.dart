class InboxMessage {
  InboxMessage({
    required this.id,
    required this.fromPhoneE164,
    required this.body,
    required this.receivedAt,
    required this.read,
  });

  final String id;
  final String fromPhoneE164;
  final String body;
  final DateTime receivedAt;
  final bool read;

  factory InboxMessage.fromJson(Map<String, dynamic> json) {
    DateTime safeDate(dynamic v) {
      final s = v?.toString();
      if (s == null || s.isEmpty) return DateTime.fromMillisecondsSinceEpoch(0);
      return DateTime.tryParse(s) ?? DateTime.fromMillisecondsSinceEpoch(0);
    }

    return InboxMessage(
      id: json['id'].toString(),
      fromPhoneE164: (json['from_phone_e164'] ?? '').toString(),
      body: (json['body'] ?? '').toString(),
      receivedAt: safeDate(json['received_at'] ?? json['created_at']),
      read: (json['read'] == true),
    );
  }
}


