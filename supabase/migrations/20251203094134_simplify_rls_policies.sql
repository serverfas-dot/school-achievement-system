/*
  # Simplify RLS Policies to Break Circular Dependencies

  ## Problem
  Circular dependency: user_roles policies check user_role_assignments,
  and user_role_assignments policies check user_roles.

  ## Solution
  Use a security definer function to check if a user is a super admin,
  which bypasses RLS internally.

  ## Changes
  1. Create a security definer function to check super admin status
  2. Update all policies to use this function
*/

-- Create function to check if user is super admin (bypasses RLS)
CREATE OR REPLACE FUNCTION is_super_admin(user_uuid uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM user_role_assignments
    WHERE user_id = user_uuid
    AND role = 'super_admin'
    AND is_active = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop and recreate policies on user_roles
DROP POLICY IF EXISTS "Super admins can insert users" ON user_roles;
DROP POLICY IF EXISTS "Super admins can update users" ON user_roles;
DROP POLICY IF EXISTS "Super admins can delete users" ON user_roles;

CREATE POLICY "Super admins can insert users"
  ON user_roles
  FOR INSERT
  TO authenticated
  WITH CHECK (is_super_admin(auth.uid()));

CREATE POLICY "Super admins can update users"
  ON user_roles
  FOR UPDATE
  TO authenticated
  USING (is_super_admin(auth.uid()))
  WITH CHECK (is_super_admin(auth.uid()));

CREATE POLICY "Super admins can delete users"
  ON user_roles
  FOR DELETE
  TO authenticated
  USING (is_super_admin(auth.uid()));

-- Drop and recreate policy on user_role_assignments
DROP POLICY IF EXISTS "Allow service role full access" ON user_role_assignments;

CREATE POLICY "Super admins can manage role assignments"
  ON user_role_assignments
  FOR ALL
  TO authenticated
  USING (is_super_admin(auth.uid()))
  WITH CHECK (is_super_admin(auth.uid()));
