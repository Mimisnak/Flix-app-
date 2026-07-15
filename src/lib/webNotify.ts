/**
 * Browser notification + sound alert for the web dashboard.
 *
 * Mobile push (expo-notifications) only reaches the native apps — the web
 * dashboard had no equivalent at all, so shop/driver users with the tab
 * open got no signal when a new order came in or one of theirs changed
 * status. This covers the foreground case (tab open, even unfocused):
 * a short beep + a native browser Notification when permission is granted.
 *
 * It does NOT cover a fully closed tab/browser — that needs a service
 * worker + push subscription (VAPID) wired to a backend, which is a
 * separate, bigger piece of infra than this.
 */

let audioCtx: AudioContext | null = null;

export function requestWebNotificationPermission(): void {
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  if (Notification.permission === 'default') {
    Notification.requestPermission().catch(() => {});
  }
}

// Two quick tones (a "ding-dong") at a higher gain than a single soft beep —
// louder and harder to miss, since the admin may have this tab in the
// background with several others open.
function playBeep(): void {
  try {
    const Ctx = window.AudioContext || (window as any).webkitAudioContext;
    if (!Ctx) return;
    if (!audioCtx) audioCtx = new Ctx();
    const ctx = audioCtx;
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});

    const tone = (freq: number, startAt: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, startAt);
      gain.gain.exponentialRampToValueAtTime(0.6, startAt + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, startAt + 0.35);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(startAt);
      osc.stop(startAt + 0.35);
    };

    tone(880, ctx.currentTime);
    tone(1046.5, ctx.currentTime + 0.18);
  } catch (_) {
    // Autoplay/audio restrictions vary by browser — never block the caller.
  }
}

export function notifyWeb(title: string, body: string): void {
  if (typeof window === 'undefined') return;

  playBeep();

  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try { navigator.vibrate(200); } catch (_) {}
  }

  if ('Notification' in window && Notification.permission === 'granted') {
    try { new Notification(title, { body }); } catch (_) {}
  }
}
