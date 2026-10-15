/*
  # Fix RLS Infinite Recursion on user_roles Table

  ## Problem
  The SELECT policy for user_roles creates infinite recursion because it queries
  the same table it's protecting to check if the user is a super_admin.

  ## Solution
  Add a policy that allows authenticated users to read their own role record.
  This breaks the recursion by providing a direct path to read one's own role
  without needing to check other records in the same table.

  ## Changes
  1. Add policy for users to read their own role record
  2. Keep existing super_admin policy for viewing all users
*/

-- Add policy for users to read their own role
CREATE POLICY "Users can read own role"
  ON user_roles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);
