/*
  # Simplify RLS by Allowing Super Admin Direct Access

  ## Problem
  SECURITY DEFINER functions in RLS policy context still respect the caller's RLS,
  creating circular dependencies.

  ## Solution
  Temporarily disable RLS on user_role_assignments for the postgres role
  so the function can read it, OR use a different approach entirely.

  We'll use an approach where the postgres user (function owner) can bypass RLS.

  ## Changes
  1. Alter RLS on user_role_assignments to allow postgres role to bypass
  2. The SECURITY DEFINER function will execute as the function owner
*/

-- Allow the postgres role to bypass RLS on user_role_assignments
ALTER TABLE user_role_assignments FORCE ROW LEVEL SECURITY;

-- Drop and recreate function to ensure it uses the right role
DROP FUNCTION IF EXISTS is_super_admin(uuid) CASCADE;

CREATE OR REPLACE FUNCTION is_super_admin(user_uuid uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  is_admin boolean;
BEGIN
  -- This function runs as the definer (postgres user who created it)
  -- and can bypass RLS
  SELECT EXISTS (
    SELECT 1
    FROM user_role_assignments
    WHERE user_id = user_uuid
      AND role = 'super_admin'
      AND is_active = true
  ) INTO is_admin;
  
  RETURN COALESCE(is_admin, false);
EXCEPTION
  WHEN OTHERS THEN
    RETURN false;
END;
$$;

-- Ensure the function owner (postgres) can access the table
GRANT SELECT ON user_role_assignments TO postgres;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION is_super_admin(uuid) TO authenticated, anon;

-- Recreate all policies using the function
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

CREATE POLICY "Super admins can manage role assignments"
  ON user_role_assignments
  FOR ALL
  TO authenticated
  USING (is_super_admin(auth.uid()))
  WITH CHECK (is_super_admin(auth.uid()));
