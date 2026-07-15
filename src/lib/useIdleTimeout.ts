import { useCallback, useEffect, useRef } from 'react';
import { AppState, Platform } from 'react-native';
import { supabase } from './supabase';
import { alert } from './alert';
import { HEARTBEAT_INTERVAL_MS } from './onlineStatus';

// If a shop/driver leaves the app open (browser tab or phone screen) without
// touching it, they'd otherwise stay "online"/"open" forever from the
// owner's point of view. After a long period of no interaction, warn once
// and then sign out — which already flips online_status to false via the
// SIGNED_OUT handler in AppNavigator.
const WARNING_AFTER_MS = 25 * 60 * 1000;
const SIGNOUT_AFTER_MS = 30 * 60 * 1000;
const CHECK_INTERVAL_MS = 15 * 1000;

export function useIdleTimeout(enabled: boolean, userId: string | null) {
  const lastActivityRef = useRef(Date.now());
  const warnedRef = useRef(false);

  const resetActivity = useCallback(() => {
    lastActivityRef.current = Date.now();
    warnedRef.current = false;
  }, []);

  useEffect(() => {
    if (!enabled) return;
    resetActivity();

    const interval = setInterval(() => {
      const idleMs = Date.now() - lastActivityRef.current;
      if (idleMs >= SIGNOUT_AFTER_MS) {
        supabase.auth.signOut();
      } else if (idleMs >= WARNING_AFTER_MS && !warnedRef.current) {
        warnedRef.current = true;
        alert(
          'Είσαι ακόμα εκεί;',
          'Δεν εντοπίστηκε δραστηριότητα. Θα αποσυνδεθείς αυτόματα σε 5 λεπτά αν δεν κάνεις κάτι στην εφαρμογή.'
        );
      }
    }, CHECK_INTERVAL_MS);

    // Heartbeat: proves to other clients that this session is still alive,
    // even if it never sends a clean sign-out (crash, force-quit, dead
    // battery, lost connectivity all skip that). See src/lib/onlineStatus.ts.
    let heartbeat: ReturnType<typeof setInterval> | undefined;
    let appStateSub: { remove: () => void } | undefined;
    if (userId) {
      const beat = () => supabase.from('users').update({ last_seen_at: new Date().toISOString() }).eq('id', userId);
      beat();
      heartbeat = setInterval(beat, HEARTBEAT_INTERVAL_MS);

      // A locked screen or backgrounded app pauses this setInterval (both iOS
      // and Android throttle JS timers once the app isn't foregrounded), so
      // last_seen_at goes stale and the driver flickers to "offline" for the
      // owner even though they never went off shift. Merely bringing the app
      // back to foreground does NOT resume/catch-up the paused interval on
      // its own — only a full app restart did, which is why re-toggling shift
      // was the only thing that visibly fixed it. Sending a beat the instant
      // the app becomes active again closes that gap without needing that.
      if (Platform.OS !== 'web') {
        appStateSub = AppState.addEventListener('change', (state) => {
          if (state === 'active') beat();
        });
      }
    }

    let removeWebListeners: (() => void) | undefined;
    if (Platform.OS === 'web') {
      const events = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'];
      events.forEach((e) => window.addEventListener(e, resetActivity));
      removeWebListeners = () => events.forEach((e) => window.removeEventListener(e, resetActivity));
    }

    return () => {
      clearInterval(interval);
      if (heartbeat) clearInterval(heartbeat);
      appStateSub?.remove();
      removeWebListeners?.();
    };
  }, [enabled, userId, resetActivity]);

  return { resetActivity };
}
