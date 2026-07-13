-- ============================================================
-- FLIXFIX - Supabase Setup Script (CLEAN v2)
-- Go to: Supabase Dashboard -> SQL Editor -> New query
-- Paste this ENTIRE file and press RUN
-- Safe to re-run - all statements use IF NOT EXISTS / OR REPLACE
-- ============================================================


-- ============================================================
-- STEP 1: Create tables
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY,
  role          TEXT NOT NULL CHECK (role IN ('owner', 'shop', 'driver')),
  approved      BOOLEAN DEFAULT FALSE,
  online_status BOOLEAN DEFAULT FALSE,
  push_token    TEXT,
  email         TEXT
);

CREATE TABLE IF NOT EXISTS shops (
  id    UUID PRIMARY KEY REFERENCES users(id),
  name  TEXT NOT NULL,
  phone TEXT
);

CREATE TABLE IF NOT EXISTS drivers (
  id    UUID PRIMARY KEY REFERENCES users(id),
  name  TEXT NOT NULL,
  phone TEXT
);

CREATE TABLE IF NOT EXISTS orders (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shop_id       UUID REFERENCES shops(id),
  driver_id     UUID REFERENCES drivers(id),
  street        TEXT NOT NULL,
  phone         TEXT,
  customer_name TEXT,
  bell          TEXT,
  floor         TEXT,
  notes         TEXT,
  amount        NUMERIC(8,2),
  cancel_reason TEXT,
  status        TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'assigned', 'delivered', 'cancelled')),
  created_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS order_timeline (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id   UUID REFERENCES orders(id),
  event      TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS customers (
  id      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shop_id UUID REFERENCES shops(id),
  phone   TEXT NOT NULL,
  name    TEXT,
  address TEXT,
  bell    TEXT,
  floor   TEXT
);


-- ============================================================
-- STEP 2: Add columns if missing (safe to re-run)
-- ============================================================

ALTER TABLE orders ADD COLUMN IF NOT EXISTS amount        NUMERIC(8,2);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS cancel_reason TEXT;
ALTER TABLE users  ADD COLUMN IF NOT EXISTS push_token    TEXT;
ALTER TABLE users  ADD COLUMN IF NOT EXISTS email         TEXT;

-- Fill email for existing users from Auth
UPDATE public.users u
SET    email = a.email
FROM   auth.users a
WHERE  u.id = a.id
  AND  u.email IS NULL;


-- ============================================================
-- STEP 3: RLS Policies
-- ============================================================

-- USERS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own data"             ON users;
DROP POLICY IF EXISTS "Anyone authenticated can read users" ON users;
DROP POLICY IF EXISTS "Users can insert own record"         ON users;
DROP POLICY IF EXISTS "Allow self insert on register"       ON users;
DROP POLICY IF EXISTS "Users can update own record"         ON users;
DROP POLICY IF EXISTS "Owner can update any user"           ON users;
DROP POLICY IF EXISTS "Owner can delete users"              ON users;

CREATE POLICY "Anyone authenticated can read users"
  ON users FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Users can insert own record"
  ON users FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own record"
  ON users FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Owner can update any user"
  ON users FOR UPDATE USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'owner')
  );

CREATE POLICY "Owner can delete users"
  ON users FOR DELETE USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'owner')
  );


-- SHOPS
ALTER TABLE shops ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone authenticated can read shops" ON shops;
DROP POLICY IF EXISTS "Shop can insert own record"          ON shops;
DROP POLICY IF EXISTS "Shop can update own record"          ON shops;

CREATE POLICY "Anyone authenticated can read shops"
  ON shops FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Shop can insert own record"
  ON shops FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Shop can update own record"
  ON shops FOR UPDATE USING (auth.uid() = id);


-- DRIVERS
ALTER TABLE drivers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone authenticated can read drivers" ON drivers;
DROP POLICY IF EXISTS "Driver can insert own record"          ON drivers;
DROP POLICY IF EXISTS "Driver can update own record"          ON drivers;

CREATE POLICY "Anyone authenticated can read drivers"
  ON drivers FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Driver can insert own record"
  ON drivers FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Driver can update own record"
  ON drivers FOR UPDATE USING (auth.uid() = id);


-- ORDERS
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone authenticated can manage orders" ON orders;

CREATE POLICY "Anyone authenticated can manage orders"
  ON orders FOR ALL USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');


