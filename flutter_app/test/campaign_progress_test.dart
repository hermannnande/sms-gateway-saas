import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:smsgateway_flutter/main.dart';
import 'package:smsgateway_flutter/models/campaign_progress.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  Map<String, dynamic> snapshot(int sent, String updatedAt, {int total = 100}) => {
    'id': 'campaign-a', 'name': 'Test', 'status': 'running',
    'sent_count': sent, 'total_count': total, 'updated_at': updatedAt,
  };

  test('chaque résultat confirmé actualise immédiatement le compteur', () {
    final container = ProviderContainer();
    addTearDown(container.dispose);
    final notifier = container.read(appProvider.notifier);
    notifier.applyCampaignProgress(snapshot(41, '2026-09-13T10:00:00Z'));
    notifier.applyCampaignProgress(snapshot(42, '2026-09-13T10:00:01Z'));
    expect(container.read(appProvider).campaignSentCount, 42);
    expect(container.read(appProvider).campaignTotalCount, 100);
  });

  test('une réponse ancienne ne fait pas reculer la barre', () {
    final container = ProviderContainer();
    addTearDown(container.dispose);
    final notifier = container.read(appProvider.notifier);
    notifier.applyCampaignProgress(snapshot(42, '2026-09-13T10:00:01Z'));
    notifier.applyCampaignProgress(snapshot(41, '2026-09-13T10:00:00Z'));
    notifier.applyCampaignProgress(snapshot(42, '2026-09-13T10:00:01Z'));
    expect(container.read(appProvider).campaignSentCount, 42);
  });

  test('une vraie correction serveur peut réduire un ancien compteur faux', () {
    final container = ProviderContainer();
    addTearDown(container.dispose);
    final notifier = container.read(appProvider.notifier);
    notifier.applyCampaignProgress(snapshot(105, '2026-09-13T10:00:00Z'));
    notifier.applyCampaignProgress(snapshot(98, '2026-09-13T10:00:01Z'));
    expect(container.read(appProvider).campaignSentCount, 98);
  });

  test('les valeurs héritées ne produisent ni division par zéro ni dépassement', () {
    expect(CampaignProgress.fromJson(snapshot(0, '', total: 0)).fraction, 0);
    expect(CampaignProgress.fromJson(snapshot(105, '')).fraction, 1);
    expect(CampaignProgress.fromJson(snapshot(42, '')).fraction, .42);
  });
}
