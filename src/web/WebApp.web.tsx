import React, { useEffect, useRef, useState } from 'react';
// @ts-ignore
import './global.css';
import { supabase } from '../lib/supabase';
import { requestWebNotificationPermission } from '../lib/webNotify';
import { colors, SIDEBAR_WIDTH, TOPBAR_HEIGHT } from './theme';
import { useIsMobile } from './hooks/useIsMobile';
import Sidebar, { WebScreen } from './components/Sidebar';
import MobileTabBar, { MOBILE_TABBAR_HEIGHT } from './components/MobileTabBar';
import TopBar from './components/TopBar';
// Shared
import ProfileWeb from './screens/ProfileWeb';
import SupportChatWeb from './screens/SupportChatWeb';
import HelpWeb from './screens/HelpWeb';
// Owner
import LiveOrdersWeb from './screens/owner/LiveOrdersWeb';
import MapWeb from './screens/owner/MapWeb';
import StatsWeb from './screens/owner/StatsWeb';
import HistoryWeb from './screens/owner/HistoryWeb';
import ApprovalsWeb from './screens/owner/ApprovalsWeb';
import DirectoryWeb from './screens/owner/DirectoryWeb';
import OwnerSubscriptionWeb from './screens/owner/SubscriptionWeb';
import OwnerNewOrderWeb from './screens/owner/OwnerNewOrderWeb';
// Shop
import NewOrderWeb from './screens/shop/NewOrderWeb';
import ShopOrdersWeb from './screens/shop/ShopOrdersWeb';
import ShopHistoryWeb from './screens/shop/ShopHistoryWeb';
import ShopSubscriptionWeb from './screens/shop/SubscriptionWeb';
// Driver
import AvailableOrdersWeb from './screens/driver/AvailableOrdersWeb';
import MyOrdersWeb from './screens/driver/MyOrdersWeb';
import DriverHistoryWeb from './screens/driver/DriverHistoryWeb';
// Developer
import SupportInboxWeb from './screens/developer/SupportInboxWeb';
import AccountsWeb from './screens/developer/AccountsWeb';

type Role = 'owner' | 'shop' | 'driver' | 'developer';

interface Props {
  role: Role;
}

const DEFAULT_SCREEN: Record<Role, WebScreen> = {
  owner: 'live-orders',
  shop: 'new-order',
  driver: 'available-orders',
  developer: 'dev-inbox',
};

function renderScreen(screen: WebScreen, role: Role) {
  if (screen === 'profile') return <ProfileWeb role={role} />;
  if (screen === 'help') return <HelpWeb role={role} />;
  if (screen === 'support' && role !== 'developer') return <SupportChatWeb />;

  if (role === 'owner') {
    if (screen === 'live-orders') return <LiveOrdersWeb />;
    if (screen === 'map') return <MapWeb />;
    if (screen === 'stats') return <StatsWeb />;
    if (screen === 'history') return <HistoryWeb />;
    if (screen === 'approvals') return <ApprovalsWeb />;
    if (screen === 'directory') return <DirectoryWeb />;
    if (screen === 'subscription') return <OwnerSubscriptionWeb />;
    if (screen === 'owner-new-order') return <OwnerNewOrderWeb />;
  }
  if (role === 'shop') {
    if (screen === 'new-order') return <NewOrderWeb />;
    if (screen === 'orders') return <ShopOrdersWeb />;
    if (screen === 'map') return <MapWeb />;
    if (screen === 'history') return <ShopHistoryWeb />;
    if (screen === 'subscription') return <ShopSubscriptionWeb />;
  }
  if (role === 'driver') {
    if (screen === 'available-orders') return <AvailableOrdersWeb />;
    if (screen === 'my-orders') return <MyOrdersWeb />;
    if (screen === 'map') return <MapWeb />;
    if (screen === 'driver-history') return <DriverHistoryWeb />;
  }
  if (role === 'developer') {
    if (screen === 'dev-inbox') return <SupportInboxWeb />;
    if (screen === 'dev-accounts') return <AccountsWeb />;
    if (screen === 'live-orders') return <LiveOrdersWeb />;
    if (screen === 'stats') return <StatsWeb />;
    if (screen === 'history') return <HistoryWeb />;
  }
  return null;
}

export default function WebApp({ role }: Props) {
  const [activeScreen, setActiveScreen] = useState<WebScreen>(DEFAULT_SCREEN[role]);
  const userIdRef = useRef<string | null>(null);
  const isMobile = useIsMobile();

  // Fetch userId once on mount
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      userIdRef.current = user?.id ?? null;
    });
  }, []);

  // Ask for browser Notification permission once per dashboard session —
  // needed for the sound/notification alerts in Available Orders/Shop Orders.
  useEffect(() => {
    requestWebNotificationPermission();
  }, []);

  // Auto-offline when the tab actually closes/refreshes (drivers & shops
  // only). Deliberately NOT triggered by visibilitychange->hidden anymore —
  // that fired the instant the tab lost focus or the OS backgrounded the
  // browser (switching tabs, screen lock, a notification), flipping the
  // status to offline within seconds even though the driver/shop was still
  // genuinely working. The heartbeat + 2-minute staleness window
  // (src/lib/onlineStatus.ts) already handles "actually walked away"
  // gracefully without this false-positive flicker.
  useEffect(() => {
    if (role === 'owner' || role === 'developer') return;

    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

    // keepalive fetch works inside beforeunload unlike async supabase calls
    function setOfflineBeacon() {
      const uid = userIdRef.current;
      if (!uid) return;
      fetch(`${supabaseUrl}/rest/v1/users?id=eq.${uid}`, {
        method: 'PATCH',
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
          Prefer: 'return=minimal',
        },
        body: JSON.stringify({ online_status: false }),
        keepalive: true,
      });
    }

    const handleBeforeUnload = () => setOfflineBeacon();
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      setOfflineBeacon(); // also set offline on React unmount (e.g. sign-out)
    };
  }, [role]);

  return (
    <div style={s.root}>
      {!isMobile && <Sidebar role={role} activeScreen={activeScreen} onNavigate={setActiveScreen} />}

      <div style={{ ...s.main, marginLeft: isMobile ? 0 : SIDEBAR_WIDTH }}>
        <TopBar activeScreen={activeScreen} isMobile={isMobile} />

        <div
          style={{
            ...s.content,
            paddingTop: TOPBAR_HEIGHT,
            paddingBottom: isMobile ? MOBILE_TABBAR_HEIGHT + 16 : 24,
          }}
        >
          {renderScreen(activeScreen, role)}
        </div>
      </div>

      {isMobile && <MobileTabBar role={role} activeScreen={activeScreen} onNavigate={setActiveScreen} />}
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  root: {
    display: 'flex',
    width: '100vw',
    // dvh (not vh) — vh is computed as if the browser's address bar were
    // hidden, so on mobile the true visible area is smaller. Since the page
    // itself never scrolls (only the content div below does), the address
    // bar never auto-collapses to reveal that gap, permanently hiding
    // whatever's at the bottom of any content-heavy screen.
    height: '100dvh',
    background: colors.bg,
    fontFamily: '"Inter", "Segoe UI", sans-serif',
    overflow: 'hidden',
  },
  main: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    minHeight: 0,
  },
  content: {
    flex: 1,
    minHeight: 0,
    boxSizing: 'border-box',
    padding: 24,
    overflowY: 'auto',
    WebkitOverflowScrolling: 'touch',
  },
};
