/*
  # Update Activity Participation Percentage Calculation

  ## Changes
  1. Add new column `activity_participation_percent` to students table
  2. Create function to calculate percentage based on distinct activities participated
     - 0 activities = 0%
     - 1 activity = 50%
     - 2 or more activities = 100%
  3. Create trigger to automatically update percentage when achievements change
  
  ## Calculation Logic
  - Counts distinct sub_activities where participation_status = 'participated'
  - Updates student record with calculated percentage
*/

-- Add new column for activity participation percentage
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'students' AND column_name = 'activity_participation_percent'
  ) THEN
    ALTER TABLE students ADD COLUMN activity_participation_percent decimal(5,2) DEFAULT 0;
  END IF;
END $$;

-- Create function to calculate and update activity participation percentage
CREATE OR REPLACE FUNCTION calculate_activity_participation_percent()
RETURNS TRIGGER AS $$
DECLARE
  distinct_activities_count integer;
  calculated_percent decimal(5,2);
  affected_student_id uuid;
BEGIN
  -- Determine which student_id to update
  IF TG_OP = 'DELETE' THEN
    affected_student_id := OLD.student_id;
  ELSE
    affected_student_id := NEW.student_id;
  END IF;

  -- Count distinct activities where student participated
  SELECT COUNT(DISTINCT sub_activity_id) INTO distinct_activities_count
  FROM student_achievements
  WHERE student_id = affected_student_id
    AND participation_status = 'participated';

  -- Calculate percentage based on count
  IF distinct_activities_count = 0 THEN
    calculated_percent := 0;
  ELSIF distinct_activities_count = 1 THEN
    calculated_percent := 50;
  ELSE
    calculated_percent := 100;
  END IF;

  -- Update student record
  UPDATE students
  SET activity_participation_percent = calculated_percent
  WHERE id = affected_student_id;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if exists
DROP TRIGGER IF EXISTS update_activity_participation_trigger ON student_achievements;

-- Create trigger on student_achievements table
CREATE TRIGGER update_activity_participation_trigger
  AFTER INSERT OR UPDATE OR DELETE ON student_achievements
  FOR EACH ROW
  EXECUTE FUNCTION calculate_activity_participation_percent();

-- Initial calculation for all existing students
DO $$
DECLARE
  student_record RECORD;
  distinct_activities_count integer;
  calculated_percent decimal(5,2);
BEGIN
  FOR student_record IN SELECT id FROM students LOOP
    -- Count distinct activities
    SELECT COUNT(DISTINCT sub_activity_id) INTO distinct_activities_count
    FROM student_achievements
    WHERE student_id = student_record.id
      AND participation_status = 'participated';

    -- Calculate percentage
    IF distinct_activities_count = 0 THEN
      calculated_percent := 0;
    ELSIF distinct_activities_count = 1 THEN
      calculated_percent := 50;
    ELSE
      calculated_percent := 100;
    END IF;

    -- Update student
    UPDATE students
    SET activity_participation_percent = calculated_percent
    WHERE id = student_record.id;
  END LOOP;
END $$;
