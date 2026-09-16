import 'dart:math';

import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
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
  // Les tests de cadence passent par SharedPreferences : le binding et le
  // magasin simulé sont indispensables, et sans effet sur les tests purs.
  TestWidgetsFlutterBinding.ensureInitialized();
  setUp(() => SharedPreferences.setMockInitialValues({}));

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
        expect(out.contains('{'), isFalse,
            reason: 'accolades non résolues: $out');
        expect(out.contains('}'), isFalse,
            reason: 'accolades non résolues: $out');
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

    test(
        'variation GARANTIE : ne renvoie jamais le texte d\'origine '
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
      expect(AppSettings.defaultDelayMs, 5000);
      expect(AppSettings.minDelayMs, 5000);
      expect(AppSettings.defaultRandomSpreadMs, 2000);
      expect(AppSettings.defaultBatchPauseMinMs, 30000);
      expect(AppSettings.defaultBatchPauseMaxMs, 45000);
    });

    test('failure backoff grows and is capped', () {
      expect(AppSettings.failureBackoffMs(0), 0);
      expect(AppSettings.failureBackoffMs(1), 10000);
      expect(AppSettings.failureBackoffMs(2), 20000);
      expect(AppSettings.failureBackoffMs(4), 40000);
      expect(AppSettings.failureBackoffMs(20), 40000);
    });

    test('un délai en cours adopte une nouvelle valeur plus courte', () async {
      const initial = SmsPacingSettings(
        minDelayMs: 250,
        maxDelayMs: 250,
        batchPauseEnabled: true,
        batchPauseCount: 10,
        batchPauseMinMs: 500,
        batchPauseMaxMs: 500,
      );
      const updated = SmsPacingSettings(
        minDelayMs: 35,
        maxDelayMs: 35,
        batchPauseEnabled: true,
        batchPauseCount: 10,
        batchPauseMinMs: 500,
        batchPauseMaxMs: 500,
      );
      final stopwatch = Stopwatch()..start();

      final result = await AppSettings.waitWithLiveRefresh(
        initialSettings: initial,
        useBatchPause: false,
        consecutiveFailures: 0,
        refreshSettings: () async => updated,
        refreshInterval: const Duration(milliseconds: 10),
        tick: const Duration(milliseconds: 5),
      );
      stopwatch.stop();

      expect(result.settings, updated);
      expect(result.interrupted, isFalse);
      expect(stopwatch.elapsedMilliseconds, lessThan(180));
    });

    test('désactiver la pause en cours reprend le délai SMS normal', () async {
      const initial = SmsPacingSettings(
        minDelayMs: 40,
        maxDelayMs: 40,
        batchPauseEnabled: true,
        batchPauseCount: 10,
        batchPauseMinMs: 500,
        batchPauseMaxMs: 500,
      );
      const updated = SmsPacingSettings(
        minDelayMs: 40,
        maxDelayMs: 40,
        batchPauseEnabled: false,
        batchPauseCount: 10,
        batchPauseMinMs: 500,
        batchPauseMaxMs: 500,
      );
      final stopwatch = Stopwatch()..start();

      final result = await AppSettings.waitWithLiveRefresh(
        initialSettings: initial,
        useBatchPause: true,
        consecutiveFailures: 0,
        refreshSettings: () async => updated,
        refreshInterval: const Duration(milliseconds: 10),
        tick: const Duration(milliseconds: 5),
      );
      stopwatch.stop();

      expect(result.usedBatchPause, isFalse);
      expect(stopwatch.elapsedMilliseconds, lessThan(180));
    });
  });

  group('AppSettings mode turbo', () {
    // Fabrique d'instantanés NON const : deux appels renvoient bien deux
    // objets distincts, ce qui est indispensable pour tester `operator ==`.
    SmsPacingSettings instantane({
      int minDelayMs = 40,
      int maxDelayMs = 40,
      bool batchPauseEnabled = true,
      int batchPauseCount = 10,
      int batchPauseMinMs = 30000,
      int batchPauseMaxMs = 45000,
      bool turboEnabled = false,
    }) =>
        SmsPacingSettings(
          minDelayMs: minDelayMs,
          maxDelayMs: maxDelayMs,
          batchPauseEnabled: batchPauseEnabled,
          batchPauseCount: batchPauseCount,
          batchPauseMinMs: batchPauseMinMs,
          batchPauseMaxMs: batchPauseMaxMs,
          turboEnabled: turboEnabled,
        );

    test('par défaut le turbo est éteint et la cadence reste responsable',
        () async {
      expect(await AppSettings.getTurboEnabled(), isFalse);
      final reglages = await AppSettings.getSmsPacingSettings();
      expect(reglages.turboEnabled, isFalse);
      expect(reglages.minDelayMs, greaterThanOrEqualTo(AppSettings.minDelayMs));
    });

    test('la clé locale du turbo est bien cfg_turbo_mode_enabled', () async {
      SharedPreferences.setMockInitialValues({'cfg_turbo_mode_enabled': true});
      expect(await AppSettings.getTurboEnabled(), isTrue);
      expect((await AppSettings.getSmsPacingSettings()).turboEnabled, isTrue);
    });

    test(
        'turbo actif : cadence plate de 1 s malgré des délais enregistrés '
        'élevés', () async {
      await AppSettings.setSmsDelayMs(45000);
      await AppSettings.setSmsDelayMaxMs(60000);
      await AppSettings.setBatchPauseEnabled(true);
      await AppSettings.setTurboEnabled(true);

      final reglages = await AppSettings.getSmsPacingSettings();
      expect(reglages.turboEnabled, isTrue);
      expect(reglages.minDelayMs, AppSettings.turboDelayMs);
      expect(reglages.maxDelayMs, AppSettings.turboDelayMs);
      // Plancher local de 5 s volontairement contourné...
      expect(reglages.minDelayMs, lessThan(AppSettings.minDelayMs));
      // ...et aucune bande aléatoire automatique ajoutée par-dessus.
      expect(reglages.minDelayMs, reglages.maxDelayMs);
      expect(
        AppSettings.pickDelayMs(reglages.minDelayMs, reglages.maxDelayMs),
        AppSettings.turboDelayMs,
      );
      // La pause par lot est neutralisée quoi qu'en dise le réglage stocké.
      expect(reglages.batchPauseEnabled, isFalse);
      expect(await AppSettings.getBatchPauseEnabled(), isTrue);
    });

    test("couper le turbo restitue la cadence enregistrée par l'utilisateur",
        () async {
      await AppSettings.setSmsDelayMs(45000);
      await AppSettings.setSmsDelayMaxMs(60000);
      await AppSettings.setBatchPauseEnabled(true);
      await AppSettings.setBatchPauseCount(15);
      await AppSettings.setTurboEnabled(true);
      expect((await AppSettings.getSmsPacingSettings()).turboEnabled, isTrue);

      await AppSettings.setTurboEnabled(false);
      final reglages = await AppSettings.getSmsPacingSettings();
      expect(reglages.turboEnabled, isFalse);
      expect(reglages.minDelayMs, 45000);
      expect(reglages.maxDelayMs, 60000);
      expect(reglages.minDelayMs, greaterThanOrEqualTo(AppSettings.minDelayMs));
      expect(reglages.batchPauseEnabled, isTrue);
      expect(reglages.batchPauseCount, 15);
    });

    test(
        'applyRemoteSettings enregistre turbo_mode_enabled sans écraser les '
        'autres réglages', () async {
      await AppSettings.applyRemoteSettings({
        'message_delay_seconds': 12,
        'message_delay_max_seconds': 20,
        'batch_pause_enabled': true,
        'batch_pause_count': 15,
        'batch_pause_min_seconds': 60,
        'batch_pause_max_seconds': 90,
        'turbo_mode_enabled': true,
      });

      expect(await AppSettings.getTurboEnabled(), isTrue);
      final turbo = await AppSettings.getSmsPacingSettings();
      expect(turbo.turboEnabled, isTrue);
      expect(turbo.minDelayMs, AppSettings.turboDelayMs);
      expect(turbo.maxDelayMs, AppSettings.turboDelayMs);
      expect(turbo.batchPauseEnabled, isFalse);

      // Les valeurs ordinaires ont survécu à l'aller-retour.
      expect(await AppSettings.getSmsDelayMs(), 12000);
      expect(await AppSettings.getSmsDelayMaxMs(), 20000);
      expect(await AppSettings.getBatchPauseEnabled(), isTrue);
      expect(turbo.batchPauseCount, 15);
      expect(turbo.batchPauseMinMs, 60000);
      expect(turbo.batchPauseMaxMs, 90000);

      // Et la ligne suivante qui coupe le turbo les restitue à l'identique.
      await AppSettings.applyRemoteSettings({'turbo_mode_enabled': false});
      final normal = await AppSettings.getSmsPacingSettings();
      expect(normal.turboEnabled, isFalse);
      expect(normal.minDelayMs, 12000);
      expect(normal.maxDelayMs, 20000);
      expect(normal.batchPauseEnabled, isTrue);
      expect(normal.batchPauseCount, 15);
      expect(normal.batchPauseMinMs, 60000);
      expect(normal.batchPauseMaxMs, 90000);
    });

    test('une ligne sans turbo_mode_enabled laisse le turbo inchangé',
        () async {
      await AppSettings.setTurboEnabled(true);
      await AppSettings.applyRemoteSettings({'message_delay_seconds': 9});
      expect(await AppSettings.getTurboEnabled(), isTrue);
      expect((await AppSettings.getSmsPacingSettings()).turboEnabled, isTrue);
    });

    test('deux instantanés ne différant que par le turbo ne sont pas égaux',
        () {
      final normal = instantane();
      final turbo = instantane(turboEnabled: true);

      // Sans ce champ dans operator==, activer le turbo au milieu d'une
      // campagne serait ignoré par waitWithLiveRefresh, en silence.
      expect(normal == turbo, isFalse);
      expect(turbo == normal, isFalse);
      expect(normal.hashCode == turbo.hashCode, isFalse);

      // L'égalité reste vraie entre deux instantanés réellement identiques.
      expect(turbo, instantane(turboEnabled: true));
      expect(turbo.hashCode, instantane(turboEnabled: true).hashCode);
      expect(normal, instantane());
    });

    test("le turbo n'ajoute pas le backoff d'échec consécutif", () async {
      final turbo = instantane(
        minDelayMs: AppSettings.turboDelayMs,
        maxDelayMs: AppSettings.turboDelayMs,
        batchPauseEnabled: false,
        turboEnabled: true,
      );
      final restes = <int>[];
      final stopwatch = Stopwatch()..start();

      final result = await AppSettings.waitWithLiveRefresh(
        initialSettings: turbo,
        useBatchPause: true,
        // Hors turbo, 3 échecs ajoutent 30 000 ms à l'attente.
        consecutiveFailures: 3,
        refreshSettings: () async => turbo,
        // On coupe dès le premier battement : la cible visée est déjà connue,
        // inutile de dormir la seconde entière.
        shouldInterrupt: () async => restes.isNotEmpty,
        onTick: (remainingMs, isBatchPause) async => restes.add(remainingMs),
        refreshInterval: const Duration(milliseconds: 10),
        tick: const Duration(milliseconds: 5),
      );
      stopwatch.stop();

      expect(restes, isNotEmpty);
      expect(restes.first, lessThanOrEqualTo(AppSettings.turboDelayMs));
      expect(restes.first, greaterThan(AppSettings.turboDelayMs ~/ 2));
      // Le turbo ne prend jamais la pause par lot, même si l'appelant en
      // réclame une.
      expect(result.usedBatchPause, isFalse);
      expect(result.interrupted, isTrue);
      expect(stopwatch.elapsedMilliseconds, lessThan(500));
    });

    test('activer le turbo pendant une pause par lot la coupe court', () async {
      final enPause = instantane(batchPauseMinMs: 30000, batchPauseMaxMs: 30000);
      final enTurbo = instantane(
        minDelayMs: AppSettings.turboDelayMs,
        maxDelayMs: AppSettings.turboDelayMs,
        batchPauseEnabled: false,
        batchPauseMinMs: 30000,
        batchPauseMaxMs: 30000,
        turboEnabled: true,
      );
      final restes = <int>[];
      final modes = <bool>[];
      final stopwatch = Stopwatch()..start();

      final result = await AppSettings.waitWithLiveRefresh(
        initialSettings: enPause,
        useBatchPause: true,
        consecutiveFailures: 0,
        refreshSettings: () async => enTurbo,
        shouldInterrupt: () async => modes.contains(false),
        onTick: (remainingMs, isBatchPause) async {
          restes.add(remainingMs);
          modes.add(isBatchPause);
        },
        refreshInterval: const Duration(milliseconds: 10),
        tick: const Duration(milliseconds: 5),
      );
      stopwatch.stop();

      expect(modes.first, isTrue, reason: 'la pause par lot a bien démarré');
      expect(modes.last, isFalse, reason: 'le turbo a coupé la pause en cours');
      expect(restes.first, greaterThan(AppSettings.turboDelayMs));
      expect(restes.last, lessThanOrEqualTo(AppSettings.turboDelayMs));
      expect(result.settings, enTurbo);
      expect(result.usedBatchPause, isFalse);
      expect(stopwatch.elapsedMilliseconds, lessThan(500));
    });

    // ── Cadence à échéance (turbo uniquement) ──────────────────────────────
    // [turboDelayMs] est une PÉRIODE d'un départ à l'autre, pas un supplément
    // ajouté après le travail : le temps déjà consacré au message (accusé
    // d'envoi natif puis compte rendu de statut) est déduit du budget.
    group('cadence à échéance', () {
      SmsPacingSettings turbo() => instantane(
            minDelayMs: AppSettings.turboDelayMs,
            maxDelayMs: AppSettings.turboDelayMs,
            batchPauseEnabled: false,
            turboEnabled: true,
          );

      test(
          'turbo : le temps déjà consommé est déduit, seul le reliquat est '
          'attendu', () async {
        final reglages = turbo();
        const dejaEcouleMs = AppSettings.turboDelayMs ~/ 2;
        final stopwatch = Stopwatch()..start();

        final result = await AppSettings.waitWithLiveRefresh(
          initialSettings: reglages,
          useBatchPause: false,
          consecutiveFailures: 0,
          refreshSettings: () async => reglages,
          refreshInterval: const Duration(milliseconds: 1000),
          tick: const Duration(milliseconds: 50),
          alreadyElapsedMs: dejaEcouleMs,
        );
        stopwatch.stop();

        expect(result.interrupted, isFalse);
        // Le reliquat est bien attendu : on ne repart pas avant l'échéance.
        expect(stopwatch.elapsedMilliseconds, greaterThanOrEqualTo(400));
        // ...mais sans la soustraction on mesurerait une seconde pleine.
        expect(stopwatch.elapsedMilliseconds, lessThan(850));
      });

      test('turbo : budget déjà épuisé => aucun délai supplémentaire',
          () async {
        final reglages = turbo();
        final stopwatch = Stopwatch()..start();

        final result = await AppSettings.waitWithLiveRefresh(
          initialSettings: reglages,
          useBatchPause: false,
          consecutiveFailures: 0,
          refreshSettings: () async => reglages,
          refreshInterval: const Duration(milliseconds: 10),
          tick: const Duration(milliseconds: 50),
          // Cas le plus fréquent en production : l'accusé d'envoi natif dépasse
          // à lui seul la seconde.
          alreadyElapsedMs: AppSettings.turboDelayMs + 500,
        );
        stopwatch.stop();

        expect(result.interrupted, isFalse);
        expect(stopwatch.elapsedMilliseconds, lessThan(300));
      });

      test('hors turbo : alreadyElapsedMs est ignoré, le délai complet est '
          'respecté', () async {
        // GARDE-FOU ANTI-SPAM : si ce test tombe, tous les utilisateurs SANS
        // turbo se mettent à envoyer plus vite que ce qu'ils ont configuré.
        final normal = instantane(
          minDelayMs: 120,
          maxDelayMs: 120,
          batchPauseEnabled: false,
        );
        final stopwatch = Stopwatch()..start();

        final result = await AppSettings.waitWithLiveRefresh(
          initialSettings: normal,
          useBatchPause: false,
          consecutiveFailures: 0,
          refreshSettings: () async => normal,
          refreshInterval: const Duration(milliseconds: 1000),
          tick: const Duration(milliseconds: 20),
          // Volontairement énorme : hors turbo il ne doit RIEN retrancher.
          alreadyElapsedMs: 10000,
        );
        stopwatch.stop();

        expect(result.interrupted, isFalse);
        expect(result.settings, normal);
        expect(stopwatch.elapsedMilliseconds, greaterThanOrEqualTo(100));
        expect(stopwatch.elapsedMilliseconds, lessThan(700));
      });

      test('turbo : le tableau de bord est consulté même quand la cible vaut 0',
          () async {
        final reglages = turbo();
        var appels = 0;
        final stopwatch = Stopwatch()..start();

        await AppSettings.waitWithLiveRefresh(
          initialSettings: reglages,
          useBatchPause: false,
          consecutiveFailures: 0,
          refreshSettings: () async {
            appels++;
            return reglages;
          },
          refreshInterval: Duration.zero,
          tick: const Duration(milliseconds: 50),
          alreadyElapsedMs: AppSettings.turboDelayMs * 2,
        );
        stopwatch.stop();

        // Sans la consultation AVANT la boucle, la cible 0 empêcherait tout
        // rafraîchissement : couper le turbo passerait inaperçu jusqu'à 30 SMS.
        expect(appels, greaterThanOrEqualTo(1));
        expect(stopwatch.elapsedMilliseconds, lessThan(300));
      });
    });
  });
}
