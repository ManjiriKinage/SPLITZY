-- ==============================================================================
-- SPLITZY 2.0 — SUPABASE POSTGRESQL DATABASE SCHEMA & REALTIME CONFIGURATION
-- ==============================================================================
-- Paste this entire SQL script into your Supabase SQL Editor and click "RUN".
-- It creates all required tables, indexes, triggers, and enables Realtime WebSockets.
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

-- 3. Create Expenses Table
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
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. Create Settlements Table (Direct Recorded Transfers)
CREATE TABLE IF NOT EXISTS public.settlements (
  id TEXT PRIMARY KEY,
  group_id TEXT NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  payer TEXT NOT NULL,
  receiver TEXT NOT NULL,
  amount NUMERIC(12, 2) NOT NULL,
  date DATE DEFAULT CURRENT_DATE NOT NULL,
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. Create Indexes for High-Performance Queries
CREATE INDEX IF NOT EXISTS idx_groups_code ON public.groups(code);
CREATE INDEX IF NOT EXISTS idx_expenses_group_id ON public.expenses(group_id);
CREATE INDEX IF NOT EXISTS idx_settlements_group_id ON public.settlements(group_id);

-- 6. Enable Row-Level Security (RLS) on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settlements ENABLE ROW LEVEL SECURITY;

-- 7. Define RLS Policies for Authenticated Users (Read/Write access)
-- (Allows logged-in users to collaborate in real-time on groups, expenses, and settlements)
DO $$
BEGIN
  -- Profiles policies
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'Allow authenticated users read profiles') THEN
    CREATE POLICY "Allow authenticated users read profiles" ON public.profiles FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'Allow users update own profile') THEN
    CREATE POLICY "Allow users update own profile" ON public.profiles FOR ALL TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
  END IF;

  -- Groups policies
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'groups' AND policyname = 'Allow authenticated users full access to groups') THEN
    CREATE POLICY "Allow authenticated users full access to groups" ON public.groups FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;

  -- Expenses policies
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'expenses' AND policyname = 'Allow authenticated users full access to expenses') THEN
    CREATE POLICY "Allow authenticated users full access to expenses" ON public.expenses FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;

  -- Settlements policies
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'settlements' AND policyname = 'Allow authenticated users full access to settlements') THEN
    CREATE POLICY "Allow authenticated users full access to settlements" ON public.settlements FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END
$$;

-- 8. Enable Realtime WebSocket Broadcasting on all tables (Idempotent)
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
