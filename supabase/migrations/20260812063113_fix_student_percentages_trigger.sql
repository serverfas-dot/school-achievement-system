/*
# Fix Student Percentages Trigger Function

## Problem
The `update_student_percentages()` trigger function called
`calculate_two_activity_participation_percent()` and
`calculate_attendance_percent()` as ordinary functions via PERFORM.
Those functions are declared `RETURNS TRIGGER` and reference the
`NEW`/`OLD` record variables, which only exist inside a trigger
context. Calling them as plain functions raised an exception on
every INSERT/UPDATE/DELETE against `student_achievements`, breaking
achievement creation, edits, and deletion.

## Fix
Rewrite `update_student_percentages()` to inline the logic of both
sub-functions so it no longer depends on trigger-only state. The
two sub-functions are replaced with plain helper functions that
accept a student id and return the computed percentage, so the
logic stays reusable and testable.

## Changes
1. Replace `calculate_two_activity_participation_percent()` with a
   plain function `calc_two_activity_percent(p_student_id uuid)`
   that returns `decimal(5,2)`.
2. Replace `calculate_attendance_percent()` with a plain function
   `calc_attendance_percent(p_student_id uuid)` that returns
   `decimal(5,2)`.
3. Rewrite `update_student_percentages()` to call the new helpers
   with the affected student id.
4. Recalculate percentages for all existing students so values are
   correct after the fix.
*/

CREATE OR REPLACE FUNCTION calc_two_activity_percent(p_student_id uuid)
RETURNS decimal(5,2) AS $$
DECLARE
  distinct_main_activities integer;
  calculated_percent decimal(5,2);
BEGIN
  SELECT COUNT(DISTINCT category_id) INTO distinct_main_activities
  FROM student_achievements
  WHERE student_id = p_student_id
    AND participation_status = 'participated';

  IF distinct_main_activities = 0 THEN
    calculated_percent := 0;
  ELSIF distinct_main_activities = 1 THEN
    calculated_percent := 50;
  ELSE
    calculated_percent := 100;
  END IF;

  RETURN calculated_percent;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION calc_attendance_percent(p_student_id uuid)
RETURNS decimal(5,2) AS $$
DECLARE
  total_main_activities integer;
  completed_main_activities integer;
  calculated_percent decimal(5,2);
BEGIN
  SELECT COUNT(*) INTO total_main_activities
  FROM activity_categories
  WHERE is_active = true;

  IF total_main_activities = 0 THEN
    calculated_percent := 0;
  ELSE
    SELECT COUNT(*) INTO completed_main_activities
    FROM (
      SELECT sa.category_id
      FROM student_achievements sa
      WHERE sa.student_id = p_student_id
        AND sa.participation_status = 'participated'
      GROUP BY sa.category_id
      HAVING COUNT(DISTINCT sa.sub_activity_id) >= 2
    ) AS completed_categories;

    calculated_percent := ROUND((completed_main_activities::decimal / total_main_activities::decimal) * 100, 2);
  END IF;

  RETURN calculated_percent;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION update_student_percentages()
RETURNS TRIGGER AS $$
DECLARE
  affected_student_id uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    affected_student_id := OLD.student_id;
  ELSE
    affected_student_id := NEW.student_id;
  END IF;

  UPDATE students
  SET
    two_activity_participation_percent = calc_two_activity_percent(affected_student_id),
    attendance_percent = calc_attendance_percent(affected_student_id)
  WHERE id = affected_student_id;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recalculate for all existing students
DO $$
DECLARE
  student_record RECORD;
BEGIN
  FOR student_record IN SELECT id FROM students LOOP
    UPDATE students
    SET
      two_activity_participation_percent = calc_two_activity_percent(student_record.id),
      attendance_percent = calc_attendance_percent(student_record.id)
    WHERE id = student_record.id;
  END LOOP;
END $$;