-- ORDER_TIMELINE
ALTER TABLE order_timeline ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone authenticated can manage timeline" ON order_timeline;

CREATE POLICY "Anyone authenticated can manage timeline"
  ON order_timeline FOR ALL USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');


-- CUSTOMERS
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone authenticated can manage customers" ON customers;

CREATE POLICY "Anyone authenticated can manage customers"
  ON customers FOR ALL USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');


-- ============================================================
-- STEP 4: Enable Realtime
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'orders'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE orders;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'users'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE users;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'order_timeline'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE order_timeline;
  END IF;
END $$;


-- ============================================================
-- STEP 5: Unique constraint for customer autocomplete
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'customers_shop_phone_unique'
  ) THEN
    ALTER TABLE customers
      ADD CONSTRAINT customers_shop_phone_unique UNIQUE (shop_id, phone);
  END IF;
END $$;


-- ============================================================
-- STEP 6: User registration function (bypasses RLS)
-- ============================================================

CREATE OR REPLACE FUNCTION create_user_profile(
  p_user_id uuid,
  p_role    text,
  p_name    text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email TEXT;
BEGIN
  SELECT email INTO v_email FROM auth.users WHERE id = p_user_id;

  INSERT INTO users (id, role, approved, online_status, email)
  VALUES (p_user_id, p_role, false, false, v_email)
  ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email;

  IF p_role = 'shop' THEN
    INSERT INTO shops (id, name)
    VALUES (p_user_id, p_name)
    ON CONFLICT (id) DO NOTHING;
  ELSIF p_role = 'driver' THEN
    INSERT INTO drivers (id, name)
    VALUES (p_user_id, p_name)
    ON CONFLICT (id) DO NOTHING;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION create_user_profile TO anon, authenticated;


-- ============================================================
-- STEP 7: Auto-offline when auth user is deleted
-- Fixes: deleted user still shows as "active driver/shop"
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_auth_user_deleted()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.users SET online_status = false WHERE id = OLD.id;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_deleted ON auth.users;
CREATE TRIGGER on_auth_user_deleted
  BEFORE DELETE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_auth_user_deleted();


-- ============================================================
-- STEP 8: Deactivation flag for shops/drivers (owner "delete")
-- Soft-delete instead of a real DELETE, since shops/drivers with
-- past orders can't be hard-deleted (orders.shop_id/driver_id FK).
-- ============================================================

ALTER TABLE users ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT true;


-- ============================================================
-- STEP 9: Per-driver order-visibility restriction
-- For external/occasional drivers the owner doesn't want seeing
-- every order all day.
-- ============================================================

ALTER TABLE users ADD COLUMN IF NOT EXISTS can_view_orders BOOLEAN DEFAULT true;


-- ============================================================
-- STEP 10: Owner-created shop WITHOUT a login account
-- For shops that will never use the app themselves — the owner
-- just needs a name (+ optional phone) to pick from in New Order.
-- Bypasses RLS via SECURITY DEFINER; checks the caller is an owner
-- itself since the "insert own record" policy on users/shops only
-- allows auth.uid() = id (irrelevant here — there is no auth user).
-- ============================================================

CREATE OR REPLACE FUNCTION create_shop_without_account(
  p_name  TEXT,
  p_phone TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_id UUID;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'owner') THEN
    RAISE EXCEPTION 'Only an owner can create a shop without an account';
  END IF;

  v_new_id := uuid_generate_v4();

  INSERT INTO users (id, role, approved, active, online_status, email)
  VALUES (v_new_id, 'shop', true, true, false, NULL);

  INSERT INTO shops (id, name, phone)
  VALUES (v_new_id, p_name, p_phone);

  RETURN v_new_id;
END;
$$;

GRANT EXECUTE ON FUNCTION create_shop_without_account TO authenticated;


-- ============================================================
-- STEP 11: "Heartbeat" column so online_status can't stay stuck forever
-- ============================================================
-- online_status alone was set to TRUE on shop/driver login and only ever
-- flipped back to FALSE by a clean sign-out / app-background event. If the
-- app crashes, loses connectivity, or the device is force-closed / shut
-- down, no such event ever fires and the shop/driver appears "online"
-- indefinitely even if nobody has opened the app in days. Clients now send
-- a heartbeat (last_seen_at = now()) roughly every 60s while online; the
-- app treats a shop/driver as online only if online_status = true AND
-- last_seen_at is recent (see src/lib/onlineStatus.ts).

ALTER TABLE users ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMP WITH TIME ZONE;


-- ============================================================
-- STEP 12: "developer" role — a super-admin account for the app's
-- developer, separate from the business owner. Full visibility +
-- control over every account, plus the support inbox (STEP 14).
-- ============================================================

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check
  CHECK (role IN ('owner', 'shop', 'driver', 'developer'));

-- Extend the existing owner-only policies to developer too.
DROP POLICY IF EXISTS "Owner can update any user" ON users;
CREATE POLICY "Owner can update any user"
  ON users FOR UPDATE USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('owner', 'developer'))
  );

