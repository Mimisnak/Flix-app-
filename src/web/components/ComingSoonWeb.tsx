import React from 'react';
import { colors } from '../theme';

interface Props {
  icon: string;
  title: string;
  description: string;
}

export default function ComingSoonWeb({ icon, title, description }: Props) {
  return (
    <div style={s.container}>
      <div style={s.card}>
        <div style={s.icon}>{icon}</div>
        <div style={s.badge}>🚧 Σύντομα Διαθέσιμο</div>
        <h2 style={s.title}>{title}</h2>
        <p style={s.description}>{description}</p>
      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '60vh',
  },
  card: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    textAlign: 'center',
    background: colors.surface,
    border: `1px solid ${colors.border}`,
    borderRadius: 20,
    padding: '48px 40px',
    maxWidth: 420,
  },
  icon: {
    fontSize: 48,
    marginBottom: 16,
  },
  badge: {
    background: colors.primaryHover,
    border: `1px solid ${colors.primary}`,
    color: colors.primary,
    borderRadius: 20,
    padding: '6px 14px',
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: '0.03em',
    marginBottom: 20,
  },
  title: {
    color: colors.textPrimary,
    fontSize: 22,
    fontWeight: 700,
    margin: '0 0 12px',
  },
  description: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 1.6,
    margin: 0,
  },
};
