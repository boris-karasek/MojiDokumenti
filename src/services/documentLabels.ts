/**
 * documentLabels.ts — čitljivi srpski nazivi za DocumentType.
 *
 * Izdvojeno iz ManualEntryScreen (modul 6) jer isti mapping treba i listi
 * i detaljima dokumenta (modul 7) — naziv tipa se ne sme duplirati na
 * više mesta.
 */

import type { DocumentType } from '../types';

export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  pasos: 'Pasoš',
  licna_karta: 'Lična karta',
  vozacka: 'Vozačka dozvola',
  oruzni_list: 'Oružni list',
  platna_kartica: 'Platna kartica',
  ostalo: 'Ostalo',
};

export const DOCUMENT_TYPES = Object.keys(DOCUMENT_TYPE_LABELS) as DocumentType[];
