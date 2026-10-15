/*
  # Recreate Function with CASCADE

  ## Changes
  1. Drop function with CASCADE to remove dependent policies
  2. Recreate function as SQL with SECURITY DEFINER
  3. Recreate all policies
*/

-- Drop function with cascade
DROP FUNCTION IF EXISTS is_super_admin(uuid) CASCADE;

-- Recreate the function as SQL type with proper security
CREATE OR REPLACE FUNCTION is_super_admin(user_uuid uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_role_assignments
    WHERE user_id = user_uuid
    AND role = 'super_admin'
    AND is_active = true
  );
$$;

GRANT EXECUTE ON FUNCTION is_super_admin(uuid) TO authenticated;

-- Recreate policies on user_roles
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

-- Recreate policy on user_role_assignments
CREATE POLICY "Super admins can manage role assignments"
  ON user_role_assignments
  FOR ALL
  TO authenticated
  USING (is_super_admin(auth.uid()))
  WITH CHECK (is_super_admin(auth.uid()));
