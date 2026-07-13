import React from 'react';
import { colors } from '../theme';
import { HELP_CONTENT } from '../../lib/helpContent';

interface Props {
  role: 'owner' | 'shop' | 'driver' | 'developer';
}

export default function HelpWeb({ role }: Props) {
  const content = HELP_CONTENT[role];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 720 }}>
      <h2 style={s.title}>📖 {content?.title ?? 'Οδηγός Χρήσης'}</h2>

      {content?.sections.map(section => (
        <div key={section.title} style={s.section}>
          <h3 style={s.sectionTitle}>{section.title}</h3>
          <ul style={s.list}>
            {section.items.map((item, i) => (
              <li key={i} style={s.item}>{item}</li>
            ))}
          </ul>
        </div>
      ))}

      <div style={s.footer}>
        <p style={s.footerThanks}>Ευχαριστούμε που χρησιμοποιείς τις υπηρεσίες της Flix!</p>
        <a href="https://mimis.dev/" target="_blank" rel="noopener noreferrer" style={s.footerCredit}>
          Created by mimis.dev — for ideas &amp; projects
        </a>
      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  title: { color: colors.textPrimary, fontSize: 20, fontWeight: 700, margin: 0 },
  section: {
    background: colors.surface, border: `1px solid ${colors.border}`,
    borderRadius: 14, padding: 18,
  },
  sectionTitle: { color: colors.textPrimary, fontSize: 15, fontWeight: 700, margin: '0 0 10px' },
  list: { margin: 0, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 8 },
  item: { color: colors.textSecondary, fontSize: 14, lineHeight: 1.5 },
  footer: { textAlign: 'center', marginTop: 12, paddingBottom: 24 },
  footerThanks: { color: colors.textSecondary, fontSize: 13, margin: '0 0 6px' },
  footerCredit: { color: colors.textMuted, fontSize: 11, textDecoration: 'none' },
};
