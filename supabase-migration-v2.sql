-- ==============================================================================
-- SPLITZY 2.0 — SUPABASE POSTGRESQL MIGRATION (INTEGER PAISE & STRICT RLS)
-- ==============================================================================
-- Run this migration in your Supabase SQL Editor.
-- Non-negotiable engineering requirements satisfied:
-- 1. All money stored as integer paise (BIGINT).
-- 2. Settlements with 3-state lifecycle (pending -> paid -> confirmed).
-- 3. Strict Row-Level Security: Users can ONLY read/write groups they belong to.
-- 4. Realtime subscription support enabled.
-- ==============================================================================

-- 1. Extend profiles with UPI ID and Avatar preferences
ALTER TABLE IF EXISTS public.profiles 
  ADD COLUMN IF NOT EXISTS upi_id TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS avatar_color TEXT DEFAULT '#4F46E5';

-- 2. Extend groups with shareable invite tokens
ALTER TABLE IF EXISTS public.groups 
  ADD COLUMN IF NOT EXISTS invite_token TEXT DEFAULT encode(gen_random_bytes(12), 'hex');

CREATE INDEX IF NOT EXISTS idx_groups_invite_token ON public.groups(invite_token);

-- 3. Add integer paise column to expenses and backfill from existing decimal amount
ALTER TABLE IF EXISTS public.expenses 
  ADD COLUMN IF NOT EXISTS amount_paise BIGINT DEFAULT 0;

-- Backfill amount_paise from existing amount column if present
UPDATE public.expenses 
SET amount_paise = ROUND(COALESCE(amount, 0) * 100)::BIGINT
WHERE amount_paise = 0 AND amount IS NOT NULL;

-- 4. Add integer paise & lifecycle tracking to settlements
ALTER TABLE IF EXISTS public.settlements 
  ADD COLUMN IF NOT EXISTS amount_paise BIGINT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'confirmed')),
  ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS upi_ref TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS payer_upi_id TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS receiver_upi_id TEXT DEFAULT '';

-- Backfill amount_paise from existing settlement amount if present
UPDATE public.settlements 
SET amount_paise = ROUND(COALESCE(amount, 0) * 100)::BIGINT
WHERE amount_paise = 0 AND amount IS NOT NULL;

-- 5. Helper Function for Fast RLS Evaluation (Security Definer)
-- Returns true if current auth.uid() is the creator OR a registered member of the group
CREATE OR REPLACE FUNCTION public.is_group_member(target_group_id TEXT)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.groups g 
    WHERE g.id = target_group_id AND g.created_by_id = auth.uid()
    UNION
    SELECT 1 FROM public.group_members gm 
    WHERE gm.group_id = target_group_id AND gm.user_id = auth.uid()
  );
$$;

-- 6. Replace and enforce strict Group-scoped Row-Level Security Policies
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settlements ENABLE ROW LEVEL SECURITY;

-- Drop old broad policies if they exist
DROP POLICY IF EXISTS "Allow public read profiles" ON public.profiles;
DROP POLICY IF EXISTS "Allow public insert update profiles" ON public.profiles;
DROP POLICY IF EXISTS "Allow public full access to groups" ON public.groups;
DROP POLICY IF EXISTS "Allow public full access to group_members" ON public.group_members;
DROP POLICY IF EXISTS "Allow public full access to expenses" ON public.expenses;
DROP POLICY IF EXISTS "Allow public full access to settlements" ON public.settlements;

-- Profiles: Anyone authenticated or anonymous can read basic user info (for avatar & UPI ID display)
-- Users can only modify their own profile
CREATE POLICY "profiles_select_policy" 
  ON public.profiles FOR SELECT 
  TO authenticated, anon 
  USING (true);

CREATE POLICY "profiles_upsert_policy" 
  ON public.profiles FOR ALL 
  TO authenticated 
  USING (auth.uid() = id) 
  WITH CHECK (auth.uid() = id);

-- Groups: Members can view their groups. Authenticated users can create groups.
CREATE POLICY "groups_select_policy" 
  ON public.groups FOR SELECT 
  TO authenticated, anon 
  USING (created_by_id = auth.uid() OR public.is_group_member(id));

CREATE POLICY "groups_insert_policy" 
  ON public.groups FOR INSERT 
  TO authenticated 
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "groups_update_policy" 
  ON public.groups FOR UPDATE 
  TO authenticated 
  USING (public.is_group_member(id))
  WITH CHECK (public.is_group_member(id));

CREATE POLICY "groups_delete_policy" 
  ON public.groups FOR DELETE 
  TO authenticated 
  USING (created_by_id = auth.uid());

-- Group Members: Only group members can view or manage memberships
CREATE POLICY "group_members_select_policy" 
  ON public.group_members FOR SELECT 
  TO authenticated, anon 
  USING (public.is_group_member(group_id));

CREATE POLICY "group_members_insert_policy" 
  ON public.group_members FOR INSERT 
  TO authenticated 
  WITH CHECK (public.is_group_member(group_id) OR auth.uid() = user_id);

CREATE POLICY "group_members_update_delete_policy" 
  ON public.group_members FOR ALL 
  TO authenticated 
  USING (public.is_group_member(group_id))
  WITH CHECK (public.is_group_member(group_id));

-- Expenses: Strict group isolation
CREATE POLICY "expenses_select_policy" 
  ON public.expenses FOR SELECT 
  TO authenticated, anon 
  USING (public.is_group_member(group_id));

CREATE POLICY "expenses_insert_policy" 
  ON public.expenses FOR INSERT 
  TO authenticated 
  WITH CHECK (public.is_group_member(group_id));

CREATE POLICY "expenses_update_delete_policy" 
  ON public.expenses FOR ALL 
  TO authenticated 
  USING (public.is_group_member(group_id))
  WITH CHECK (public.is_group_member(group_id));

-- Settlements: Strict group isolation
CREATE POLICY "settlements_select_policy" 
  ON public.settlements FOR SELECT 
  TO authenticated, anon 
  USING (public.is_group_member(group_id));

CREATE POLICY "settlements_insert_policy" 
  ON public.settlements FOR INSERT 
  TO authenticated 
  WITH CHECK (public.is_group_member(group_id));

CREATE POLICY "settlements_update_delete_policy" 
  ON public.settlements FOR ALL 
  TO authenticated 
  USING (public.is_group_member(group_id))
  WITH CHECK (public.is_group_member(group_id));

-- 7. Realtime publications
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'settlements') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.settlements;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'expenses') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.expenses;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'groups') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.groups;
  END IF;
END
$$;
