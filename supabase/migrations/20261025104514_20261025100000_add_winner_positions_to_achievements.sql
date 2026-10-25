/*
# Replace achievement scoring with winner positions

1. Modified Tables
- `student_achievements.winner_position` stores 1, 2, or 3 when a student wins an activity, or NULL when the record is participation only.
- Existing `score` data is retained for historical compatibility and is no longer used by the new achievement screens.

2. Application behavior
- Winner 1 is worth 3 points, Winner 2 is worth 2 points, and Winner 3 is worth 1 point.
- A student's total winner points are calculated by adding all winner positions across activities.

3. Security
- The existing authenticated role policies remain in place for this column.
- Anonymous public reads continue to use the existing achievement read policy.

4. Data safety
- This migration only adds a nullable column and index.
- Existing achievements, attendance records, and scores are not deleted or rewritten.
*/

ALTER TABLE public.student_achievements
  ADD COLUMN IF NOT EXISTS winner_position smallint;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'student_achievements_winner_position_check'
      AND conrelid = 'public.student_achievements'::regclass
  ) THEN
    ALTER TABLE public.student_achievements
      ADD CONSTRAINT student_achievements_winner_position_check
      CHECK (winner_position IS NULL OR winner_position IN (1, 2, 3));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_student_achievements_winner_position
  ON public.student_achievements(student_id, winner_position)
  WHERE winner_position IS NOT NULL;
