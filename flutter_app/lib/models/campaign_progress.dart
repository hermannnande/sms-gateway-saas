/// One server-confirmed snapshot, shared by the notification and the UI.
class CampaignProgress {
  const CampaignProgress({
    required this.id,
    required this.name,
    required this.status,
    required this.sent,
    required this.total,
    this.updatedAt,
  });

  factory CampaignProgress.fromJson(Map<dynamic, dynamic> row) {
    int count(dynamic value) =>
        (int.tryParse(value?.toString() ?? '') ?? 0).clamp(0, 1 << 30);
    return CampaignProgress(
      id: row['id']?.toString() ?? '',
      name: row['name']?.toString() ?? 'Campagne',
      status: row['status']?.toString() ?? 'running',
      sent: count(row['sent_count']),
      total: count(row['total_count']),
      updatedAt: DateTime.tryParse(row['updated_at']?.toString() ?? ''),
    );
  }

  final String id;
  final String name;
  final String status;
  final int sent;
  final int total;
  final DateTime? updatedAt;

  double get fraction => total > 0 ? (sent / total).clamp(0.0, 1.0) : 0;
  bool get finished => const ['done', 'completed', 'canceled'].contains(status);

  /// Compare server timestamps, not counts: deleting queued messages or
  /// repairing an old incorrect counter can legitimately lower a count.
  bool isOlderThan(CampaignProgress? other) =>
      other != null && id == other.id && updatedAt != null &&
      other.updatedAt != null && updatedAt!.isBefore(other.updatedAt!);
}
