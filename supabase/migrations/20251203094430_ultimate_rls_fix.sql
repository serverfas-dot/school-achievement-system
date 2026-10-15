/*
  # Ultimate RLS Fix - Use Separate Admin Tracking

  ## Problem
  SECURITY DEFINER functions in Supabase still respect RLS when used in policies,
  creating impossible circular dependencies.

  ## Solution
  Create a simple table without RLS to track super admins separately,
  then use that for policy checks.

  ## Changes
  1. Create super_admins table without RLS
  2. Populate it from user_role_assignments
  3. Update function to check this table instead
  4. Keep user_role_assignments for multi-role UI
*/

-- Create a simple table to track super admins (no RLS)
CREATE TABLE IF NOT EXISTS super_admins (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);

-- Populate it with existing super admins
INSERT INTO super_admins (user_id)
SELECT DISTINCT user_id
FROM user_role_assignments
WHERE role = 'super_admin' AND is_active = true
ON CONFLICT (user_id) DO NOTHING;

-- Drop and recreate the check function
DROP FUNCTION IF EXISTS is_super_admin(uuid) CASCADE;

CREATE OR REPLACE FUNCTION is_super_admin(user_uuid uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM super_admins WHERE user_id = user_uuid
  );
$$;

GRANT EXECUTE ON FUNCTION is_super_admin(uuid) TO authenticated, anon;

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

-- Create trigger to keep super_admins table in sync
CREATE OR REPLACE FUNCTION sync_super_admins()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.role = 'super_admin' AND NEW.is_active = true THEN
    INSERT INTO super_admins (user_id) VALUES (NEW.user_id)
    ON CONFLICT (user_id) DO NOTHING;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.role = 'super_admin' AND NEW.is_active = true THEN
      INSERT INTO super_admins (user_id) VALUES (NEW.user_id)
      ON CONFLICT (user_id) DO NOTHING;
    ELSIF OLD.role = 'super_admin' OR NEW.is_active = false THEN
      -- Check if user still has any active super_admin roles
      IF NOT EXISTS (
        SELECT 1 FROM user_role_assignments
        WHERE user_id = NEW.user_id
        AND role = 'super_admin'
        AND is_active = true
        AND id != NEW.id
      ) THEN
        DELETE FROM super_admins WHERE user_id = NEW.user_id;
      END IF;
    END IF;
  ELSIF TG_OP = 'DELETE' AND OLD.role = 'super_admin' THEN
    IF NOT EXISTS (
      SELECT 1 FROM user_role_assignments
      WHERE user_id = OLD.user_id
      AND role = 'super_admin'
      AND is_active = true
    ) THEN
      DELETE FROM super_admins WHERE user_id = OLD.user_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER sync_super_admins_trigger
  AFTER INSERT OR UPDATE OR DELETE ON user_role_assignments
  FOR EACH ROW
  EXECUTE FUNCTION sync_super_admins();
