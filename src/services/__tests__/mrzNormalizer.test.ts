import { parse as parseMrz } from 'mrz';
import { normalizeMrzLines } from '../mrzNormalizer';

/**
 * Fiksni čisti primeri (TD3 iz ICAO 9303 Part 4, Appendix A referentnog
 * primera; TD1 ručno sastavljen po istom principu kao tools/mrz-generator,
 * check-digitovi izračunati ICAO 7-3-1 algoritmom). Testovi "prljave"
 * varijante ovih linija namerno kvare tačno one karaktere koje bi trebalo
 * da normalizator vrati u izvorno stanje — pa poređenje sa čistim originalom
 * dokazuje da normalizacija ne menja ništa osim onoga što je OCR pokvario.
 */
const TD3_CLEAN = [
  'P<AUTPETROVIC<<MARIJA<<<<<<<<<<<<<<<<<<<<<<<',
  'BVWED6H5A9AUT9406085F2912268<<<<<<<<<<<<<<02',
];

const TD1_CLEAN = [
  'I<SRBAB12345671<<<<<<<<<<<<<<<',
  '9005123F3109306SRB<<<<<<<<<<<0',
  'MARKOVIC<<KATARINA<<<<<<<<<<<<',
];

describe('normalizeMrzLines — K→< zamena', () => {
  it('"BORIS<KK<K<" — mešoviti filler niz i usamljena K posle imena se ispravljaju', () => {
    const line = 'P<XXXBORIS<KK<K<' + '<'.repeat(28);
    const result = normalizeMrzLines([line, TD3_CLEAN[1]!], 'TD3');
    expect(result.lines[0]).toBe('P<XXXBORIS<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<');
  });

  it('"BORISKKKKKK" — ceo filler niz pročitan kao K se ispravlja', () => {
    const line = 'P<XXXBORISKKKKKK' + '<'.repeat(28);
    const result = normalizeMrzLines([line, TD3_CLEAN[1]!], 'TD3');
    expect(result.lines[0]).toBe('P<XXXBORIS<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<');
  });

  it('ime koje stvarno sadrži K između dva slova (MARKO) ostaje netaknuto', () => {
    const line = 'P<XXXMARKO<<' + '<'.repeat(32);
    const result = normalizeMrzLines([line, TD3_CLEAN[1]!], 'TD3');
    expect(result.lines[0]).toContain('MARKO');
    expect(result.lines[0]).not.toContain('MAR<O');
  });

  it('ime koje stvarno sadrži K odmah uz separator "<<" (KATARINA) ostaje netaknuto', () => {
    // K je prvo slovo imena, odmah posle "<<" separatora — ambiguous pozicija
    // koju normalizator namerno NE dira jer joj je sused stvarno slovo (A).
    const result = normalizeMrzLines(TD1_CLEAN, 'TD1');
    expect(result.lines[2]).toBe(TD1_CLEAN[2]);
    expect(result.changes).toHaveLength(0);
  });
});

describe('normalizeMrzLines — normalizacija dužine', () => {
  it('prekratku liniju dopunjuje sa < do tačne dužine (TD3=44)', () => {
    const short = TD3_CLEAN[0]!.slice(0, -5);
    const result = normalizeMrzLines([short, TD3_CLEAN[1]!], 'TD3');
    expect(result.lines[0]).toHaveLength(44);
    expect(result.lines[0]).toBe(TD3_CLEAN[0]);
    expect(result.changes).toContainEqual({ lineIndex: 0, kind: 'linija-dopunjena', count: 5 });
  });

  it('predugačku liniju skraćuje na tačnu dužinu (TD3=44)', () => {
    const long = TD3_CLEAN[1] + 'XYZ';
    const result = normalizeMrzLines([TD3_CLEAN[0]!, long], 'TD3');
    expect(result.lines[1]).toHaveLength(44);
    expect(result.lines[1]).toBe(TD3_CLEAN[1]);
    expect(result.changes).toContainEqual({ lineIndex: 1, kind: 'linija-skracena', count: 3 });
  });

  it('TD1 liniju dopunjuje na tačnu dužinu (30)', () => {
    const short = TD1_CLEAN[0]!.slice(0, -3);
    const result = normalizeMrzLines([short, TD1_CLEAN[1]!, TD1_CLEAN[2]!], 'TD1');
    expect(result.lines[0]).toHaveLength(30);
    expect(result.lines[0]).toBe(TD1_CLEAN[0]);
  });
});

