import React, { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme';
import { NAV_BY_ROLE, WebScreen } from './Sidebar';

function NavIcon({ item, size, opacity }: { item: { icon: string; emoji?: boolean }; size: number; opacity: number }) {
  if (item.emoji) return <span style={{ fontSize: size, opacity }}>{item.icon}</span>;
  return <Ionicons name={item.icon as any} size={size} color={colors.textPrimary} style={{ opacity }} />;
}

export const MOBILE_TABBAR_HEIGHT = 60;
const VISIBLE_COUNT = 4;

interface Props {
  role: 'owner' | 'shop' | 'driver' | 'developer';
  activeScreen: WebScreen;
  onNavigate: (screen: WebScreen) => void;
}

// Phone-width equivalent of the desktop Sidebar — same nav items, rendered as
// a fixed bottom bar like the native app instead of a left sidebar, since a
// 240px sidebar has no room to breathe on a ~380px viewport. Extra items
// beyond the first 4 collapse into a "More" sheet, mirroring the native
// app's own tab-bar-plus-More pattern.
export default function MobileTabBar({ role, activeScreen, onNavigate }: Props) {
  const [moreOpen, setMoreOpen] = useState(false);
  const navItems = NAV_BY_ROLE[role];
  const visible = navItems.slice(0, VISIBLE_COUNT);
  const overflow = navItems.slice(VISIBLE_COUNT);
  const isOverflowActive = overflow.some((i) => i.screen === activeScreen);

  function select(screen: WebScreen) {
    setMoreOpen(false);
    onNavigate(screen);
  }

  return (
    <>
      <nav style={s.bar}>
        {visible.map((item) => {
          const isActive = activeScreen === item.screen;
          return (
            <button key={item.screen} onClick={() => select(item.screen as WebScreen)} style={s.tab}>
              <NavIcon item={item} size={22} opacity={isActive ? 1 : 0.55} />
            </button>
          );
        })}
        {overflow.length > 0 && (
          <button onClick={() => setMoreOpen(true)} style={s.tab}>
            <Ionicons name="menu-outline" size={22} color={colors.textPrimary} style={{ opacity: isOverflowActive || moreOpen ? 1 : 0.55 }} />
          </button>
        )}
      </nav>

      {moreOpen && (
        <div style={s.overlay} onClick={() => setMoreOpen(false)}>
          <div style={s.sheet} onClick={(e) => e.stopPropagation()}>
            <div style={s.sheetHandle} />
            {overflow.map((item) => (
              <button
                key={item.screen}
                onClick={() => select(item.screen as WebScreen)}
                style={{
                  ...s.sheetItem,
                  color: activeScreen === item.screen ? colors.primary : colors.textPrimary,
                  background: activeScreen === item.screen ? colors.primaryHover : 'transparent',
                }}
              >
                <span style={{ width: 26, textAlign: 'center' }}>
                  <NavIcon item={item} size={18} opacity={1} />
                </span>
                <span>{item.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

const s: Record<string, React.CSSProperties> = {
  bar: {
    position: 'fixed',
    bottom: 0,
    left: 0,
    right: 0,
    height: MOBILE_TABBAR_HEIGHT,
    background: colors.surface,
    borderTop: `1px solid ${colors.border}`,
    display: 'flex',
    zIndex: 200,
  },
  tab: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
  },
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.5)',
    zIndex: 300,
    display: 'flex',
    alignItems: 'flex-end',
  },
  sheet: {
    background: colors.surface,
    width: '100%',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: '8px 8px 24px',
    maxHeight: '70vh',
    overflowY: 'auto',
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    background: colors.border,
    margin: '8px auto 12px',
  },
  sheetItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 14,
    width: '100%',
    padding: '14px 16px',
    border: 'none',
    borderRadius: 10,
    fontSize: 15,
    fontWeight: 600,
    textAlign: 'left',
    cursor: 'pointer',
    marginBottom: 4,
  },
};
