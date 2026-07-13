-- ============================================================
-- FLIXFIX — LAUNCH-DAY DATA WIPE (DESTRUCTIVE, IRREVERSIBLE)
-- ============================================================
-- Run this ONLY when you're fully done testing and ready to go live.
-- It deletes ALL orders/history/customers data, and ALL shop/driver
-- accounts — keeping ONLY accounts with role 'owner' or 'developer'.
--
-- It does NOT delete the underlying Supabase Auth accounts (auth.users)
-- for the removed shops/drivers — just their app-side profile rows. If
-- one of them logs in again afterwards, AppNavigator already handles a
-- missing profile row by silently signing them back out (see
-- fetchRoleAndNavigate in src/navigation/AppNavigator.tsx). If you also
-- want their raw login wiped, do that manually from Supabase Dashboard →
-- Authentication → Users, since that's a separate, more sensitive schema.
--
-- Go to: Supabase Dashboard -> SQL Editor -> New query, paste, RUN.
-- ============================================================

-- Order-related data (children first, FK-safe order)
DELETE FROM order_timeline;
DELETE FROM support_messages;
DELETE FROM orders;
DELETE FROM customers;

-- Shop/driver profile rows for every non-owner/developer account
DELETE FROM shops   WHERE id IN (SELECT id FROM users WHERE role NOT IN ('owner', 'developer'));
DELETE FROM drivers WHERE id IN (SELECT id FROM users WHERE role NOT IN ('owner', 'developer'));

-- Finally, the users rows themselves (keeps owner + developer accounts)
DELETE FROM users WHERE role NOT IN ('owner', 'developer');
