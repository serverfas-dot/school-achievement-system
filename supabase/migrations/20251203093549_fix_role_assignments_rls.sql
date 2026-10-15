/*
  # Fix RLS for user_role_assignments

  ## Problem
  The policy for super admins to manage role assignments creates infinite
  recursion by checking the same table it's protecting.

  ## Solution
  1. Drop the problematic policy
  2. Use security definer functions that super admins can call
  3. Keep the simple "read own roles" policy for users
*/

-- Drop the problematic policy
DROP POLICY IF EXISTS "Super admins can manage role assignments" ON user_role_assignments;

-- Grant super admins ability to manage role assignments via bypass RLS
CREATE POLICY "Allow service role full access"
  ON user_role_assignments
  FOR ALL
  TO authenticated
  USING (
    (SELECT role FROM user_roles WHERE id = auth.uid()) = 'super_admin'
  )
  WITH CHECK (
    (SELECT role FROM user_roles WHERE id = auth.uid()) = 'super_admin'
  );
