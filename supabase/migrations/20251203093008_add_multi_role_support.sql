/*
  # Add Multi-Role Support for Users

  ## Overview
  Allow users to have multiple roles (e.g., both teacher and admin)
  
  ## Changes
  
  ### 1. New Table: `user_role_assignments`
  Junction table for multiple role assignments
  - `id` (uuid, primary key) - Unique identifier
  - `user_id` (uuid) - Reference to auth.users
  - `role` (text) - Role: super_admin, admin, teacher
  - `assigned_by` (uuid) - Who assigned this role
  - `assigned_at` (timestamptz) - When assigned
  - `is_active` (boolean) - Whether role is active
  
  ### 2. Migration Strategy
  - Create new table for role assignments
  - Copy existing roles to new table
  - Keep user_roles table for backward compatibility (will be used for primary contact info)
  - Add indexes for performance
  
  ## Security
  - Enable RLS on user_role_assignments
  - Users can read their own role assignments
  - Super admins can manage all role assignments
*/

-- Create user_role_assignments table
CREATE TABLE IF NOT EXISTS user_role_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('super_admin', 'admin', 'teacher')),
  assigned_by uuid REFERENCES auth.users(id),
  assigned_at timestamptz DEFAULT now(),
  is_active boolean DEFAULT true,
  UNIQUE(user_id, role)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_user_role_assignments_user_id ON user_role_assignments(user_id);
CREATE INDEX IF NOT EXISTS idx_user_role_assignments_role ON user_role_assignments(role);
CREATE INDEX IF NOT EXISTS idx_user_role_assignments_active ON user_role_assignments(user_id, is_active);

-- Enable RLS
ALTER TABLE user_role_assignments ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read their own role assignments
CREATE POLICY "Users can read own role assignments"
  ON user_role_assignments
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id AND is_active = true);

-- Migrate existing roles to new table
INSERT INTO user_role_assignments (user_id, role, assigned_by, assigned_at, is_active)
SELECT id, role, created_by, created_at, true
FROM user_roles
ON CONFLICT (user_id, role) DO NOTHING;

-- Create function to get user roles
CREATE OR REPLACE FUNCTION get_user_roles(user_uuid uuid)
RETURNS TABLE(role text) AS $$
BEGIN
  RETURN QUERY
  SELECT ura.role
  FROM user_role_assignments ura
  WHERE ura.user_id = user_uuid AND ura.is_active = true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to check if user has specific role
CREATE OR REPLACE FUNCTION user_has_role(user_uuid uuid, check_role text)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM user_role_assignments
    WHERE user_id = user_uuid 
    AND role = check_role 
    AND is_active = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add RLS policy for super admins to manage role assignments
CREATE POLICY "Super admins can manage role assignments"
  ON user_role_assignments
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_role_assignments ura
      WHERE ura.user_id = auth.uid() 
      AND ura.role = 'super_admin' 
      AND ura.is_active = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_role_assignments ura
      WHERE ura.user_id = auth.uid() 
      AND ura.role = 'super_admin' 
      AND ura.is_active = true
    )
  );