DROP POLICY IF EXISTS "Owner can delete users" ON users;
CREATE POLICY "Owner can delete users"
  ON users FOR DELETE USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('owner', 'developer'))
  );

DROP POLICY IF EXISTS "Developer can update any shop" ON shops;
CREATE POLICY "Developer can update any shop"
  ON shops FOR UPDATE USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'developer')
  );

DROP POLICY IF EXISTS "Developer can update any driver" ON drivers;
CREATE POLICY "Developer can update any driver"
  ON drivers FOR UPDATE USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'developer')
  );

-- Let a developer create no-account shops too (previously owner-only).
CREATE OR REPLACE FUNCTION create_shop_without_account(
  p_name  TEXT,
  p_phone TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_id UUID;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('owner', 'developer')) THEN
    RAISE EXCEPTION 'Only an owner or developer can create a shop without an account';
  END IF;

  v_new_id := uuid_generate_v4();

  INSERT INTO users (id, role, approved, active, online_status, email)
  VALUES (v_new_id, 'shop', true, true, false, NULL);

  INSERT INTO shops (id, name, phone)
  VALUES (v_new_id, p_name, p_phone);

  RETURN v_new_id;
END;
$$;


-- ============================================================
-- STEP 13: SECURITY FIX — create_user_profile let ANY caller pick
-- ANY role (including 'owner'), since p_role was never validated
-- and the function is granted to `anon`. Self-signup must only ever
-- be able to produce 'shop' or 'driver' accounts; 'owner' and
-- 'developer' can only be granted via promote_user_role (STEP 15),
-- which requires an existing developer to call it.
-- ============================================================

CREATE OR REPLACE FUNCTION create_user_profile(
  p_user_id uuid,
  p_role    text,
  p_name    text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email TEXT;
BEGIN
  IF p_role NOT IN ('shop', 'driver') THEN
    RAISE EXCEPTION 'Self-registration only allows shop or driver accounts';
  END IF;

  SELECT email INTO v_email FROM auth.users WHERE id = p_user_id;

  INSERT INTO users (id, role, approved, online_status, email)
  VALUES (p_user_id, p_role, false, false, v_email)
  ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email;

  IF p_role = 'shop' THEN
    INSERT INTO shops (id, name)
    VALUES (p_user_id, p_name)
    ON CONFLICT (id) DO NOTHING;
  ELSIF p_role = 'driver' THEN
    INSERT INTO drivers (id, name)
    VALUES (p_user_id, p_name)
    ON CONFLICT (id) DO NOTHING;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION create_user_profile TO anon, authenticated;


-- ============================================================
-- STEP 14: Support chat — one private 1:1 thread per account,
-- visible in full only to that account and to developers.
-- ============================================================

CREATE TABLE IF NOT EXISTS support_messages (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES users(id),
  sender_role TEXT NOT NULL CHECK (sender_role IN ('user', 'developer')),
  message     TEXT NOT NULL,
  read        BOOLEAN DEFAULT false,
  created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_support_messages_user_id ON support_messages(user_id);

ALTER TABLE support_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own support thread"        ON support_messages;
DROP POLICY IF EXISTS "Users can send own support messages"      ON support_messages;
DROP POLICY IF EXISTS "Users can mark own thread messages read"  ON support_messages;
DROP POLICY IF EXISTS "Developer can read all support threads"   ON support_messages;
DROP POLICY IF EXISTS "Developer can send support replies"       ON support_messages;
DROP POLICY IF EXISTS "Developer can mark messages read"         ON support_messages;

CREATE POLICY "Users can read own support thread"
  ON support_messages FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can send own support messages"
  ON support_messages FOR INSERT WITH CHECK (auth.uid() = user_id AND sender_role = 'user');

CREATE POLICY "Users can mark own thread messages read"
  ON support_messages FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Developer can read all support threads"
  ON support_messages FOR SELECT USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'developer')
  );

