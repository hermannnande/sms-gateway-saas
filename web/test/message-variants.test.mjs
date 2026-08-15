import assert from 'node:assert/strict'
import test from 'node:test'

import {
  MAX_CAMPAIGN_MESSAGE_VARIANTS,
  createSmartVariantRotation,
  normalizeMessageVariants,
} from '../src/lib/message-variants.ts'

function seededRandom(seed) {
  let state = seed >>> 0
  return () => {
    state = (1664525 * state + 1013904223) >>> 0
    return state / 0x100000000
  }
}

test('nettoie les textes et supprime les variantes identiques', () => {
  assert.deepEqual(
    normalizeMessageVariants(' Message A ', ['', 'Message B', 'Message A', null]),
    ['Message A', 'Message B'],
  )
})

test('répartit 15 messages par cycles mélangés sans répétition consécutive', () => {
  const variants = Array.from(
    { length: MAX_CAMPAIGN_MESSAGE_VARIANTS },
    (_, index) => `Message ${index + 1}`,
  )
  const assignments = createSmartVariantRotation(variants, 47, seededRandom(20260815))

  assert.equal(assignments.length, 47)
  for (let index = 1; index < assignments.length; index++) {
    assert.notEqual(assignments[index], assignments[index - 1])
  }

  for (let start = 0; start + variants.length <= assignments.length; start += variants.length) {
    assert.equal(new Set(assignments.slice(start, start + variants.length)).size, variants.length)
  }

  const counts = variants.map(
    (variant) => assignments.filter((assignment) => assignment === variant).length,
  )
  assert.ok(Math.max(...counts) - Math.min(...counts) <= 1)
})

test('un message unique reste utilisable pour tous les destinataires', () => {
  assert.deepEqual(createSmartVariantRotation(['Unique'], 3), ['Unique', 'Unique', 'Unique'])
})

test('refuse plus de 15 variantes', () => {
  const variants = Array.from({ length: 16 }, (_, index) => `Message ${index + 1}`)
  assert.throws(
    () => createSmartVariantRotation(variants, 16),
    /Maximum 15 messages différents/,
  )
})
