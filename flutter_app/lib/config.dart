/// Configuration de base (backend Supabase et comportement de polling).
class AppConfig {
  /// URL Supabase (projet `gamumybcoxxanhjakpde`).
  static const supabaseUrl = 'https://gamumybcoxxanhjakpde.supabase.co';

  /// Clef publique (anon) Supabase. **Ne pas mettre la service_role ici.**
  static const supabaseAnonKey =
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdhbXVteWJjb3h4YW5oamFrcGRlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjcxMDA1MzAsImV4cCI6MjA4MjY3NjUzMH0.0SLKPBAO5AaYguxnqUjb2nDVIGvZiK8N-3FQCREKk6w';

  /// Limite de messages à réclamer par batch.
  static const claimBatchSize = 10;
}

