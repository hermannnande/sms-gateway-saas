export const MAX_CAMPAIGN_MESSAGE_VARIANTS = 15

type RandomSource = () => number

/**
 * Nettoie les textes et retire les doublons exacts. Un même texte saisi deux
 * fois ne doit pas fausser la répartition en ayant artificiellement plus de
 * poids que les autres variantes.
 */
export function normalizeMessageVariants(
  primaryMessage: unknown,
  extraMessages: readonly unknown[] = [],
): string[] {
  const variants: string[] = []
  const seen = new Set<string>()

  for (const candidate of [primaryMessage, ...extraMessages]) {
    if (typeof candidate !== 'string') continue
    const normalized = candidate.trim()
    if (!normalized || seen.has(normalized)) continue
    seen.add(normalized)
    variants.push(normalized)
  }

  return variants
}

/**
 * La rotation est facultative. Lorsqu'elle est désactivée, les variantes
 * éventuellement conservées dans le formulaire sont ignorées sans être
 * effacées, afin que l'utilisateur puisse les retrouver en la réactivant.
 */
export function resolveCampaignMessageVariants(
  primaryMessage: unknown,
  extraMessages: readonly unknown[],
  rotationEnabled: boolean,
): string[] {
  return normalizeMessageVariants(
    primaryMessage,
    rotationEnabled ? extraMessages : [],
  )
}

function shuffledIndexes(size: number, random: RandomSource): number[] {
  const indexes = Array.from({ length: size }, (_, index) => index)
  for (let index = indexes.length - 1; index > 0; index--) {
    const swapIndex = Math.floor(random() * (index + 1))
    const current = indexes[index]
    indexes[index] = indexes[swapIndex]
    indexes[swapIndex] = current
  }
  return indexes
}

/**
 * Produit une rotation aléatoire équilibrée :
 * - toutes les variantes passent une fois avant la réutilisation d'une autre ;
 * - l'ordre est remélangé à chaque cycle ;
 * - la première variante d'un nouveau cycle diffère de la précédente.
 *
 * Avec plusieurs textes, deux destinataires consécutifs n'ont donc jamais le
 * même message et l'écart d'utilisation entre variantes reste au maximum de 1.
 */
export function createSmartVariantRotation(
  variants: readonly string[],
  recipientCount: number,
  random: RandomSource = Math.random,
): string[] {
  if (!Number.isInteger(recipientCount) || recipientCount < 0) {
    throw new RangeError('Le nombre de destinataires doit être un entier positif')
  }
  if (variants.length === 0 || recipientCount === 0) return []
  if (variants.length > MAX_CAMPAIGN_MESSAGE_VARIANTS) {
    throw new RangeError(
      `Maximum ${MAX_CAMPAIGN_MESSAGE_VARIANTS} messages différents par campagne`,
    )
  }
  if (variants.length === 1) return Array(recipientCount).fill(variants[0])

  const assignments: string[] = []
  let previousIndex: number | null = null

  while (assignments.length < recipientCount) {
    const cycle = shuffledIndexes(variants.length, random)

    if (previousIndex !== null && cycle[0] === previousIndex) {
      const replacementIndex = cycle.findIndex((index) => index !== previousIndex)
      const first = cycle[0]
      cycle[0] = cycle[replacementIndex]
      cycle[replacementIndex] = first
    }

    for (const variantIndex of cycle) {
      if (assignments.length >= recipientCount) break
      assignments.push(variants[variantIndex])
      previousIndex = variantIndex
    }
  }

  return assignments
}
