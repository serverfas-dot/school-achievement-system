/*
# Harden legacy security objects

1. Access changes
- Anonymous visitors retain read-only access to public activity and achievement data.
- Anonymous INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, and TRIGGER privileges are removed from public-read tables.

2. View changes
- `user_is_super_admin` now uses invoker permissions so it cannot bypass the caller's row security rules.

3. Function changes
- Legacy privileged helper functions receive a fixed `search_path`.
- Direct public and anonymous execution is removed from trigger and calculation helpers.

4. Important notes
- These functions continue to run for their existing database triggers.
- No application records are deleted or changed by this migration.
*/

REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.activity_categories FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.sub_activities FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.student_achievements FROM anon;

CREATE OR REPLACE VIEW public.user_is_super_admin
WITH (security_invoker = true)
AS
SELECT user_id, true AS is_admin
FROM public.super_admins;

ALTER FUNCTION public.sync_super_admins() SET search_path = public;
ALTER FUNCTION public.calculate_activity_participation_percent() SET search_path = public;
ALTER FUNCTION public.calculate_attendance_percent() SET search_path = public;
ALTER FUNCTION public.calculate_two_activity_participation_percent() SET search_path = public;
ALTER FUNCTION public.calc_two_activity_percent(uuid) SET search_path = public;
ALTER FUNCTION public.calc_attendance_percent(uuid) SET search_path = public;
ALTER FUNCTION public.update_student_percentages() SET search_path = public;

REVOKE EXECUTE ON FUNCTION public.sync_super_admins() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.calculate_activity_participation_percent() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.calculate_attendance_percent() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.calculate_two_activity_participation_percent() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.calc_two_activity_percent(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.calc_attendance_percent(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_student_percentages() FROM PUBLIC, anon, authenticated;
