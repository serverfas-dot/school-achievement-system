/*
  # Fix All Table RLS Policies for Multi-Role System

  ## Problem
  Many tables are checking user_roles table which only has one role per user.
  Need to check user_role_assignments for proper multi-role support.

  ## Changes
  Update RLS policies for:
  - sub_activities
  - students
  - attendance_records
  - student_achievements
  
  All policies will now check user_role_assignments table.
*/

-- Fix sub_activities policies
DROP POLICY IF EXISTS "Admin can manage sub activities" ON sub_activities;

CREATE POLICY "Admins can manage sub activities"
  ON sub_activities
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_role_assignments
      WHERE user_id = auth.uid()
      AND role IN ('super_admin', 'admin')
      AND is_active = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_role_assignments
      WHERE user_id = auth.uid()
      AND role IN ('super_admin', 'admin')
      AND is_active = true
    )
  );

-- Fix students policies
DROP POLICY IF EXISTS "Admin can manage students" ON students;

CREATE POLICY "Admins can manage students"
  ON students
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_role_assignments
      WHERE user_id = auth.uid()
      AND role IN ('super_admin', 'admin')
      AND is_active = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_role_assignments
      WHERE user_id = auth.uid()
      AND role IN ('super_admin', 'admin')
      AND is_active = true
    )
  );

-- Fix attendance_records policies
DROP POLICY IF EXISTS "Teachers can manage attendance" ON attendance_records;

CREATE POLICY "Teachers can manage attendance"
  ON attendance_records
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_role_assignments
      WHERE user_id = auth.uid()
      AND role IN ('super_admin', 'admin', 'teacher')
      AND is_active = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_role_assignments
      WHERE user_id = auth.uid()
      AND role IN ('super_admin', 'admin', 'teacher')
      AND is_active = true
    )
  );

-- Fix student_achievements policies
DROP POLICY IF EXISTS "Teachers can manage achievements" ON student_achievements;

CREATE POLICY "Teachers can manage achievements"
  ON student_achievements
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_role_assignments
      WHERE user_id = auth.uid()
      AND role IN ('super_admin', 'admin', 'teacher')
      AND is_active = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_role_assignments
      WHERE user_id = auth.uid()
      AND role IN ('super_admin', 'admin', 'teacher')
      AND is_active = true
    )
  );
