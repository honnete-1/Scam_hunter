import type { TextStyle } from 'react-native';

// Same type pairing as the web app: Space Grotesk for headings, Manrope for everything else.
export const fonts = {
  heading: 'SpaceGrotesk_700Bold',
  headingMedium: 'SpaceGrotesk_600SemiBold',
  body: 'Manrope_400Regular',
  bodyMedium: 'Manrope_500Medium',
  bodySemiBold: 'Manrope_600SemiBold',
  bodyBold: 'Manrope_700Bold',
};

export type TextVariant =
  | 'hero'
  | 'title'
  | 'section'
  | 'cardTitle'
  | 'body'
  | 'bodyStrong'
  | 'small'
  | 'label'
  | 'button';

export const textVariants: Record<TextVariant, TextStyle> = {
  hero: { fontFamily: fonts.heading, fontSize: 34, lineHeight: 38, letterSpacing: -0.8 },
  title: { fontFamily: fonts.heading, fontSize: 28, lineHeight: 33, letterSpacing: -0.5 },
  section: { fontFamily: fonts.headingMedium, fontSize: 20, lineHeight: 26, letterSpacing: -0.2 },
  cardTitle: { fontFamily: fonts.bodySemiBold, fontSize: 17, lineHeight: 23 },
  body: { fontFamily: fonts.body, fontSize: 16, lineHeight: 24 },
  bodyStrong: { fontFamily: fonts.bodySemiBold, fontSize: 16, lineHeight: 24 },
  small: { fontFamily: fonts.body, fontSize: 13, lineHeight: 19 },
  label: { fontFamily: fonts.bodyBold, fontSize: 12, lineHeight: 16, letterSpacing: 1, textTransform: 'uppercase' },
  button: { fontFamily: fonts.bodyBold, fontSize: 16, lineHeight: 20 },
};