describe('normalizeMrzLines — tip dokumenta', () => {
  it('pogađa TD3 po broju linija (2) kad tip nije prosleđen', () => {
    const result = normalizeMrzLines([TD3_CLEAN[0]!, TD3_CLEAN[1]!]);
    expect(result.type).toBe('TD3');
  });

  it('pogađa TD1 po broju linija (3) kad tip nije prosleđen', () => {
    const result = normalizeMrzLines([TD1_CLEAN[0]!, TD1_CLEAN[1]!, TD1_CLEAN[2]!]);
    expect(result.type).toBe('TD1');
  });

  it('baca grešku za neočekivan broj linija bez eksplicitnog tipa', () => {
    expect(() => normalizeMrzLines(['samo jedna linija'])).toThrow();
  });
});

describe('normalizeMrzLines — kompletan prljav end-to-end primer (TD3)', () => {
  it('posle normalizacije, mrz paket parsira zapis kao validan', () => {
    // Prljava linija 1: razmak ubačen unutar reda, deo trailing filler niza
    // MARIJA<<<<<<<<<<<<<<<<<<<<<< pročitan kao mešavina K i < (izmereno
    // OCR ponašanje — K uz K formira niz, usamljeno K uz < je filler).
    const dirtyLine1 = 'P<AUTPETROVIC<<MARIJA<' + 'K< KKKKKK<<<<<<<<<<<<<<';
    // Prljava linija 2: lični broj (14 filler karaktera) delimično pročitan
    // kao K, plus 3 suvišna karaktera na kraju (OCR artefakt/duplirano
    // očitavanje) koja normalizacija dužine odseca.
    const dirtyLine2 = 'BVWED6H5A9AUT9406085F2912268' + 'KK<KK<KKKKKK<<' + '02' + 'XYZ';

    const result = normalizeMrzLines([dirtyLine1, dirtyLine2], 'TD3');

    expect(result.lines).toEqual(TD3_CLEAN);
    expect(result.totalChanges).toBeGreaterThan(0);

    const parsed = parseMrz(result.lines);
    expect(parsed.valid).toBe(true);
  });
});

describe('normalizeMrzLines — kompletan prljav end-to-end primer (TD1)', () => {
  it('posle normalizacije, mrz paket parsira zapis kao validan', () => {
    // Linija 1: razmak ubačen, pa linija skraćena za 3 (simulira nepotpuno
    // OCR očitavanje) — dopunjavanje mora vratiti tačnu dužinu.
    const dirtyLine1 = ('I<SRB AB12345671<<<<<<<<<<<<<<<').slice(0, -3);
    // Linija 2: deo trailing filler niza (posle SRB) pročitan kao mešavina
    // K i <; prvi karakter posle SRB namerno ostaje čist < (OCR greške su
    // sporadične, ne pogađaju svaki filler karakter).
    const dirtyLine2 = '9005123F3109306SRB' + '<KK<K<<<<<<0';
    // Linija 3: prezime MARKOVIC (K između dva slova) i ime KATARINA (K uz
    // separator "<<") moraju ostati netaknuti; trailing filler posle imena
    // je delimično pročitan kao K, plus 2 suvišna karaktera za odsecanje.
    const dirtyLine3 = 'MARKOVIC<<KATARINA' + '<KK<K<<<<<<<' + 'ZZ';

    const result = normalizeMrzLines([dirtyLine1, dirtyLine2, dirtyLine3], 'TD1');

    expect(result.lines).toEqual(TD1_CLEAN);
    expect(result.totalChanges).toBeGreaterThan(0);

    const parsed = parseMrz(result.lines);
    expect(parsed.valid).toBe(true);
  });
});
