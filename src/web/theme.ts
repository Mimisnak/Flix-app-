// Brand colors — single source of truth for the web dashboard
// Imports from shared constants so mobile and web stay in sync
import { Colors } from '../constants/colors';

export const colors = {
  bg:            Colors.bg,
  surface:       Colors.surface,
  border:        Colors.border,
  primary:       Colors.primary,
  primaryDark:   Colors.primaryDark,
  primaryHover:  Colors.primaryHover,
  primaryGlow:   Colors.primaryGlow,
  textPrimary:   Colors.textPrimary,
  textSecondary: Colors.textSecondary,
  textMuted:     Colors.textMuted,
  error:         Colors.error,
  success:       Colors.success,
  warning:       Colors.warning,
} as const;

export const SIDEBAR_WIDTH = 240;
export const TOPBAR_HEIGHT = 56;
