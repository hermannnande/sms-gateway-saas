import assert from 'node:assert/strict'
import test from 'node:test'
import * as XLSX from 'xlsx'

import {
  parseContactRows,
  parseDelimitedContacts,
  parseExcelContacts,
  personalizeContactMessage,
} from '../src/lib/contact-personalization.ts'

test('reconnaît Téléphone +225 et Nom client parmi plusieurs colonnes', () => {
  const contacts = parseContactRows([
    ['', 'Téléphone +225', 'Opérateur', 'Nom client', 'Ville / commune'],
    ['0100003746', '+2250100003746', 'Moov CI', 'Daho', 'Deux plateaux'],
    ['0100008619', '+2250100008619', 'Moov CI', 'Amiral 14h', 'Yopougon'],
  ])

  assert.deepEqual(contacts, [
    { phone: '+2250100003746', name: 'Daho' },
    { phone: '+2250100008619', name: 'Amiral 14h' },
  ])
})

test('gère un CSV avec colonnes inversées, accents et valeurs entre guillemets', () => {
  const contacts = parseDelimitedContacts(
    'Nom client;Ville;Téléphone +225\n"Claude";"Dabou";"+2250100009203"',
  )

  assert.deepEqual(contacts, [{ phone: '+2250100009203', name: 'Claude' }])
})

test('lit directement un fichier Excel structuré comme la feuille du client', () => {
  const workbook = XLSX.utils.book_new()
  const sheet = XLSX.utils.aoa_to_sheet([
    ['', 'Téléphone +225', 'Opérateur', 'Nom client', 'Ville / commune'],
    ['0100012801', '+2250100012801', 'Moov CI', 'David', 'Anyama'],
  ])
  XLSX.utils.book_append_sheet(workbook, sheet, 'Contacts')
  const bytes = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' })

  assert.deepEqual(parseExcelContacts(bytes), [
    { phone: '+2250100012801', name: 'David' },
  ])
})

test('personnalise toutes les variables avec le nom propre au contact', () => {
  assert.equal(
    personalizeContactMessage('Bonjour {nom}, offre pour {NAME}.', 'Daho'),
    'Bonjour Daho, offre pour Daho.',
  )
})

test('remplace la variable par client lorsque le nom est vide', () => {
  assert.equal(personalizeContactMessage('Bonjour {nom}', ''), 'Bonjour client')
})
