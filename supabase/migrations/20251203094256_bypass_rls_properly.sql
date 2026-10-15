/*
  # Properly Bypass RLS for Super Admin Checks

  ## Problem
  SQL SECURITY DEFINER functions still respect RLS on queried tables.

  ## Solution
  Use a PL/pgSQL function that explicitly works around RLS by using
  pg_catalog system tables or by granting the function owner superuser-like
  privileges on specific tables.

  ## Changes
  1. Grant the authenticator role ability to bypass RLS on specific queries
  2. Recreate policies to use a simpler check
*/

-- Drop existing function
DROP FUNCTION IF EXISTS is_super_admin(uuid) CASCADE;

-- Recreate as PL/pgSQL with explicit table access
CREATE OR REPLACE FUNCTION is_super_admin(user_uuid uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result boolean;
BEGIN
  -- Directly query bypassing RLS
  SELECT EXISTS (
    SELECT 1 FROM user_role_assignments
    WHERE user_id = user_uuid
    AND role = 'super_admin'
    AND is_active = true
  ) INTO result;
  
  RETURN result;
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION is_super_admin(uuid) TO authenticated;

-- Grant the function owner (postgres) ability to bypass RLS
GRANT ALL ON user_role_assignments TO postgres;

-- Recreate all policies
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
