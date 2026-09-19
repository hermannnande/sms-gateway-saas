import 'dart:io';
import 'package:supabase/supabase.dart';

/// Original mobile imports are downloadable from the same private web archive.
class CampaignImportArchive {
  static Future<String> upload(
    SupabaseClient client, {
    required File file,
    required String fileName,
    required String orgId,
    required String campaignName,
    required int contactCount,
  }) async {
    final user = client.auth.currentUser;
    if (user == null)
      throw Exception('Reconnectez-vous pour conserver le fichier importé.');
    final size = await file.length();
    if (size <= 0 || size > 25 * 1024 * 1024)
      throw Exception('Fichier vide ou supérieur à 25 Mo.');
    final safeName = fileName.replaceAll(RegExp(r'[^a-zA-Z0-9._-]'), '_');
    final path =
        '$orgId/sans-campagne/mobile-${DateTime.now().microsecondsSinceEpoch}-$safeName';
    final bucket = client.storage.from('campaign-imports');
    await bucket.upload(path, file,
        fileOptions:
            const FileOptions(contentType: 'application/octet-stream'));
    try {
      final row = await client
          .from('campaign_import_files')
          .insert({
            'org_id': orgId,
            'campaign_name': campaignName,
            'uploaded_by': user.id,
            'file_name': fileName,
            'storage_path': path,
            'size_bytes': size,
            'contact_count': contactCount,
            'invalid_count': 0,
          })
          .select('id')
          .single();
      return row['id'] as String;
    } catch (_) {
      await bucket.remove([path]);
      rethrow;
    }
  }
}
