/*
  # Use Materialized View for Admin Check

  ## New Approach
  Create a simple view that authenticated users can query,
  and use current_user comparison instead of auth.uid()

  ## Changes
  1. Create a readable view for checking admin status
  2. Simplify policies to avoid complex EXISTS checks
*/

-- Create a simple view
CREATE OR REPLACE VIEW user_is_super_admin AS
SELECT user_id, true as is_admin
FROM super_admins;

-- Grant access
GRANT SELECT ON user_is_super_admin TO authenticated, anon;

-- Drop and recreate policies with simpler logic
DROP POLICY IF EXISTS "Super admins can insert users" ON user_roles;
DROP POLICY IF EXISTS "Super admins can update users" ON user_roles;
DROP POLICY IF EXISTS "Super admins can delete users" ON user_roles;

-- Try using the view
CREATE POLICY "Super admins can insert users"
  ON user_roles
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_is_super_admin 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Super admins can update users"
  ON user_roles
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_is_super_admin 
      WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_is_super_admin 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Super admins can delete users"
  ON user_roles
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_is_super_admin 
      WHERE user_id = auth.uid()
    )
  );
