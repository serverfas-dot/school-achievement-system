/*
  # Fix Two Activity Participation and Attendance Percentage Separation

  ## Changes
  1. Add new column `two_activity_participation_percent` to students table
  2. Separate calculations:
     - Two Activity Participation: Based on number of distinct main activities participated
       * 0 main activities = 0%
       * 1 main activity = 50%
       * 2 or more main activities = 100%
     - Attendance Percentage: Based on participating in at least 2 sub-activities per main activity
       * (main_activities_with_2+_subs / total_main_activities) * 100
  
  ## Logic
  - Two Activity Participation counts DISTINCT main activities (categories) student participated in
  - Attendance Percentage requires 2+ sub-activities per main activity
*/

-- Add new column for two activity participation percentage
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'students' AND column_name = 'two_activity_participation_percent'
  ) THEN
    ALTER TABLE students ADD COLUMN two_activity_participation_percent decimal(5,2) DEFAULT 0;
  END IF;
END $$;

-- Function to calculate two activity participation (distinct main activities)
CREATE OR REPLACE FUNCTION calculate_two_activity_participation_percent()
RETURNS TRIGGER AS $$
DECLARE
  distinct_main_activities integer;
  calculated_percent decimal(5,2);
  affected_student_id uuid;
BEGIN
  -- Determine which student_id to update
  IF TG_OP = 'DELETE' THEN
    affected_student_id := OLD.student_id;
  ELSE
    affected_student_id := NEW.student_id;
  END IF;

  -- Count distinct main activities (categories) where student participated
  SELECT COUNT(DISTINCT category_id) INTO distinct_main_activities
  FROM student_achievements
  WHERE student_id = affected_student_id
    AND participation_status = 'participated';

  -- Calculate percentage: 0 activities = 0%, 1 activity = 50%, 2+ = 100%
  IF distinct_main_activities = 0 THEN
    calculated_percent := 0;
  ELSIF distinct_main_activities = 1 THEN
    calculated_percent := 50;
  ELSE
    calculated_percent := 100;
  END IF;

  -- Update student record
  UPDATE students
  SET two_activity_participation_percent = calculated_percent
  WHERE id = affected_student_id;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to calculate attendance based on 2+ sub-activities per main activity
CREATE OR REPLACE FUNCTION calculate_attendance_percent()
RETURNS TRIGGER AS $$
DECLARE
  total_main_activities integer;
  completed_main_activities integer;
  calculated_percent decimal(5,2);
  affected_student_id uuid;
BEGIN
  -- Determine which student_id to update
  IF TG_OP = 'DELETE' THEN
    affected_student_id := OLD.student_id;
  ELSE
    affected_student_id := NEW.student_id;
  END IF;

  -- Count total active main activities
  SELECT COUNT(*) INTO total_main_activities
  FROM activity_categories
  WHERE is_active = true;

  -- If no active main activities, set to 0
  IF total_main_activities = 0 THEN
    calculated_percent := 0;
  ELSE
    -- Count how many main activities have at least 2 sub-activities participated
    SELECT COUNT(*) INTO completed_main_activities
    FROM (
      SELECT sa.category_id
      FROM student_achievements sa
      WHERE sa.student_id = affected_student_id
        AND sa.participation_status = 'participated'
      GROUP BY sa.category_id
      HAVING COUNT(DISTINCT sa.sub_activity_id) >= 2
    ) AS completed_categories;

    -- Calculate percentage
    calculated_percent := ROUND((completed_main_activities::decimal / total_main_activities::decimal) * 100, 2);
  END IF;

  -- Update student record
  UPDATE students
  SET attendance_percent = calculated_percent
  WHERE id = affected_student_id;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Combined trigger function to update both percentages
CREATE OR REPLACE FUNCTION update_student_percentages()
RETURNS TRIGGER AS $$
DECLARE
  affected_student_id uuid;
BEGIN
  -- Determine which student_id to update
  IF TG_OP = 'DELETE' THEN
    affected_student_id := OLD.student_id;
  ELSE
    affected_student_id := NEW.student_id;
  END IF;

  -- Calculate two activity participation
  PERFORM calculate_two_activity_participation_percent();
  
  -- Calculate attendance
  PERFORM calculate_attendance_percent();

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop old triggers
DROP TRIGGER IF EXISTS update_activity_participation_trigger ON student_achievements;

-- Create new combined trigger
CREATE TRIGGER update_student_percentages_trigger
  AFTER INSERT OR UPDATE OR DELETE ON student_achievements
  FOR EACH ROW
  EXECUTE FUNCTION update_student_percentages();

-- Recalculate for all existing students
DO $$
DECLARE
  student_record RECORD;
  distinct_main_activities integer;
  total_main_activities integer;
  completed_main_activities integer;
  calc_two_activity_percent decimal(5,2);
  calc_attendance_percent decimal(5,2);
BEGIN
  -- Get total active main activities
  SELECT COUNT(*) INTO total_main_activities
  FROM activity_categories
  WHERE is_active = true;

  -- Process each student
  FOR student_record IN SELECT id FROM students LOOP
    -- Calculate two activity participation (distinct main activities)
    SELECT COUNT(DISTINCT category_id) INTO distinct_main_activities
    FROM student_achievements
    WHERE student_id = student_record.id
      AND participation_status = 'participated';

    IF distinct_main_activities = 0 THEN
      calc_two_activity_percent := 0;
    ELSIF distinct_main_activities = 1 THEN
      calc_two_activity_percent := 50;
    ELSE
      calc_two_activity_percent := 100;
    END IF;

    -- Calculate attendance (2+ sub-activities per main activity)
    IF total_main_activities = 0 THEN
      calc_attendance_percent := 0;
    ELSE
      SELECT COUNT(*) INTO completed_main_activities
      FROM (
        SELECT sa.category_id
        FROM student_achievements sa
        WHERE sa.student_id = student_record.id
          AND sa.participation_status = 'participated'
        GROUP BY sa.category_id
        HAVING COUNT(DISTINCT sa.sub_activity_id) >= 2
      ) AS completed_categories;

      calc_attendance_percent := ROUND((completed_main_activities::decimal / total_main_activities::decimal) * 100, 2);
    END IF;

    -- Update student
    UPDATE students
    SET 
      two_activity_participation_percent = calc_two_activity_percent,
      attendance_percent = calc_attendance_percent
    WHERE id = student_record.id;
  END LOOP;
END $$;
