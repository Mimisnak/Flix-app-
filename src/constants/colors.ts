// Shared color palette — used by both mobile (React Native) and web dashboard
export const Colors = {
  // Backgrounds
  bg:          '#0D0D0F',
  surface:     '#1A1A2E',
  surfaceAlt:  '#1A1A1F',
  card:        '#1A1A1F',

  // Borders
  border:      '#2A2A3E',
  borderAlt:   '#2A2A35',

  // Brand
  primary:     '#3A9EFB',
  primaryDark: '#1D6FB8',
  primaryGlow: 'rgba(58, 158, 251, 0.35)',

  // Text
  textPrimary:   '#FFFFFF',
  textSecondary: '#888899',
  textMuted:     '#555566',
  textPlaceholder: '#555566',

  // Status
  success:  '#22C55E',
  warning:  '#F59E0B',
  error:    '#EF4444',
  purple:   '#A78BFA',

  // Misc
  primaryHover: 'rgba(58, 158, 251, 0.15)',
} as const;

export type ColorKey = keyof typeof Colors;
