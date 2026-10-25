/*
# Lock the super-admin registry

1. Security change
- Enables row-level security on `super_admins`.
- Removes direct anonymous and signed-in client access because the registry is only an internal authorization source.

2. Important notes
- Existing SECURITY DEFINER authorization helpers continue to read this table.
- No rows are deleted or modified.
*/

ALTER TABLE public.super_admins ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.super_admins FROM anon, authenticated;
