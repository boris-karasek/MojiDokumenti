/**
 * theme.ts — jedini izvor boja, razmaka i tipografije u aplikaciji.
 *
 * Pravilo: nijedan ekran ne piše heks vrednost direktno u `StyleSheet.create`,
 * nego uvozi token odavde. Razlog je konkretan — pre uvođenja ovog fajla su
 * dva dugmeta sa istom ulogom u istom ekranu (ScanScreen) imala dve različite
 * plave, jer se boja birala na mestu upotrebe.
 *
 * Tokeni su imenovani po ULOZI (`primary`, `danger`, `surface`), ne po izgledu
 * (`plava`, `crvena`) — time promena palete ostaje izmena vrednosti u ovom
 * fajlu, bez diranja ekrana.
 *
 * Tema je JEDNA (svetla). Dark mode je svesno izostavljen: React Native
 * evaluira `StyleSheet.create` na nivou modula samo jednom, pa bi dve teme
 * značile prelazak svih ekrana na `useTheme()` + `useMemo` — trošak bez
 * pokrića za obim ovog rada. Ako zatreba kasnije, menja se način potrošnje
 * tokena, ne sami tokeni.
 *
 * Paleta: https://coolors.co/e0e0e2-81d2c7-b5bad0-7389ae-416788
 */

// ------------------------------------------------------------------ paleta

/**
 * Sirove vrednosti. Ekrani NE uvoze `palette` direktno — samo `theme` ispod.
 * Ovaj objekat postoji da bi se ista nijansa mogla dodeliti na više uloga bez
 * prekucavanja heksa.
 */
const palette = {
  // Brend paleta
  alabasterGrey: '#E0E0E2',
  pearlAqua: '#81D2C7',
  paleSlate: '#B5BAD0',
  glaucous: '#7389AE',
  balticBlue: '#416788',

  // Neutralne — paleta ih ne pokriva, a trebaju za tekst i površine
  white: '#FFFFFF',
  ink: '#1B2733',
  slateDark: '#2C3E50',

  /**
   * Semantičke boje za statuse. Namerno IZVAN brend palete: aplikacija u srži
   * prikazuje hitnost isteka (istekao / ističe uskoro / važeći), a to je
   * signal koji korisnik čita bojom pre nego tekstom. Plavo-aqua paleta nema
   * crvenu ni žutu, pa bi se statusi razlikovali samo nijansama plave — loše
   * za podatak koji je nosilac cele aplikacije.
   *
   * `*Soft` varijante su pozadine badge-a; tamne su tekst na njima.
   */
  danger: '#A33B2E',
  dangerSoft: '#F6E2DF',
  warning: '#B4701F',
  warningSoft: '#FAEEDC',
  success: '#2E7D5B',
  successSoft: '#DFEFE7',
} as const;

// ------------------------------------------------------------------- oblik

/**
 * Eksplicitan tip umesto `typeof lightTheme` sa `as const`: `as const` bi
 * svaku boju sveo na literal (`'#416788'` umesto `string`), pa bi svaka
 * kasnija promena vrednosti obarala tipove. `satisfies` ispod proverava da
 * objekat ima tačno ova polja, bez sužavanja u literale.
 */
export interface ThemeColors {
  // Brend i akcije
  primary: string;
  primaryDark: string;
  secondary: string;
  accent: string;

  // Površine
  background: string;
  surface: string;
  surfaceVariant: string;

  gradientStart: string;
  gradientEnd: string;

  // Tekst
  text: string;
  textSecondary: string;
  textMuted: string;
  textInverse: string;
  placeholder: string;

  // Linije i stanja
  border: string;
  divider: string;
  disabled: string;
  overlay: string;

  // Statusi isteka dokumenta (v. documentStatus.ts) i greške
  danger: string;
  dangerSoft: string;
  warning: string;
  warningSoft: string;
  success: string;
  successSoft: string;

  /**
   * Kamera i debug panel u ScanScreen-u su namerno tamni bez obzira na temu —
   * preview kamere traži tamnu podlogu, a debug panel je razvojni alat koji
   * treba da se vizuelno razlikuje od ostatka aplikacije.
   */
  cameraBackground: string;
  cameraSurface: string;
  cameraText: string;
  cameraTextMuted: string;
}

export interface Theme {
  colors: ThemeColors;
}

// -------------------------------------------------------------------- tema

export const theme = {
  colors: {
    primary: palette.balticBlue,
    primaryDark: palette.ink,
    secondary: palette.glaucous,
    accent: palette.pearlAqua,

    background: palette.alabasterGrey,
    surface: palette.white,
    surfaceVariant: palette.paleSlate,

    gradientStart: palette.pearlAqua,
    gradientEnd: '#000000',

    text: palette.ink,
    textSecondary: palette.balticBlue,
    textMuted: palette.glaucous,
    textInverse: palette.white,
    placeholder: palette.glaucous,

    border: palette.paleSlate,
    divider: palette.paleSlate,
    disabled: palette.paleSlate,
    overlay: 'rgba(27, 39, 51, 0.5)',

    danger: palette.danger,
    dangerSoft: palette.dangerSoft,
    warning: palette.warning,
    warningSoft: palette.warningSoft,
    success: palette.success,
    successSoft: palette.successSoft,

    cameraBackground: '#000000',
    cameraSurface: palette.slateDark,
    cameraText: palette.white,
    cameraTextMuted: palette.alabasterGrey,
  },
} satisfies Theme;

// ------------------------------------------------------- razmaci i veličine

/** Skala razmaka (padding, margin, gap). Sve vrednosti su umnošci 4. */
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

/** Zaobljenje uglova. `pill` za badge-ove statusa. */
export const radius = {
  sm: 6,
  md: 10,
  lg: 12,
  pill: 999,
} as const;

/** Veličine fonta. */
export const fontSize = {
  xs: 12,
  sm: 13,
  md: 14,
  lg: 16,
  xl: 18,
  xxl: 22,
} as const;

/**
 * Debljine fonta. Tip je namerno sužen na literale koje RN prihvata —
 * `fontWeight: string` ne prolazi kroz `TextStyle` u strict modu.
 */
export const fontWeight = {
  regular: '400',
  medium: '600',
  bold: '700',
} as const;

export default theme;
