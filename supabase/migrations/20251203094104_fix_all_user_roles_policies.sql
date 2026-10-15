/*
  # Fix All User Roles RLS Policies

  ## Problem
  The INSERT, UPDATE, and DELETE policies for user_roles have infinite
  recursion because they check the same table they're protecting.

  ## Solution
  Drop all the recursive policies and create new ones that don't cause
  recursion by using simple role checks.

  ## Changes
  1. Drop old recursive policies
  2. Create new non-recursive policies for super admins
*/

-- Drop old recursive policies
DROP POLICY IF EXISTS "Super admin can insert users" ON user_roles;
DROP POLICY IF EXISTS "Super admin can update users" ON user_roles;
DROP POLICY IF EXISTS "Super admin can delete users" ON user_roles;

-- Create new policies that check user_role_assignments instead
CREATE POLICY "Super admins can insert users"
  ON user_roles
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_role_assignments
      WHERE user_id = auth.uid()
      AND role = 'super_admin'
      AND is_active = true
    )
  );

CREATE POLICY "Super admins can update users"
  ON user_roles
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_role_assignments
      WHERE user_id = auth.uid()
      AND role = 'super_admin'
      AND is_active = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_role_assignments
      WHERE user_id = auth.uid()
      AND role = 'super_admin'
      AND is_active = true
    )
  );

CREATE POLICY "Super admins can delete users"
  ON user_roles
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_role_assignments
      WHERE user_id = auth.uid()
      AND role = 'super_admin'
      AND is_active = true
    )
  );
