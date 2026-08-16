import 'dart:math';

import 'package:flutter_test/flutter_test.dart';
import 'package:smsgateway_flutter/services/app_settings.dart';
import 'package:smsgateway_flutter/utils/auto_vary.dart';

/// Ensemble des caractères de base de l'alphabet GSM 03.38 (7 bits) + les
/// caractères de l'extension. Sert à vérifier que la variation n'introduit
/// AUCUN caractère qui forcerait un encodage UCS-2 (donc pas d'espace insécable
/// ni de caractère invisible Unicode).
const _gsm7 =
    '@£\$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !"#¤%&\'()*+,-./0123456789:;<=>?'
    '¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà'
    '^{}\\[~]|€';

bool _isGsm7(String s) => s.split('').every((c) => _gsm7.contains(c));

void main() {
  group('AutoVary.apply', () {
    test('désactivé => texte strictement inchangé', () {
      const body = 'Bonjour cher client, profitez de notre offre.';
      expect(AutoVary.apply(body, enabled: false), body);
    });

    test('spintax : choisit une des options', () {
      final rng = Random(42);
      const body = '{Bonjour|Salut|Coucou} le monde';
      for (var i = 0; i < 50; i++) {
        final out = AutoVary.apply(body, enabled: true, rng: rng).trim();
        // Normalise les espaces internes doublés éventuels avant de comparer.
        final norm = out.replaceAll(RegExp(r' +'), ' ');
        expect(
          ['Bonjour le monde', 'Salut le monde', 'Coucou le monde'],
          contains(norm),
        );
      }
    });

    test('spintax imbriqué + option vide', () {
      final rng = Random(7);
      const body = 'Offre{ spéciale| du jour|} {ici|là}';
      for (var i = 0; i < 50; i++) {
        final out = AutoVary.apply(body, enabled: true, rng: rng);
        expect(out.contains('{'), isFalse, reason: 'accolades non résolues: $out');
        expect(out.contains('}'), isFalse, reason: 'accolades non résolues: $out');
      }
    });

    test('reste en GSM-7 (aucun caractère invisible/UCS-2 ajouté)', () {
      final rng = Random(123);
      const body = 'Promo -50% aujourd\'hui seulement, appelez le 0700000000';
      for (var i = 0; i < 200; i++) {
        final out = AutoVary.apply(body, enabled: true, rng: rng);
        expect(_isGsm7(out), isTrue, reason: 'caractère hors GSM-7 dans: $out');
      }
    });

    test('sens préservé : mêmes mots (aux espaces près)', () {
      final rng = Random(99);
      const body = 'Votre colis arrive demain entre 9h et 12h';
      for (var i = 0; i < 100; i++) {
        final out = AutoVary.apply(body, enabled: true, rng: rng);
        final words = out.trim().replaceAll(RegExp(r' +'), ' ');
        expect(words, body);
      }
    });

    test('variation GARANTIE : ne renvoie jamais le texte d\'origine '
        '(quand la place le permet)', () {
      final rng = Random(555);
      const body = 'Merci pour votre confiance, a bientot';
      for (var i = 0; i < 200; i++) {
        final out = AutoVary.apply(body, enabled: true, rng: rng);
        expect(out, isNot(body),
            reason: 'itération $i : sortie identique à l\'entrée');
      }
    });

    test('casse la signature : produit plusieurs formes distinctes', () {
      final rng = Random(2024);
      const body = 'Merci pour votre confiance, a bientot';
      final forms = <String>{};
      for (var i = 0; i < 100; i++) {
        forms.add(AutoVary.apply(body, enabled: true, rng: rng));
      }
      // Sur 100 envois, on doit obtenir de nombreuses variantes d'octets.
      expect(forms.length, greaterThan(5));
    });

    test('message vide => vide', () {
      expect(AutoVary.apply('', enabled: true), '');
    });
  });

  group('AutoVary — coût (segments) jamais augmenté', () {
    test('gsm7Septets : base=1, extension=2, UCS-2=-1', () {
      expect(AutoVary.gsm7Septets('abc'), 3);
      expect(AutoVary.gsm7Septets('{}'), 4); // extension GSM-7
      expect(AutoVary.gsm7Septets('héllo'), 5); // é est dans la table de base
      expect(AutoVary.gsm7Septets('🔥'), -1); // emoji => UCS-2
    });

    test('segmentCount : bornes GSM-7 (160 / 153) et UCS-2 (70 / 67)', () {
      expect(AutoVary.segmentCount('a' * 160), 1);
      expect(AutoVary.segmentCount('a' * 161), 2);
      expect(AutoVary.segmentCount('a' * 306), 2);
      expect(AutoVary.segmentCount('a' * 307), 3);
      expect(AutoVary.segmentCount('🔥' * 35), 1); // 70 unités UTF-16
      expect(AutoVary.segmentCount('${'🔥' * 35}a'), 2); // 71 unités
    });

    test('message PILE à la limite (160) => renvoyé tel quel, toujours 1 page',
        () {
      final rng = Random(31);
      final body = '${'mot ' * 39}abcd'; // 39*4 + 4 = 160 caractères GSM-7
      expect(AutoVary.gsm7Septets(body), 160);
      for (var i = 0; i < 100; i++) {
        final out = AutoVary.apply(body, enabled: true, rng: rng);
        expect(out, body);
        expect(AutoVary.segmentCount(out), 1);
      }
    });

    test('message proche de la limite : varie SANS passer à 2 pages', () {
      final rng = Random(77);
      final body = '${'mot ' * 39}ab'; // 158 caractères => budget de 2
      final forms = <String>{};
      for (var i = 0; i < 200; i++) {
        final out = AutoVary.apply(body, enabled: true, rng: rng);
        forms.add(out);
        expect(AutoVary.segmentCount(out), 1,
            reason: 'passé à 2 segments: "${out.length} chars"');
      }
      expect(forms.length, greaterThan(1));
    });

    test('message multi-segments : le nombre de segments ne change pas', () {
      final rng = Random(88);
      final body = 'promo speciale ce weekend ' * 8; // ~208 chars => 2 segments
      final baseSegments = AutoVary.segmentCount(body.trimRight());
      for (var i = 0; i < 100; i++) {
        final out = AutoVary.apply(body, enabled: true, rng: rng);
        expect(AutoVary.segmentCount(out), baseSegments);
      }
    });

    test('message UCS-2 (emoji) : varié sans changer le nombre de segments',
        () {
      final rng = Random(66);
      const body = 'Promo 🔥 -50% ce weekend seulement';
      for (var i = 0; i < 100; i++) {
        final out = AutoVary.apply(body, enabled: true, rng: rng);
        expect(AutoVary.segmentCount(out), 1);
        expect(out.trim().replaceAll(RegExp(r' +'), ' '), body);
      }
    });
  });

  group('AppSettings.pickBatchThreshold', () {
    test('reste dans la bande ±30 % et varie', () {
      final values = <int>{};
      for (var i = 0; i < 300; i++) {
        final v = AppSettings.pickBatchThreshold(10);
        expect(v, inInclusiveRange(7, 13));
        values.add(v);
      }
      // Le seuil doit réellement varier d'une pause à l'autre.
      expect(values.length, greaterThan(3));
    });

    test('petits seuils : jamais en dessous de 1', () {
      expect(AppSettings.pickBatchThreshold(1), 1);
      for (var i = 0; i < 50; i++) {
        expect(AppSettings.pickBatchThreshold(2), inInclusiveRange(1, 3));
        expect(AppSettings.pickBatchThreshold(3), inInclusiveRange(1, 5));
      }
    });
  });

  group('AppSettings responsible pacing', () {
    test('default bounds prevent burst sending', () {
      expect(AppSettings.defaultDelayMs, 6000);
      expect(AppSettings.minDelayMs, 5000);
      expect(AppSettings.defaultRandomSpreadMs, 3000);
      expect(AppSettings.defaultBatchPauseMinMs, 45000);
      expect(AppSettings.defaultBatchPauseMaxMs, 75000);
    });

    test('failure backoff grows and is capped', () {
      expect(AppSettings.failureBackoffMs(0), 0);
      expect(AppSettings.failureBackoffMs(1), 10000);
      expect(AppSettings.failureBackoffMs(2), 20000);
      expect(AppSettings.failureBackoffMs(4), 40000);
      expect(AppSettings.failureBackoffMs(20), 40000);
    });
  });
}
