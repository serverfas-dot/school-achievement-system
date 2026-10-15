/*
  # Update Activity Participation to Two Activity Participation Logic

  ## Changes
  1. Update function to calculate percentage based on participation in at least 2 sub-activities per main activity
  2. Logic: 100% if student participated in at least 2 sub-activities for EACH active main activity
  
  ## Calculation Logic
  - For each active main activity (category):
    - Count how many sub-activities the student participated in
    - If count >= 2, this main activity counts as "completed"
  - Percentage = (completed_main_activities / total_active_main_activities) * 100
  - If no active main activities exist, percentage = 0
*/

-- Update function to calculate based on two sub-activities per main activity
CREATE OR REPLACE FUNCTION calculate_activity_participation_percent()
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
  SET activity_participation_percent = calculated_percent
  WHERE id = affected_student_id;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recalculate for all existing students
DO $$
DECLARE
  student_record RECORD;
  total_main_activities integer;
  completed_main_activities integer;
  calculated_percent decimal(5,2);
BEGIN
  -- Get total active main activities
  SELECT COUNT(*) INTO total_main_activities
  FROM activity_categories
  WHERE is_active = true;

  -- Process each student
  FOR student_record IN SELECT id FROM students LOOP
    IF total_main_activities = 0 THEN
      calculated_percent := 0;
    ELSE
      -- Count main activities with at least 2 sub-activities participated
      SELECT COUNT(*) INTO completed_main_activities
      FROM (
        SELECT sa.category_id
        FROM student_achievements sa
        WHERE sa.student_id = student_record.id
          AND sa.participation_status = 'participated'
        GROUP BY sa.category_id
        HAVING COUNT(DISTINCT sa.sub_activity_id) >= 2
      ) AS completed_categories;

      -- Calculate percentage
      calculated_percent := ROUND((completed_main_activities::decimal / total_main_activities::decimal) * 100, 2);
    END IF;

    -- Update student
    UPDATE students
    SET activity_participation_percent = calculated_percent
    WHERE id = student_record.id;
  END LOOP;
END $$;
