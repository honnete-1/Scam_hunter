// Scam Hunter colours for both themes, matching the web app's design tokens.
export const brand = {
  lusterWhite: '#F4F1EC',
  asterBlue: '#9BACD8',
  deepSpaceRoyal: '#223382',
  deadlyDepths: '#111144',
  habanero: '#F98513',
  white: '#FFFFFF',
};

export type Palette = {
  background: string;
  surface: string;
  surfaceAlt: string;
  text: string;
  textMuted: string;
  border: string;
  borderStrong: string;
  primary: string;
  onPrimary: string;
  link: string;
  softBlue: string;
  blueTint: string;
  cta: string;
  ctaPressed: string;
  onCta: string;
  // Result colours are kept apart from the brand colours on purpose.
  status: Record<StatusTone, { text: string; background: string; border: string }>;
};

export type StatusTone = 'high' | 'caution' | 'clear' | 'unavailable';

export const lightPalette: Palette = {
  background: brand.lusterWhite,
  surface: brand.white,
  surfaceAlt: '#ECE8E1',
  text: brand.deadlyDepths,
  textMuted: '#4A4F72',
  border: 'rgba(17, 17, 68, 0.12)',
  borderStrong: 'rgba(17, 17, 68, 0.28)',
  primary: brand.deepSpaceRoyal,
  onPrimary: brand.white,
  link: brand.deepSpaceRoyal,
  softBlue: brand.asterBlue,
  blueTint: '#E3E8F5',
  cta: brand.habanero,
  ctaPressed: '#E57406',
  onCta: brand.deadlyDepths,
  status: {
    high: { text: '#B42318', background: '#FDECEA', border: '#F2B8B1' },
    caution: { text: '#8A5A00', background: '#FFF4D6', border: '#EFC357' },
    clear: { text: '#1B6E3F', background: '#E5F3EA', border: '#9FD3B2' },
    unavailable: { text: '#4B5578', background: '#ECEEF5', border: '#C5CBE0' },
  },
};

export const darkPalette: Palette = {
  background: '#0D0D2A',
  surface: '#19193A',
  surfaceAlt: '#23234D',
  text: brand.lusterWhite,
  textMuted: '#B6BDD7',
  border: 'rgba(155, 172, 216, 0.16)',
  borderStrong: 'rgba(155, 172, 216, 0.36)',
  primary: '#6F82D6',
  onPrimary: '#0D0D2A',
  link: brand.asterBlue,
  softBlue: brand.asterBlue,
  blueTint: '#23234D',
  cta: brand.habanero,
  ctaPressed: '#E57406',
  onCta: brand.deadlyDepths,
  status: {
    high: { text: '#FF9A8F', background: '#3A1724', border: '#7A2E3A' },
    caution: { text: '#FFD166', background: '#352B14', border: '#6E5718' },
    clear: { text: '#7EDFA4', background: '#15362A', border: '#2E6B4C' },
    unavailable: { text: '#C3C9E2', background: '#23234D', border: '#3E4373' },
  },
};
