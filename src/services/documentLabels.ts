/**
 * documentLabels.ts — čitljivi srpski nazivi za DocumentType.
 *
 * Izdvojeno iz ManualEntryScreen (modul 6) jer isti mapping treba i listi
 * i detaljima dokumenta (modul 7) — naziv tipa se ne sme duplirati na
 * više mesta.
 */

import type { DocumentType } from '../types';
import type { ExpiryStatus } from './documentStatus';

export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  pasos: 'Pasoš',
  licna_karta: 'Lična karta',
  vozacka: 'Vozačka dozvola',
  oruzni_list: 'Oružni list',
  platna_kartica: 'Platna kartica',
  ostalo: 'Ostalo',
};

export const STATUS_LABELS: Record<ExpiryStatus, string> = {
  istekao: 'Istekao',
  istice_uskoro: 'Ističe uskoro',
  vazeci: 'Važeći',
};

export const STATUS_STYLES: Record<ExpiryStatus, { bg: string; text: string }> = {
  istekao: { bg: '#fdecea', text: '#a33b2e' },
  istice_uskoro: { bg: '#fff4e0', text: '#b8720a' },
  vazeci: { bg: '#e6f4ea', text: '#2e7d32' },
};

export const DOCUMENT_TYPES = Object.keys(DOCUMENT_TYPE_LABELS) as DocumentType[];
