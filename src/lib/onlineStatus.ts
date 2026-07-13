// A shop/driver's online_status flag only ever gets flipped back to false
// by a clean sign-out or app-background event. If the process dies without
// one (crash, force-quit, dead battery, lost connectivity), online_status
// stays stuck at true forever. Clients send a heartbeat (last_seen_at =
// now()) every HEARTBEAT_INTERVAL_MS while online; anything staler than
// STALE_AFTER_MS is treated as offline regardless of the raw flag.
export const HEARTBEAT_INTERVAL_MS = 60 * 1000;
const STALE_AFTER_MS = 2 * 60 * 1000;

export function isReallyOnline(onlineStatus: boolean, lastSeenAt: string | null): boolean {
  if (!onlineStatus || !lastSeenAt) return false;
  return Date.now() - new Date(lastSeenAt).getTime() < STALE_AFTER_MS;
}

export function staleCutoffIso(): string {
  return new Date(Date.now() - STALE_AFTER_MS).toISOString();
}
