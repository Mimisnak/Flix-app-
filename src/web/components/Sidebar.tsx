import React, { useState } from 'react';
import { colors, SIDEBAR_WIDTH } from '../theme';

export type OwnerScreen = 'live-orders' | 'map' | 'approvals' | 'directory' | 'subscription' | 'owner-new-order' | 'stats' | 'history' | 'support' | 'profile' | 'help';
export type ShopScreen = 'new-order' | 'orders' | 'map' | 'history' | 'subscription' | 'support' | 'profile' | 'help';
export type DriverScreen = 'available-orders' | 'my-orders' | 'map' | 'driver-history' | 'support' | 'profile' | 'help';
export type DeveloperScreen = 'dev-inbox' | 'dev-accounts' | 'live-orders' | 'stats' | 'history' | 'profile' | 'help';
export type WebScreen = OwnerScreen | ShopScreen | DriverScreen | DeveloperScreen;

const OWNER_NAV: { label: string; screen: OwnerScreen; icon: string }[] = [
  { label: 'Live Orders', screen: 'live-orders', icon: '📦' },
  { label: 'Χάρτης', screen: 'map', icon: '🗺️' },
  { label: 'Εγκρίσεις', screen: 'approvals', icon: '✅' },
  { label: 'Κατάλογος', screen: 'directory', icon: '📇' },
  { label: 'Συνδρομή', screen: 'subscription', icon: '💳' },
  { label: 'Νέα Παραγγελία', screen: 'owner-new-order', icon: '➕' },
  { label: 'Στατιστικά', screen: 'stats', icon: '📊' },
  { label: 'Ιστορικό', screen: 'history', icon: '🕑' },
  { label: 'Υποστήριξη', screen: 'support', icon: '🎧' },
  { label: 'Προφίλ', screen: 'profile', icon: '👤' },
  { label: 'Οδηγός Χρήσης', screen: 'help', icon: '📖' },
];

const SHOP_NAV: { label: string; screen: ShopScreen; icon: string }[] = [
  { label: 'Νέα Παραγγελία', screen: 'new-order', icon: '➕' },
  { label: 'Παραγγελίες', screen: 'orders', icon: '📋' },
  { label: 'Χάρτης', screen: 'map', icon: '🗺️' },
  { label: 'Ιστορικό', screen: 'history', icon: '🕑' },
  { label: 'Συνδρομή', screen: 'subscription', icon: '💳' },
  { label: 'Υποστήριξη', screen: 'support', icon: '🎧' },
  { label: 'Προφίλ', screen: 'profile', icon: '👤' },
  { label: 'Οδηγός Χρήσης', screen: 'help', icon: '📖' },
];

const DRIVER_NAV: { label: string; screen: DriverScreen; icon: string }[] = [
  { label: 'Διαθέσιμες', screen: 'available-orders', icon: '📦' },
  { label: 'Οι Παραγγελίες μου', screen: 'my-orders', icon: '🛵' },
  { label: 'Χάρτης', screen: 'map', icon: '🗺️' },
  { label: 'Ιστορικό', screen: 'driver-history', icon: '🕑' },
  { label: 'Υποστήριξη', screen: 'support', icon: '🎧' },
  { label: 'Προφίλ', screen: 'profile', icon: '👤' },
  { label: 'Οδηγός Χρήσης', screen: 'help', icon: '📖' },
];

const DEVELOPER_NAV: { label: string; screen: DeveloperScreen; icon: string }[] = [
  { label: 'Υποστήριξη', screen: 'dev-inbox', icon: '🎧' },
  { label: 'Λογαριασμοί', screen: 'dev-accounts', icon: '🗂️' },
  { label: 'Live Orders', screen: 'live-orders', icon: '📦' },
  { label: 'Στατιστικά', screen: 'stats', icon: '📊' },
  { label: 'Ιστορικό', screen: 'history', icon: '🕑' },
  { label: 'Προφίλ', screen: 'profile', icon: '👤' },
  { label: 'Οδηγός Χρήσης', screen: 'help', icon: '📖' },
];

interface Props {
  role: 'owner' | 'shop' | 'driver' | 'developer';
  activeScreen: WebScreen;
  onNavigate: (screen: WebScreen) => void;
}

// Exported so MobileTabBar can reuse the exact same nav items on narrow
// viewports instead of squeezing this sidebar into a phone-width screen.
export const NAV_BY_ROLE = {
  owner: OWNER_NAV,
  shop: SHOP_NAV,
  driver: DRIVER_NAV,
  developer: DEVELOPER_NAV,
};

const DASHBOARD_LABEL = {
  owner: 'Owner Dashboard',
  shop: 'Shop Dashboard',
  driver: 'Driver Dashboard',
  developer: 'Developer Dashboard',
};

export default function Sidebar({ role, activeScreen, onNavigate }: Props) {
  const [hovered, setHovered] = useState<string | null>(null);
  const navItems = NAV_BY_ROLE[role];

  return (
    <div style={s.sidebar}>
      {/* Brand */}
      <div style={s.brand}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <span style={s.brandTitle}>Flixfix</span>
          <span style={s.brandCredit}>by mimis.dev</span>
        </div>
        <span style={s.brandSub}>{DASHBOARD_LABEL[role]}</span>
      </div>

      {/* Nav */}
      <nav style={s.nav}>
        {navItems.map((item) => {
          const isActive = activeScreen === item.screen;
          const isHovered = hovered === item.screen;
          return (
            <button
              key={item.screen}
              onClick={() => onNavigate(item.screen as WebScreen)}
              onMouseEnter={() => setHovered(item.screen)}
              onMouseLeave={() => setHovered(null)}
              style={{
                ...s.navItem,
                background: isActive
                  ? colors.primaryHover
                  : isHovered ? 'rgba(255,255,255,0.05)' : 'transparent',
                color: isActive ? colors.primary : colors.textPrimary,
                borderLeft: isActive ? `3px solid ${colors.primary}` : '3px solid transparent',
              }}
            >
              <span style={s.icon}>{item.icon}</span>
              <span style={{ fontWeight: isActive ? 600 : 400 }}>{item.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  sidebar: {
    width: SIDEBAR_WIDTH,
    minWidth: SIDEBAR_WIDTH,
    height: '100vh',
    background: colors.surface,
    borderRight: `1px solid ${colors.border}`,
    display: 'flex',
    flexDirection: 'column',
    position: 'fixed',
    top: 0,
    left: 0,
  },
  brand: {
    padding: '20px 20px 16px',
    borderBottom: `1px solid ${colors.border}`,
    display: 'flex',
    flexDirection: 'column',
  },
  brandTitle: {
    color: colors.primary,
    fontSize: 22,
    fontWeight: 700,
    letterSpacing: '-0.5px',
  },
  brandCredit: {
    color: colors.textSecondary,
    fontSize: 10,
    fontWeight: 400,
  },
  brandSub: {
    color: colors.textSecondary,
    fontSize: 12,
    marginTop: 2,
  },
  nav: {
    display: 'flex',
    flexDirection: 'column',
    padding: '12px 8px',
    gap: 2,
  },
  navItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '10px 14px',
    borderRadius: 8,
    border: 'none',
    cursor: 'pointer',
    fontSize: 14,
    textAlign: 'left',
    transition: 'all 0.15s',
    width: '100%',
  },
  icon: { fontSize: 16, width: 20, textAlign: 'center' },
};
