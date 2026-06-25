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

SimRouting resolveSimRouting(Message message, List<SimCard> sims) {
  if (message.simSubscriptionId != null && message.simSubscriptionId! > 0) {
    return SimRouting(subscriptionId: message.simSubscriptionId);
  }

  final slot = message.simSlotIndex;
  if (slot == null) {
    return const SimRouting();
  }

  for (final sim in sims) {
    if (sim.simSlotIndex == slot && sim.subscriptionId > 0) {
      return SimRouting(subscriptionId: sim.subscriptionId, simSlotIndex: slot);
    }
  }

  return SimRouting(simSlotIndex: slot);
}
