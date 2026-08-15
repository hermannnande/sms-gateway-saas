/// Configuration de base (backend Supabase et comportement de polling).
class AppConfig {
  /// URL Supabase (projet `gamumybcoxxanhjakpde`).
  static const supabaseUrl = 'https://gamumybcoxxanhjakpde.supabase.co';

  /// URL API Web (Vercel) - utilisée comme proxy pour éviter les soucis DNS Supabase côté clients.
  /// IMPORTANT: utiliser le domaine de prod (plus fiable que *.vercel.app côté DNS chez certains opérateurs).
  static const webApiBaseUrl = 'https://smsenvoie.com';

  /// Clef publique (anon) Supabase. **Ne pas mettre la service_role ici.**
  static const supabaseAnonKey =
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdhbXVteWJjb3h4YW5oamFrcGRlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjcxMDA1MzAsImV4cCI6MjA4MjY3NjUzMH0.0SLKPBAO5AaYguxnqUjb2nDVIGvZiK8N-3FQCREKk6w';

  /// Limite de messages réclamés par cycle serveur (plusieurs cycles s'enchaînent).
  static const claimBatchSize = 30;

  /// Cadence responsable par défaut entre deux SMS. AppSettings ajoute une
  /// marge bornée pour lisser la charge du gateway.
  static const smsDelayMs = 8000;

  /// URL du manifeste de mise à jour (public).
  /// Format JSON: { "latestVersion": "1.0.1+3", "apkUrl": "https://.../sms-gateway.apk", "notes": "..." }
  static const appUpdateManifestUrl = 'https://smsenvoie.com/app/latest.json';

  /// URL directe de t\u00e9l\u00e9chargement APK (public).
  static const apkDownloadUrl = 'https://smsenvoie.com/app/sms-gateway.apk';

  /// Page d'aide (optionnel) liée à la mise à jour.
  static const appUpdateHelpUrl = 'https://smsenvoie.com/onboarding';
}
