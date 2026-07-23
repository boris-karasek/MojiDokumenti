/**
 * documentLabels.ts — čitljivi srpski nazivi za DocumentType.
 *
 * Izdvojeno iz ManualEntryScreen (modul 6) jer isti mapping treba i listi
 * i detaljima dokumenta (modul 7) — naziv tipa se ne sme duplirati na
 * više mesta.
 */

import type { DocumentType } from '../types';
import type { ExpiryStatus } from './documentStatus';
import theme from '../ui/theme';

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
  istekao: { bg: theme.colors.dangerSoft, text: theme.colors.danger },
  istice_uskoro: { bg: theme.colors.warningSoft, text: theme.colors.warning },
  vazeci: { bg: theme.colors.successSoft, text: theme.colors.success },
};

export const DOCUMENT_TYPES = Object.keys(DOCUMENT_TYPE_LABELS) as DocumentType[];
