import React from 'react';
import { colors, SIDEBAR_WIDTH, TOPBAR_HEIGHT } from '../theme';
import { WebScreen } from './Sidebar';

const SCREEN_TITLES: Record<WebScreen, string> = {
  'live-orders': 'Live Orders',
  'map': 'Χάρτης',
  'approvals': 'Εγκρίσεις Χρηστών',
  'directory': 'Κατάλογος',
  'owner-new-order': 'Νέα Παραγγελία',
  'stats': 'Στατιστικά',
  'history': 'Ιστορικό',
  'new-order': 'Νέα Παραγγελία',
  'orders': 'Ενεργές Παραγγελίες',
  'subscription': 'Συνδρομή',
  'available-orders': 'Διαθέσιμες Παραγγελίες',
  'my-orders': 'Οι Παραγγελίες μου',
  'driver-history': 'Ιστορικό 24 Ωρών',
  'support': 'Υποστήριξη',
  'dev-inbox': 'Υποστήριξη — Εισερχόμενα',
  'dev-accounts': 'Λογαριασμοί',
  'profile': 'Προφίλ',
  'help': 'Οδηγός Χρήσης',
};

interface Props {
  activeScreen: WebScreen;
  isMobile?: boolean;
}

export default function TopBar({ activeScreen, isMobile }: Props) {
  const left = isMobile ? 0 : SIDEBAR_WIDTH;
  return (
    <div style={{ ...s.bar, left, width: `calc(100% - ${left}px)`, height: TOPBAR_HEIGHT }}>
      <span style={s.title}>{SCREEN_TITLES[activeScreen]}</span>
      <span style={s.betaBadge} title="Αν αντιμετωπίσεις πρόβλημα, ανέφερέ το στην Υποστήριξη">BETA</span>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  bar: {
    position: 'fixed',
    top: 0,
    background: colors.surface,
    borderBottom: `1px solid ${colors.border}`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 24px',
    zIndex: 100,
  },
  title: {
    color: colors.textPrimary,
    fontSize: 17,
    fontWeight: 600,
  },
  betaBadge: {
    background: 'rgba(245, 158, 11, 0.15)',
    border: '1px solid #F59E0B',
    color: '#F59E0B',
    borderRadius: 8,
    padding: '3px 8px',
    fontSize: 10,
    fontWeight: 800,
    letterSpacing: '0.5px',
    cursor: 'default',
  },
};
