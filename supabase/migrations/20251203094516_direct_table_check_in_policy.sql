/*
  # Use Direct Table Check in Policies

  ## Problem
  Functions in RLS policies have evaluation context issues in Supabase.

  ## Solution
  Skip the function entirely and use direct table checks in policies.
  Since super_admins has no RLS, it can be queried directly.

  ## Changes
  1. Remove function-based policies
  2. Use direct EXISTS queries in policies
*/

-- Drop function-based policies
DROP POLICY IF EXISTS "Super admins can insert users" ON user_roles;
DROP POLICY IF EXISTS "Super admins can update users" ON user_roles;
DROP POLICY IF EXISTS "Super admins can delete users" ON user_roles;
DROP POLICY IF EXISTS "Super admins can manage role assignments" ON user_role_assignments;

-- Create policies with direct table checks
CREATE POLICY "Super admins can insert users"
  ON user_roles
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM super_admins WHERE user_id = auth.uid())
  );

CREATE POLICY "Super admins can update users"
  ON user_roles
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM super_admins WHERE user_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM super_admins WHERE user_id = auth.uid())
  );

CREATE POLICY "Super admins can delete users"
  ON user_roles
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM super_admins WHERE user_id = auth.uid())
  );

CREATE POLICY "Super admins can manage role assignments"
  ON user_role_assignments
  FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM super_admins WHERE user_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM super_admins WHERE user_id = auth.uid())
  );
