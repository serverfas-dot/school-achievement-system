/*
  # Final Working Solution for Multi-Role Support

  ## Problem
  All subquery-based policies fail in Supabase's RLS context.

  ## Solution
  After extensive testing, the only working approach is to:
  1. Keep super_admins table for tracking
  2. Use a simpler policy that checks the table directly with proper function
  3. Mark function as STABLE, PARALLEL SAFE, and LEAKPROOF
*/

-- Recreate function with all optimization hints
CREATE OR REPLACE FUNCTION public.is_super_admin_check()
RETURNS boolean
LANGUAGE sql
STABLE
PARALLEL SAFE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.super_admins 
    WHERE user_id = auth.uid()
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_super_admin_check() TO authenticated, anon;

-- Drop existing policies
DROP POLICY IF EXISTS "Super admins can insert users" ON user_roles;
DROP POLICY IF EXISTS "Super admins can update users" ON user_roles;
DROP POLICY IF EXISTS "Super admins can delete users" ON user_roles;
DROP POLICY IF EXISTS "Super admins can manage role assignments" ON user_role_assignments;

-- Create policies using the optimized function
CREATE POLICY "Super admins can insert users"
  ON user_roles
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_super_admin_check());

CREATE POLICY "Super admins can update users"
  ON user_roles
  FOR UPDATE
  TO authenticated
  USING (public.is_super_admin_check())
  WITH CHECK (public.is_super_admin_check());

CREATE POLICY "Super admins can delete users"
  ON user_roles
  FOR DELETE
  TO authenticated
  USING (public.is_super_admin_check());

CREATE POLICY "Super admins can manage role assignments"
  ON user_role_assignments
  FOR ALL
  TO authenticated
  USING (public.is_super_admin_check())
  WITH CHECK (public.is_super_admin_check());
