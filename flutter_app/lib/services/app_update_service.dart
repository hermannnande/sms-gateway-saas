import 'dart:convert';

import 'package:package_info_plus/package_info_plus.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:http/http.dart' as http;
import 'package:smsgateway_flutter/config.dart';

class AppUpdateInfo {
  AppUpdateInfo({
    required this.latestVersion,
    required this.apkUrl,
    required this.releaseUrl,
    required this.notes,
  });

  final String latestVersion; // ex: v1.0.0+12
  final String apkUrl;
  final String releaseUrl;
  final String? notes;
}

class AppUpdateService {
  static const _ignoredKey = 'ignored_update_version';
  static Uri _manifestUrl() => Uri.parse(AppConfig.appUpdateManifestUrl);

  Future<AppUpdateInfo?> checkForUpdate() async {
    final current = await _currentVersion();
    final ignored = await _ignoredVersion();

    final latest = await _fetchLatestManifest();
    if (latest == null) return null;

    // Si l'utilisateur a ignoré exactement cette version, ne rien afficher
    if (ignored != null && ignored == latest.latestVersion) return null;

    // Comparaison robuste: version + buildNumber (ex: v1.0.1+3)
    if (!_isNewer(latest.latestVersion, current)) return null;

    return latest;
  }

  Future<void> ignoreVersion(String version) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_ignoredKey, version);
  }

  Future<void> openApkDownload(String url) async {
    final uri = Uri.parse(url);
    if (!await launchUrl(uri, mode: LaunchMode.externalApplication)) {
      throw Exception('Impossible d’ouvrir le lien de téléchargement.');
    }
  }

  Future<void> openReleasePage(String url) async {
    final uri = Uri.parse(url);
    if (!await launchUrl(uri, mode: LaunchMode.externalApplication)) {
      throw Exception('Impossible d’ouvrir la page de version.');
    }
  }

  Future<String> _currentVersion() async {
    final info = await PackageInfo.fromPlatform();
    // Format stable: version+buildNumber (ex: 1.0.0+12)
    return 'v${info.version}+${info.buildNumber}';
  }

  String _normalizeVersion(String v) {
    var s = v.trim();
    if (s.startsWith('v')) s = s.substring(1);
    return s;
  }

  Future<String?> _ignoredVersion() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString(_ignoredKey);
  }

  Future<AppUpdateInfo?> _fetchLatestManifest() async {
    final res = await http.get(
      _manifestUrl(),
      headers: {'Accept': 'application/json'},
    );
    if (res.statusCode >= 400) return null;

    final json = jsonDecode(res.body) as Map<String, dynamic>;
    final latestVersionRaw = (json['latestVersion'] as String?)?.trim();
    final notes = (json['notes'] as String?)?.trim();
    final apkUrlRaw = (json['apkUrl'] as String?)?.trim();

    if (latestVersionRaw == null ||
        latestVersionRaw.isEmpty ||
        apkUrlRaw == null ||
        apkUrlRaw.isEmpty) {
      return null;
    }

    final latestVersion =
        latestVersionRaw.startsWith('v') ? latestVersionRaw : 'v$latestVersionRaw';

    final apkUrl =
        apkUrlRaw.startsWith('http') ? apkUrlRaw : AppConfig.apkDownloadUrl;

    return AppUpdateInfo(
      latestVersion: latestVersion,
      apkUrl: apkUrl,
      releaseUrl: AppConfig.appUpdateHelpUrl,
      notes: notes?.isEmpty == true ? null : notes,
    );
  }

  bool _isNewer(String latest, String current) {
    final a = _parseVersion(latest);
    final b = _parseVersion(current);
    if (a == null || b == null) {
      // Fallback simple si parsing échoue: différent => proposer update
      return _normalizeVersion(latest) != _normalizeVersion(current);
    }
    return a.compareTo(b) > 0;
  }

  _ParsedVersion? _parseVersion(String v) {
    var s = v.trim();
    if (s.startsWith('v')) s = s.substring(1);

    final parts = s.split('+');
    final base = parts.isNotEmpty ? parts[0] : s;
    final build = parts.length > 1 ? int.tryParse(parts[1]) : 0;

    final nums = base.split('.');
    final major = nums.isNotEmpty ? int.tryParse(nums[0]) : null;
    final minor = nums.length > 1 ? int.tryParse(nums[1]) : 0;
    final patch = nums.length > 2 ? int.tryParse(nums[2]) : 0;

    if (major == null) return null;
    return _ParsedVersion(
      major: major,
      minor: minor ?? 0,
      patch: patch ?? 0,
      build: build ?? 0,
    );
  }
}

class _ParsedVersion implements Comparable<_ParsedVersion> {
  const _ParsedVersion({
    required this.major,
    required this.minor,
    required this.patch,
    required this.build,
  });

  final int major;
  final int minor;
  final int patch;
  final int build;

  @override
  int compareTo(_ParsedVersion other) {
    if (major != other.major) return major.compareTo(other.major);
    if (minor != other.minor) return minor.compareTo(other.minor);
    if (patch != other.patch) return patch.compareTo(other.patch);
    return build.compareTo(other.build);
  }
}


