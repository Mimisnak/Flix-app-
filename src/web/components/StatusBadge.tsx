import React from 'react';
import { colors } from '../theme';

const CONFIG: Record<string, { bg: string; color: string; label: string }> = {
  pending:   { bg: 'rgba(245,158,11,0.15)', color: '#F59E0B', label: 'Αναμονή' },
  assigned:  { bg: 'rgba(58,158,251,0.15)', color: colors.primary, label: 'Διαδρομή' },
  delivered: { bg: 'rgba(34,197,94,0.15)',  color: '#22C55E', label: 'Παραδόθηκε' },
  cancelled: { bg: 'rgba(239,68,68,0.15)',  color: '#EF4444', label: 'Ακυρώθηκε' },
};

export default function StatusBadge({ status }: { status: string }) {
  const c = CONFIG[status] ?? { bg: colors.border, color: colors.textPrimary, label: status };
  return (
    <span style={{
      background: c.bg,
      color: c.color,
      padding: '3px 10px',
      borderRadius: 20,
      fontSize: 12,
      fontWeight: 600,
      whiteSpace: 'nowrap',
      display: 'inline-block',
    }}>
      {c.label}
    </span>
  );
}
