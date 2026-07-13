import { UserRole } from '../types';

/**
 * Owner/developer accounts don't have a shops/drivers profile row of their
 * own — but if they were promoted from an existing shop/driver account,
 * that old row can still be sitting there. Never show it for those roles,
 * always fall back straight to email so it can't look like a stale account.
 */
export function accountDisplayName(
  role: UserRole | null | undefined,
  shopName: string | null | undefined,
  driverName: string | null | undefined,
  email: string | null | undefined
): string {
  if (role === 'shop' && shopName) return shopName;
  if (role === 'driver' && driverName) return driverName;
  return email ?? 'Άγνωστος';
}
