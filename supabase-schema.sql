-- ==============================================================================
-- SPLITZY 2.0 — SUPABASE POSTGRESQL DATABASE SCHEMA & REALTIME CONFIGURATION
-- ==============================================================================
-- Paste this entire SQL script into your Supabase SQL Editor and click "RUN".
-- It creates all required tables, many-to-many group memberships, indexes,
-- RLS policies, triggers, and enables Realtime WebSockets on all tables.
-- ==============================================================================

-- 1. Create Public User Profiles Table (Synced with Supabase Auth)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  upi_id TEXT DEFAULT '',
  color TEXT DEFAULT '#4f46e5',
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Create Groups Table
CREATE TABLE IF NOT EXISTS public.groups (
  id TEXT PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  category TEXT DEFAULT 'General',
  icon TEXT DEFAULT 'fa-users',
  color TEXT DEFAULT '#4f46e5',
  members JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_by TEXT NOT NULL,
  created_by_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Create Group Members Table (Many-to-Many mapping between Groups & Users)
CREATE TABLE IF NOT EXISTS public.group_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id TEXT NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  member_name TEXT NOT NULL,
  email TEXT DEFAULT '',
  role TEXT DEFAULT 'member', -- 'creator' | 'admin' | 'member'
  joined_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  CONSTRAINT uq_group_member UNIQUE(group_id, member_name)
);

-- 4. Create Expenses Table (Collaborative Multi-User Splitting)
CREATE TABLE IF NOT EXISTS public.expenses (
  id TEXT PRIMARY KEY,
  group_id TEXT NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  amount NUMERIC(12, 2) NOT NULL,
  category TEXT DEFAULT 'General',
  date DATE DEFAULT CURRENT_DATE NOT NULL,
  paid_by TEXT NOT NULL,
  split_type TEXT DEFAULT 'equal',
  splits JSONB NOT NULL DEFAULT '{}'::jsonb,
  itemized_data JSONB DEFAULT '[]'::jsonb,
  notes TEXT DEFAULT '',
  created_by_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. Create Settlements Table (Direct Recorded Transfers & Payments)
CREATE TABLE IF NOT EXISTS public.settlements (
  id TEXT PRIMARY KEY,
  group_id TEXT NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  payer TEXT NOT NULL,
  receiver TEXT NOT NULL,
  amount NUMERIC(12, 2) NOT NULL,
  date DATE DEFAULT CURRENT_DATE NOT NULL,
  notes TEXT DEFAULT '',
  recorded_by_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 6. Create Indexes for High-Performance Queries
CREATE INDEX IF NOT EXISTS idx_groups_code ON public.groups(code);
CREATE INDEX IF NOT EXISTS idx_group_members_group_id ON public.group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_group_members_user_id ON public.group_members(user_id);
CREATE INDEX IF NOT EXISTS idx_group_members_name ON public.group_members(member_name);
CREATE INDEX IF NOT EXISTS idx_expenses_group_id ON public.expenses(group_id);
CREATE INDEX IF NOT EXISTS idx_settlements_group_id ON public.settlements(group_id);

-- 7. Configure Full Replica Identity for Realtime UPDATE/DELETE payloads
ALTER TABLE public.profiles REPLICA IDENTITY FULL;
ALTER TABLE public.groups REPLICA IDENTITY FULL;
ALTER TABLE public.group_members REPLICA IDENTITY FULL;
ALTER TABLE public.expenses REPLICA IDENTITY FULL;
ALTER TABLE public.settlements REPLICA IDENTITY FULL;

-- 8. Enable Row-Level Security (RLS) on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settlements ENABLE ROW LEVEL SECURITY;

-- 9. Define RLS Policies for Authenticated and Anon Users (Read/Write access)
DO $$
BEGIN
  -- Profiles policies
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'Allow public read profiles') THEN
    CREATE POLICY "Allow public read profiles" ON public.profiles FOR SELECT TO authenticated, anon USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'Allow public insert update profiles') THEN
    CREATE POLICY "Allow public insert update profiles" ON public.profiles FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);
  END IF;

  -- Groups policies
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'groups' AND policyname = 'Allow public full access to groups') THEN
    CREATE POLICY "Allow public full access to groups" ON public.groups FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);
  END IF;

  -- Group Members policies
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'group_members' AND policyname = 'Allow public full access to group_members') THEN
    CREATE POLICY "Allow public full access to group_members" ON public.group_members FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);
  END IF;

  -- Expenses policies
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'expenses' AND policyname = 'Allow public full access to expenses') THEN
    CREATE POLICY "Allow public full access to expenses" ON public.expenses FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);
  END IF;

  -- Settlements policies
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'settlements' AND policyname = 'Allow public full access to settlements') THEN
    CREATE POLICY "Allow public full access to settlements" ON public.settlements FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);
  END IF;
END
$$;

-- 10. Enable Realtime WebSocket Broadcasting on all tables (Idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'profiles'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'groups'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.groups;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'group_members'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.group_members;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'expenses'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.expenses;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'settlements'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.settlements;
  END IF;
END
$$;
