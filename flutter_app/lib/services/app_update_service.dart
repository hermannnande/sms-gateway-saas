import 'dart:convert';

import 'package:package_info_plus/package_info_plus.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:http/http.dart' as http;

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

  /// Repo GitHub (public). On utilise Releases pour une mise à jour "semi-auto".
  static const String repoOwner = 'hermannnande';
  static const String repoName = 'sms-gateway-saas';

  static Uri _latestReleaseApi() => Uri.parse(
        'https://api.github.com/repos/$repoOwner/$repoName/releases/latest',
      );

  Future<AppUpdateInfo?> checkForUpdate() async {
    final current = await _currentVersion();
    final ignored = await _ignoredVersion();

    final release = await _fetchLatestRelease();
    if (release == null) return null;

    // Si l'utilisateur a ignoré exactement cette version, ne rien afficher
    if (ignored != null && ignored == release.latestVersion) return null;

    // Comparaison simple : si différent => update dispo.
    // (On peut renforcer plus tard avec un parsing semver+build.)
    final a = _normalizeVersion(release.latestVersion);
    final b = _normalizeVersion(current);
    if (a == b) return null;

    return release;
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

  Future<AppUpdateInfo?> _fetchLatestRelease() async {
    final res = await http.get(
      _latestReleaseApi(),
      headers: {
        'Accept': 'application/vnd.github+json',
      },
    );
    if (res.statusCode >= 400) return null;

    final json = jsonDecode(res.body) as Map<String, dynamic>;
    final tag = (json['tag_name'] as String?)?.trim();
    final htmlUrl = (json['html_url'] as String?)?.trim();
    final body = (json['body'] as String?)?.trim();
    final assets = (json['assets'] as List?) ?? const [];

    // Chercher un asset APK
    String? apkUrl;
    for (final a in assets) {
      final m = a as Map<String, dynamic>;
      final name = (m['name'] as String?) ?? '';
      final download = (m['browser_download_url'] as String?) ?? '';
      if (name.toLowerCase().endsWith('.apk') && download.isNotEmpty) {
        apkUrl = download;
        break;
      }
    }

    if (tag == null || tag.isEmpty || htmlUrl == null || htmlUrl.isEmpty || apkUrl == null) {
      return null;
    }

    // On normalise en "vX.Y.Z+N" si possible
    final latestVersion = tag.startsWith('v') ? tag : 'v$tag';

    return AppUpdateInfo(
      latestVersion: latestVersion,
      apkUrl: apkUrl,
      releaseUrl: htmlUrl,
      notes: body?.isEmpty == true ? null : body,
    );
  }
}