CREATE POLICY "Developer can send support replies"
  ON support_messages FOR INSERT WITH CHECK (
    sender_role = 'developer' AND
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'developer')
  );

CREATE POLICY "Developer can mark messages read"
  ON support_messages FOR UPDATE USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'developer')
  );

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'support_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE support_messages;
  END IF;
END $$;


-- ============================================================
-- STEP 15: Role promotion — the ONLY way an account becomes
-- 'owner' or 'developer'. Callable only by an existing developer.
-- The target account must already exist (have signed up normally
-- as shop/driver first) — this changes its role, it doesn't create
-- a brand new login.
-- ============================================================

CREATE OR REPLACE FUNCTION promote_user_role(
  p_user_id  UUID,
  p_new_role TEXT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'developer') THEN
    RAISE EXCEPTION 'Only a developer can change account roles';
  END IF;

  IF p_new_role NOT IN ('owner', 'developer', 'shop', 'driver') THEN
    RAISE EXCEPTION 'Invalid role: %', p_new_role;
  END IF;

  UPDATE users SET role = p_new_role, approved = true WHERE id = p_user_id;

  IF p_new_role = 'shop' THEN
    INSERT INTO shops (id, name) VALUES (p_user_id, 'Νέο Μαγαζί') ON CONFLICT (id) DO NOTHING;
  ELSIF p_new_role = 'driver' THEN
    INSERT INTO drivers (id, name) VALUES (p_user_id, 'Νέος Οδηγός') ON CONFLICT (id) DO NOTHING;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION promote_user_role TO authenticated;


-- ============================================================
-- STEP 16: FIX — "function uuid_generate_v4() does not exist"
-- Supabase installs the "uuid-ossp" extension (STEP 1) into the
-- `extensions` schema, not `public`. Unless that schema happens to be on
-- the connection's search_path, calling uuid_generate_v4() unqualified
-- fails with exactly this error (hit when the owner used "Δημιουργία
-- Μαγαζιού"). Postgres 13+ (what Supabase runs) ships gen_random_uuid()
-- as a built-in core function that needs NO extension at all, so every
-- default/RPC below is switched over to it — removes the dependency on
-- uuid-ossp entirely instead of fighting search_path.
-- ============================================================

ALTER TABLE orders           ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE order_timeline   ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE customers        ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE support_messages ALTER COLUMN id SET DEFAULT gen_random_uuid();

CREATE OR REPLACE FUNCTION create_shop_without_account(
  p_name  TEXT,
  p_phone TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_id UUID;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('owner', 'developer')) THEN
    RAISE EXCEPTION 'Only an owner or developer can create a shop without an account';
  END IF;

  v_new_id := gen_random_uuid();

  INSERT INTO users (id, role, approved, active, online_status, email)
  VALUES (v_new_id, 'shop', true, true, false, NULL);

  INSERT INTO shops (id, name, phone)
  VALUES (v_new_id, p_name, p_phone);

  RETURN v_new_id;
END;
$$;


-- ============================================================
-- STEP 17: Order timing + owner-created flag
-- assigned_at / delivered_at let History screens show "παρέλαβε στις.."
-- / "παραδόθηκε στις.." with duration, without an extra per-order query
-- against order_timeline. created_by_owner lets shop screens show that
-- an order was placed on their behalf by the owner/developer, instead of
-- that fact being buried only inside the order_timeline text.
-- ============================================================

ALTER TABLE orders ADD COLUMN IF NOT EXISTS assigned_at      TIMESTAMP WITH TIME ZONE;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivered_at     TIMESTAMP WITH TIME ZONE;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS created_by_owner BOOLEAN DEFAULT false;


-- ============================================================
-- STEP 18: "Open order" — owner creates an order for a shop with just the
-- shop picked, no street/phone/name. Used when the driver/owner already
-- know where it's going by other means (phone call, standing order) and
-- filling the full address form is pointless. `street` stays NOT NULL
-- (every screen renders it as the card headline), so these get a fixed
-- placeholder there instead of a real address; is_open_order marks the row
-- as such for any future filtering/reporting.
-- ============================================================

ALTER TABLE orders ADD COLUMN IF NOT EXISTS is_open_order BOOLEAN DEFAULT false;


-- ============================================================
-- END
-- ============================================================