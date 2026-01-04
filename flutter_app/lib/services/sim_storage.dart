import 'package:shared_preferences/shared_preferences.dart';

class SimStorage {
  static const _key = 'selected_sim_subscription_id';

  Future<int?> loadSelectedSimId() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getInt(_key);
  }

  Future<void> saveSelectedSimId(int? subscriptionId) async {
    final prefs = await SharedPreferences.getInstance();
    if (subscriptionId == null) {
      await prefs.remove(_key);
      return;
    }
    await prefs.setInt(_key, subscriptionId);
  }
}


