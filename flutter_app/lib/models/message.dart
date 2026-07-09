class Message {
  final String id;
  final String to;
  final String content;
  final int tryCount;
  final String? campaignId;
  final int? simSubscriptionId;
  final int? simSlotIndex;

  Message({
    required this.id,
    required this.to,
    required this.content,
    this.tryCount = 0,
    this.campaignId,
    this.simSubscriptionId,
    this.simSlotIndex,
  });

  factory Message.fromJson(Map<String, dynamic> json) {
    final simRaw = json['sim_subscription_id'];
    final simParsed = _parseSim(simRaw);
    return Message(
      id: json['id'].toString(),
      campaignId: json['campaign_id']?.toString(),
      to: (json['to_phone_e164'] ??
              json['phone_e164'] ??
              json['recipient'] ??
              json['to'] ??
              '')
          .toString(),
      // Supabase renvoie généralement `body_final` depuis claim_messages_atomic
      content: (json['body_final'] ?? json['content'] ?? json['body'] ?? json['message'] ?? '')
          .toString(),
      tryCount: _safeParseInt(json['try_count'], defaultValue: 0),
      simSubscriptionId: simParsed.subscriptionId,
      simSlotIndex: simParsed.slotIndex,
    );
  }

  static ({int? subscriptionId, int? slotIndex}) _parseSim(dynamic value) {
    if (value == null) return (subscriptionId: null, slotIndex: null);
    final s = value.toString().trim();
    if (s.startsWith('slot:')) {
      final idx = int.tryParse(s.substring(5));
      return (subscriptionId: null, slotIndex: idx);
    }
    final sub = int.tryParse(s);
    return (subscriptionId: sub, slotIndex: null);
  }

  static int _safeParseInt(dynamic value, {int? defaultValue}) {
    if (value == null) return defaultValue ?? 0;
    if (value is int) return value;
    if (value is double) return value.toInt();
    if (value is String) return int.tryParse(value) ?? defaultValue ?? 0;
    return defaultValue ?? 0;
  }

  /// Copie du message avec un contenu remplacé (utilisé pour envoyer une
  /// variante du texte sans altérer l'id/destinataire/routage SIM).
  Message copyWith({String? content}) {
    return Message(
      id: id,
      to: to,
      content: content ?? this.content,
      tryCount: tryCount,
      campaignId: campaignId,
      simSubscriptionId: simSubscriptionId,
      simSlotIndex: simSlotIndex,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'campaign_id': campaignId,
      'to': to,
      'content': content,
      'try_count': tryCount,
      'sim_subscription_id': simSubscriptionId ?? (simSlotIndex == null ? null : 'slot:$simSlotIndex'),
    };
  }
}

