import React from 'react';
import { colors } from '../theme';

// Shared "card" look for the mobile-web list views — mirrors the native
// app's FlatList card style so the dashboard doesn't fall back to a
// desktop table squeezed into a phone screen.
export const cardStyles: Record<string, React.CSSProperties> = {
  list: { display: 'flex', flexDirection: 'column', gap: 10 },
  card: {
    background: colors.surface,
    border: `1px solid ${colors.border}`,
    borderRadius: 16,
    padding: 16,
  },
  row: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 6 },
  title: { fontSize: 16, fontWeight: 700, color: colors.textPrimary, flex: 1 },
  detail: { color: colors.textSecondary, fontSize: 13, marginTop: 3 },
  amount: { color: '#22C55E', fontSize: 14, fontWeight: 700, marginTop: 4 },
  meta: { color: colors.textMuted, fontSize: 11, marginTop: 6 },
  empty: { textAlign: 'center', padding: '48px 16px', color: colors.textSecondary },
  badge: {
    marginTop: 10, padding: 10, borderRadius: 10, textAlign: 'center',
    fontSize: 13, fontWeight: 600,
  },
};
