class Message {
  final String id;
  final String to;
  final String content;
  final int tryCount;
  final int? simSubscriptionId;

  Message({
    required this.id,
    required this.to,
    required this.content,
    this.tryCount = 0,
    this.simSubscriptionId,
  });

  factory Message.fromJson(Map<String, dynamic> json) {
    return Message(
      id: json['id'].toString(),
      to: (json['to_phone_e164'] ??
              json['phone_e164'] ??
              json['recipient'] ??
              json['to'] ??
              '')
          .toString(),
      content: (json['content'] ?? json['body'] ?? json['message'] ?? '')
          .toString(),
      tryCount: (json['try_count'] ?? 0) is int
          ? json['try_count'] as int
          : int.tryParse(json['try_count']?.toString() ?? '0') ?? 0,
      simSubscriptionId: json['sim_subscription_id'] == null
          ? null
          : int.tryParse(json['sim_subscription_id'].toString()),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'to': to,
      'content': content,
      'try_count': tryCount,
      'sim_subscription_id': simSubscriptionId,
    };
  }
}

