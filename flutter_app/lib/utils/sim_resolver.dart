import 'package:smsgateway_flutter/models/message.dart';
import 'package:smsgateway_flutter/services/sms_sender.dart';

/// Résout la SIM à utiliser pour un message de campagne.
///
/// Le serveur stocke `sim_subscription_id = "slot:0"` (SIM 1) ou `"slot:1"` (SIM 2).
/// On tente d'abord de mapper le slot vers un subscriptionId Android connu,
/// sinon on transmet le slot au code natif qui interroge SubscriptionManager.
class SimRouting {
  const SimRouting({this.subscriptionId, this.simSlotIndex});

  final int? subscriptionId;
  final int? simSlotIndex;

  bool get requiresSpecificSim => subscriptionId != null || simSlotIndex != null;
}

SimRouting resolveSimRouting(
  Message message,
  List<SimCard> sims, {
  int? campaignSlotFallback,
}) {
  if (message.simSubscriptionId != null && message.simSubscriptionId! > 0) {
    return SimRouting(subscriptionId: message.simSubscriptionId);
  }

  // Filet de sécurité: si le serveur n'a pas propagé la SIM sur le message
  // (ancienne fonction SQL claim_messages_atomic encore déployée), on applique
  // quand même le slot défini sur la campagne (renvoyé dans le payload claim).
  final slot = message.simSlotIndex ?? campaignSlotFallback;
  if (slot == null || slot < 0) {
    return const SimRouting();
  }

  for (final sim in sims) {
    if (sim.simSlotIndex == slot && sim.subscriptionId > 0) {
      return SimRouting(subscriptionId: sim.subscriptionId, simSlotIndex: slot);
    }
  }

  return SimRouting(simSlotIndex: slot);
}

/// Extrait la map campagne → slot SIM depuis le payload claim
/// (`campaigns: [{id, sim_slot_index, ...}]`). Tolère l'absence du champ.
Map<String, int> campaignSimSlots(Map<String, dynamic> payload) {
  final raw = payload['campaigns'];
  if (raw is! List) return const {};
  final out = <String, int>{};
  for (final item in raw) {
    if (item is! Map) continue;
    final id = item['id']?.toString().trim();
    if (id == null || id.isEmpty) continue;
    final slotRaw = item['sim_slot_index'];
    final slot = slotRaw is int ? slotRaw : int.tryParse('${slotRaw ?? ''}');
    if (slot != null && slot >= 0) {
      out[id] = slot;
    }
  }
  return out;
}
