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

function playBeep(): void {
  try {
    const Ctx = window.AudioContext || (window as any).webkitAudioContext;
    if (!Ctx) return;
    if (!audioCtx) audioCtx = new Ctx();
    const ctx = audioCtx;
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.3, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.5);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.5);
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
