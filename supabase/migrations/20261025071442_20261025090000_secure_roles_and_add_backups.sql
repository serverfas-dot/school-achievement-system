/*
# Secure role management and add protected backups

1. New Tables
- `backup_settings` stores the single school-wide schedule configuration for daily and monthly automatic backups.
- `system_backups` stores JSON snapshots of student, activity, achievement, and attendance data for download and restoration.

2. Modified Access Rules
- Replaces broad authenticated role-table policies with super-admin-only write policies and self-read policies.
- Removes anonymous Data API access from role, attendance, and backup tables.
- Limits anonymous student reads to public profile columns only; private identity and contact columns remain available only to signed-in staff.
- Keeps public achievement and activity browsing available for the existing public portal.

3. Functions
- `create_system_backup` creates a snapshot for a manual, daily, or monthly backup.
- `restore_system_backup` replaces the school data tables with a selected snapshot after a super-admin check.
- Existing role-checking functions receive a fixed search path and restricted execute grants.

4. Automatic Backups
- Enables the available `pg_cron` extension.
- Schedules daily and monthly snapshot jobs. The settings table controls whether each schedule is active.

5. Important Notes
- Backups contain application data only. Supabase authentication passwords are never exportable and are intentionally not included.
- Restore is an explicit super-admin action and runs as one database operation so a failed restore does not leave a partial snapshot.
*/

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;

