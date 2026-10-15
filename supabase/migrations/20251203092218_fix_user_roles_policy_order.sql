/*
  # Fix User Roles RLS Policy Evaluation Order

  ## Problem
  Multiple SELECT policies on user_roles cause infinite recursion because
  PostgreSQL evaluates all policies, and the super_admin check queries
  the same table.

  ## Solution
  Drop the recursive super_admin SELECT policy and rely on the simpler
  "users can read own role" policy. Super admins will still be able to
  read their own role, and we'll add a different approach for viewing
  all users later if needed.

  ## Changes
  1. Drop the problematic "Super admin can view all users" policy
  2. Keep "Users can read own role" policy
*/

-- Drop the problematic policy that causes recursion
DROP POLICY IF EXISTS "Super admin can view all users" ON user_roles;
