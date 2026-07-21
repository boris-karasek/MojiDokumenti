/**
 * documentValidation.test.ts — unit testovi za čistu validacionu logiku
 * manuelnog unosa (modul 6). Bez UI-ja, bez uređaja: čista funkcija ulaz→izlaz.
 */

import {
  validateManualEntry,
  hasErrors,
  buildDocumentData,
  type ManualEntryInput,
} from '../documentValidation';

const VALID_INPUT: ManualEntryInput = {
  type: 'vozacka',
  documentNumber: '123456789',
  firstName: 'MARKO',
  lastName: 'PETROVIĆ',
  nationality: '',
  expiryDate: new Date('2029-01-01T00:00:00.000Z'),
};

describe('validateManualEntry — ispravan unos', () => {
  test('potpuno ispravan unos ne vraća greške', () => {
    const errors = validateManualEntry(VALID_INPUT);
    expect(errors).toEqual({});
    expect(hasErrors(errors)).toBe(false);
  });

  test('opciono polje (nationality) može biti prazno', () => {
    const errors = validateManualEntry({ ...VALID_INPUT, nationality: '' });
    expect(hasErrors(errors)).toBe(false);
  });
});

describe('validateManualEntry — obavezna polja', () => {
  test('prazan broj dokumenta je greška', () => {
    const errors = validateManualEntry({ ...VALID_INPUT, documentNumber: '  ' });
    expect(errors.documentNumber).toBeDefined();
  });

  test('prazno ime je greška', () => {
    const errors = validateManualEntry({ ...VALID_INPUT, firstName: '' });
    expect(errors.firstName).toBeDefined();
  });

  test('prazno prezime je greška', () => {
    const errors = validateManualEntry({ ...VALID_INPUT, lastName: '   ' });
    expect(errors.lastName).toBeDefined();
  });

  test('nedostajući datum isteka je greška', () => {
    const errors = validateManualEntry({ ...VALID_INPUT, expiryDate: null });
    expect(errors.expiryDate).toBeDefined();
  });

  test('nevalidan Date objekat (Invalid Date) za expiryDate je greška', () => {
    const errors = validateManualEntry({ ...VALID_INPUT, expiryDate: new Date('nije-datum') });
    expect(errors.expiryDate).toBeDefined();
  });
});

describe('validateManualEntry — platna kartica', () => {
  test('tačno 4 cifre prolazi', () => {
    const errors = validateManualEntry({
      ...VALID_INPUT,
      type: 'platna_kartica',
      documentNumber: '1234',
    });
    expect(errors.documentNumber).toBeUndefined();
  });

  test('manje od 4 cifre je greška', () => {
    const errors = validateManualEntry({
      ...VALID_INPUT,
      type: 'platna_kartica',
      documentNumber: '123',
    });
    expect(errors.documentNumber).toBeDefined();
  });

  test('pun broj kartice (16 cifara) je greška — čuvaju se samo poslednje 4', () => {
    const errors = validateManualEntry({
      ...VALID_INPUT,
      type: 'platna_kartica',
      documentNumber: '4111111111111111',
    });
    expect(errors.documentNumber).toBeDefined();
  });

  test('4 cifre ali sa slovom je greška', () => {
    const errors = validateManualEntry({
      ...VALID_INPUT,
      type: 'platna_kartica',
      documentNumber: '12a4',
    });
    expect(errors.documentNumber).toBeDefined();
  });

  test('4 cifre nije ograničenje za druge tipove dokumenata', () => {
    const errors = validateManualEntry({
      ...VALID_INPUT,
      type: 'pasos',
      documentNumber: '001234567',
    });
    expect(errors.documentNumber).toBeUndefined();
  });
});

describe('buildDocumentData', () => {
  test('mapira validan unos u DocumentData sa ISO datumima', () => {
    const data = buildDocumentData(VALID_INPUT);
    expect(data.type).toBe('vozacka');
    expect(data.documentNumber).toBe('123456789');
    expect(data.firstName).toBe('MARKO');
    expect(data.lastName).toBe('PETROVIĆ');
    expect(data.nationality).toBeUndefined();
    expect(data.expiryDate).toBe('2029-01-01T00:00:00.000Z');
  });

  test('trimuje razmake iz tekstualnih polja', () => {
    const data = buildDocumentData({
      ...VALID_INPUT,
      documentNumber: '  123  ',
      firstName: ' MARKO ',
      lastName: ' PETROVIĆ ',
      nationality: ' SRB ',
    });
    expect(data.documentNumber).toBe('123');
    expect(data.firstName).toBe('MARKO');
    expect(data.lastName).toBe('PETROVIĆ');
    expect(data.nationality).toBe('SRB');
  });

  test('prazan nationality string postaje undefined', () => {
    const data = buildDocumentData({ ...VALID_INPUT, nationality: '   ' });
    expect(data.nationality).toBeUndefined();
  });
});
