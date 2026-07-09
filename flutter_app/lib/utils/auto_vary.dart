import 'dart:math';

/// Variation AUTOMATIQUE du texte des SMS (anti-signature opérateur).
///
/// But : deux SMS d'une même campagne ne doivent jamais être octet-pour-octet
/// identiques. Les filtres anti-spam des opérateurs (MTN / Orange…) repèrent
/// les envois en masse en détectant le contenu strictement dupliqué. En variant
/// légèrement chaque message, on casse cette signature.
///
/// Deux couches, appliquées par destinataire :
///  1. **Spintax** `{a|b|c}` : si l'utilisateur a écrit des alternatives entre
///     accolades, on en tire une au hasard (variation FORTE, choisie par lui,
///     donc toujours correcte). Sans accolades, le texte est inchangé.
///  2. **Micro-variation invisible** : de simples espaces (espaces doublés au
///     milieu, espaces en fin) — jamais un mot n'est modifié, donc le sens et
///     le ton restent intacts. AU MOINS une modification est garantie dès que
///     la place le permet.
///
/// Contraintes respectées :
///  - **Sens préservé** : on ne remplace aucun mot de l'utilisateur.
///  - **Encodage GSM-7** : on n'ajoute QUE des espaces ordinaires. Aucun
///    caractère hors GSM-7 (emoji, espace insécable, caractère invisible
///    Unicode…), sinon le SMS basculerait en UCS-2 (70 caractères/segment au
///    lieu de 160 → surcoût et signal suspect).
///  - **Coût inchangé** : les espaces ajoutés ne font JAMAIS franchir une
///    limite de segment (160 septets en simple, 153/segment en concaténé ;
///    70/67 en UCS-2). Un SMS d'une page reste facturé une page.
class AutoVary {
  /// Applique la variation à [body]. Retourne [body] inchangé si [enabled] est
  /// faux. [rng] permet d'injecter un générateur partagé (meilleure répartition).
  static String apply(String body, {required bool enabled, Random? rng}) {
    if (!enabled || body.isEmpty) return body;
    final r = rng ?? _shared;
    var out = _expandSpintax(body, r);
    out = _jitterSpaces(out, r);
    return out;
  }

  static final Random _shared = Random();

  // Alphabet GSM 03.38 : table de base (1 septet/caractère) + extension
  // (2 septets/caractère : ^ { } \ [ ~ ] | €).
  static const String _gsm7Base =
      '@£\$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !"#¤%&\'()*+,-./0123456789:;<=>?'
      '¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà';
  static const String _gsm7Ext = '^{}\\[~]|€';

  /// Longueur de [s] en septets GSM-7 (les caractères de l'extension comptent
  /// double). Retourne -1 si un caractère force l'encodage UCS-2.
  static int gsm7Septets(String s) {
    var n = 0;
    for (var i = 0; i < s.length; i++) {
      final c = s[i];
      if (_gsm7Base.contains(c)) {
        n += 1;
      } else if (_gsm7Ext.contains(c)) {
        n += 2;
      } else {
        return -1;
      }
    }
    return n;
  }

  /// Nombre de segments facturés pour [s] (GSM-7 : 160 simple / 153 par
  /// segment concaténé ; UCS-2 : 70 / 67).
  static int segmentCount(String s) {
    final sept = gsm7Septets(s);
    if (sept >= 0) {
      return sept <= 160 ? 1 : (sept + 152) ~/ 153;
    }
    final len = s.length; // unités UTF-16 ≈ caractères UCS-2
    return len <= 70 ? 1 : (len + 66) ~/ 67;
  }

  /// Nombre d'espaces (1 septet / 1 unité UCS-2 chacun) que l'on peut ajouter
  /// à [s] SANS augmenter son nombre de segments — donc sans surcoût.
  static int _addableUnits(String s) {
    final sept = gsm7Septets(s);
    if (sept >= 0) {
      final segs = sept <= 160 ? 1 : (sept + 152) ~/ 153;
      final cap = segs == 1 ? 160 : segs * 153;
      return cap - sept;
    }
    final len = s.length;
    final segs = len <= 70 ? 1 : (len + 66) ~/ 67;
    final cap = segs == 1 ? 70 : segs * 67;
    return cap - len;
  }

  /// Développe le spintax `{a|b|c}` : chaque groupe entre accolades est remplacé
  /// par une de ses options (séparées par `|`), tirée au hasard. Gère
  /// l'imbrication (`{a|{b|c}}`) en résolvant d'abord les groupes internes, et
  /// les options vides (`{|texte}` peut ne rien insérer). Sans accolades, le
  /// texte est renvoyé tel quel.
  static String _expandSpintax(String input, Random rng) {
    if (!input.contains('{')) return input;
    // Groupe le plus interne = accolades ne contenant pas d'autres accolades.
    final re = RegExp(r'\{([^{}]*)\}');
    var s = input;
    // Garde-fou anti-boucle (au cas où le texte contiendrait beaucoup de `{}`).
    for (var guard = 0; guard < 1000; guard++) {
      final m = re.firstMatch(s);
      if (m == null) break;
      final options = m.group(1)!.split('|');
      final choice = options[rng.nextInt(options.length)];
      s = s.replaceRange(m.start, m.end, choice);
    }
    return s;
  }

  /// Micro-variation par les ESPACES uniquement (invisible ou quasi) :
  ///  - 0 à 2 espaces internes doublés entre deux mots (survivent au nettoyage
  ///    des espaces de fin pratiqué par certains réseaux) ;
  ///  - 0 à 2 espaces en toute fin (invisibles à la lecture).
  /// Garanties :
  ///  - AU MOINS une modification dès que le budget de segment le permet
  ///    (jamais deux tirages « zéro partout ») ;
  ///  - le nombre de segments facturés ne change JAMAIS (si le message frôle
  ///    la limite, on n'ajoute rien plutôt que de le faire déborder).
  static String _jitterSpaces(String body, Random rng) {
    if (body.trim().isEmpty) return body;
    // Repart d'une fin « propre » (on gère nous-mêmes les espaces finaux).
    final out = body.replaceFirst(RegExp(r'[ ]+$'), '');

    // Budget : espaces ajoutables sans franchir une limite de segment.
    final budget = _addableUnits(out);
    if (budget <= 0) return out;

    // Positions d'espaces internes doublables (un espace simple entre 2 mots).
    final gaps = <int>[];
    for (var i = 1; i < out.length - 1; i++) {
      if (out[i] == ' ' && out[i - 1] != ' ' && out[i + 1] != ' ') {
        gaps.add(i);
      }
    }

    // Tirage borné par le budget, avec au moins une modification garantie.
    var internal =
        gaps.isEmpty ? 0 : rng.nextInt(min(2, min(gaps.length, budget)) + 1);
    var trailing = rng.nextInt(min(2, budget - internal) + 1);
    if (internal == 0 && trailing == 0) {
      if (gaps.isNotEmpty && rng.nextBool()) {
        internal = 1;
      } else {
        trailing = 1;
      }
    }

    var varied = out;
    if (internal > 0) {
      final picked = List<int>.of(gaps)..shuffle(rng);
      // Insertion de droite à gauche pour ne pas décaler les positions suivantes.
      final chosen = picked.take(internal).toList()
        ..sort((a, b) => b.compareTo(a));
      for (final pos in chosen) {
        varied = '${varied.substring(0, pos)} ${varied.substring(pos)}';
      }
    }
    if (trailing > 0) varied = varied + (' ' * trailing);
    return varied;
  }
}