CREATE TABLE IF NOT EXISTS public.backup_settings (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  daily_enabled boolean NOT NULL DEFAULT true,
  monthly_enabled boolean NOT NULL DEFAULT true,
  updated_by uuid REFERENCES auth.users(id),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.backup_settings (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.system_backups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  backup_type text NOT NULL CHECK (backup_type IN ('manual', 'daily', 'monthly')),
  file_name text NOT NULL,
  snapshot jsonb NOT NULL,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_system_backups_created_at ON public.system_backups(created_at DESC);

ALTER TABLE public.backup_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_backups ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.backup_settings FROM anon;
REVOKE ALL ON public.system_backups FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.backup_settings TO authenticated;
GRANT SELECT ON public.system_backups TO authenticated;

DROP POLICY IF EXISTS "super_admin_select_backup_settings" ON public.backup_settings;
CREATE POLICY "super_admin_select_backup_settings" ON public.backup_settings FOR SELECT TO authenticated USING (public.is_super_admin_check());
DROP POLICY IF EXISTS "super_admin_insert_backup_settings" ON public.backup_settings;
CREATE POLICY "super_admin_insert_backup_settings" ON public.backup_settings FOR INSERT TO authenticated WITH CHECK (public.is_super_admin_check());
DROP POLICY IF EXISTS "super_admin_update_backup_settings" ON public.backup_settings;
CREATE POLICY "super_admin_update_backup_settings" ON public.backup_settings FOR UPDATE TO authenticated USING (public.is_super_admin_check()) WITH CHECK (public.is_super_admin_check());
DROP POLICY IF EXISTS "super_admin_delete_backup_settings" ON public.backup_settings;
CREATE POLICY "super_admin_delete_backup_settings" ON public.backup_settings FOR DELETE TO authenticated USING (public.is_super_admin_check());

DROP POLICY IF EXISTS "super_admin_select_system_backups" ON public.system_backups;
CREATE POLICY "super_admin_select_system_backups" ON public.system_backups FOR SELECT TO authenticated USING (public.is_super_admin_check());

DROP POLICY IF EXISTS "Authenticated users can manage user_roles" ON public.user_roles;
DROP POLICY IF EXISTS "Super admin can view all users" ON public.user_roles;
DROP POLICY IF EXISTS "Super admin can insert users" ON public.user_roles;
DROP POLICY IF EXISTS "Super admin can update users" ON public.user_roles;
DROP POLICY IF EXISTS "Super admin can delete users" ON public.user_roles;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_roles TO authenticated;
REVOKE ALL ON public.user_roles FROM anon;

CREATE POLICY "users_read_own_or_super_admin" ON public.user_roles FOR SELECT TO authenticated
USING (id = auth.uid() OR public.is_super_admin_check());
CREATE POLICY "super_admin_insert_user_roles" ON public.user_roles FOR INSERT TO authenticated
WITH CHECK (public.is_super_admin_check());
CREATE POLICY "super_admin_update_user_roles" ON public.user_roles FOR UPDATE TO authenticated
USING (public.is_super_admin_check()) WITH CHECK (public.is_super_admin_check());
CREATE POLICY "super_admin_delete_user_roles" ON public.user_roles FOR DELETE TO authenticated
USING (public.is_super_admin_check());

DROP POLICY IF EXISTS "Authenticated users can manage role assignments" ON public.user_role_assignments;
DROP POLICY IF EXISTS "Users can read own role assignments" ON public.user_role_assignments;
DROP POLICY IF EXISTS "Super admins can manage role assignments" ON public.user_role_assignments;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_role_assignments TO authenticated;
REVOKE ALL ON public.user_role_assignments FROM anon;

CREATE POLICY "users_read_own_or_super_admin_assignments" ON public.user_role_assignments FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.is_super_admin_check());
CREATE POLICY "super_admin_insert_role_assignments" ON public.user_role_assignments FOR INSERT TO authenticated
WITH CHECK (public.is_super_admin_check());
CREATE POLICY "super_admin_update_role_assignments" ON public.user_role_assignments FOR UPDATE TO authenticated
USING (public.is_super_admin_check()) WITH CHECK (public.is_super_admin_check());
CREATE POLICY "super_admin_delete_role_assignments" ON public.user_role_assignments FOR DELETE TO authenticated
USING (public.is_super_admin_check());

REVOKE ALL ON public.attendance_records FROM anon;
REVOKE ALL ON public.super_admins FROM anon;
REVOKE ALL ON public.user_is_super_admin FROM anon;

REVOKE ALL ON public.students FROM anon;
GRANT SELECT (id, student_name, index_number, grade, gender, club, house, position, attendance_percent, activity_participation_percent, two_activity_participation_percent, profile_picture_url) ON public.students TO anon;

ALTER FUNCTION public.get_user_roles(uuid) SET search_path = public;
ALTER FUNCTION public.user_has_role(uuid, text) SET search_path = public;
ALTER FUNCTION public.is_super_admin(uuid) SET search_path = public;
ALTER FUNCTION public.is_super_admin_check() SET search_path = public;
REVOKE EXECUTE ON FUNCTION public.get_user_roles(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.user_has_role(uuid, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_super_admin(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_super_admin_check() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_user_roles(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_has_role(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_super_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_super_admin_check() TO authenticated;

CREATE OR REPLACE FUNCTION public.create_system_backup(p_backup_type text DEFAULT 'manual')
RETURNS TABLE(id uuid, file_name text, snapshot jsonb)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_id uuid;
  v_file_name text;
  v_snapshot jsonb;
  v_allowed boolean;
BEGIN
  IF p_backup_type NOT IN ('manual', 'daily', 'monthly') THEN
    RAISE EXCEPTION 'Invalid backup type';
  END IF;

  IF auth.uid() IS NOT NULL AND NOT public.is_super_admin_check() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  IF p_backup_type = 'daily' THEN
    SELECT daily_enabled INTO v_allowed FROM public.backup_settings WHERE backup_settings.id = 1;
    IF NOT COALESCE(v_allowed, true) THEN RETURN; END IF;
  ELSIF p_backup_type = 'monthly' THEN
    SELECT monthly_enabled INTO v_allowed FROM public.backup_settings WHERE backup_settings.id = 1;
    IF NOT COALESCE(v_allowed, true) THEN RETURN; END IF;
  END IF;

  v_snapshot := jsonb_build_object(
    'version', 1,
    'created_at', now(),
    'students', COALESCE((SELECT jsonb_agg(to_jsonb(s)) FROM public.students s), '[]'::jsonb),
    'activity_categories', COALESCE((SELECT jsonb_agg(to_jsonb(c)) FROM public.activity_categories c), '[]'::jsonb),
    'sub_activities', COALESCE((SELECT jsonb_agg(to_jsonb(a)) FROM public.sub_activities a), '[]'::jsonb),
    'student_achievements', COALESCE((SELECT jsonb_agg(to_jsonb(a)) FROM public.student_achievements a), '[]'::jsonb),
    'attendance_records', COALESCE((SELECT jsonb_agg(to_jsonb(a)) FROM public.attendance_records a), '[]'::jsonb)
  );

  v_file_name := 'school-backup-' || to_char(now(), 'YYYY-MM-DD-HH24MISS') || '.json';
  INSERT INTO public.system_backups (backup_type, file_name, snapshot, created_by)
  VALUES (p_backup_type, v_file_name, v_snapshot, auth.uid())
  RETURNING system_backups.id INTO v_id;

  RETURN QUERY SELECT v_id, v_file_name, v_snapshot;
END;
$function$;

CREATE OR REPLACE FUNCTION public.restore_system_backup(p_backup_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_snapshot jsonb;
BEGIN
  IF NOT public.is_super_admin_check() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT snapshot INTO v_snapshot FROM public.system_backups WHERE id = p_backup_id;
  IF v_snapshot IS NULL THEN
    RAISE EXCEPTION 'Backup not found';
  END IF;

  DELETE FROM public.student_achievements;
  DELETE FROM public.attendance_records;
  DELETE FROM public.sub_activities;
  DELETE FROM public.activity_categories;
  DELETE FROM public.students;

  INSERT INTO public.activity_categories SELECT * FROM jsonb_populate_recordset(NULL::public.activity_categories, v_snapshot->'activity_categories');
  INSERT INTO public.sub_activities SELECT * FROM jsonb_populate_recordset(NULL::public.sub_activities, v_snapshot->'sub_activities');
  INSERT INTO public.students SELECT * FROM jsonb_populate_recordset(NULL::public.students, v_snapshot->'students');
  INSERT INTO public.student_achievements SELECT * FROM jsonb_populate_recordset(NULL::public.student_achievements, v_snapshot->'student_achievements');
  INSERT INTO public.attendance_records SELECT * FROM jsonb_populate_recordset(NULL::public.attendance_records, v_snapshot->'attendance_records');
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.create_system_backup(text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.restore_system_backup(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_system_backup(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.restore_system_backup(uuid) TO authenticated;

DO $scheduler$
DECLARE
  v_job_id bigint;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    FOR v_job_id IN SELECT jobid FROM cron.job WHERE jobname IN ('school-daily-backup', 'school-monthly-backup') LOOP
      PERFORM cron.unschedule(v_job_id);
    END LOOP;
    PERFORM cron.schedule('school-daily-backup', '0 2 * * *', $job$SELECT public.create_system_backup('daily');$job$);
    PERFORM cron.schedule('school-monthly-backup', '0 3 1 * *', $job$SELECT public.create_system_backup('monthly');$job$);
  END IF;
END
$scheduler$;
