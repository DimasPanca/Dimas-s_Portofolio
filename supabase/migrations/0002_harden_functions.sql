-- Hardening after the first security advisor run.
--
-- * before_write: pin the search_path (it only uses built-ins and NEW, so an empty path is safe).
-- * audit_row: a trigger function; nobody needs to call it through the REST API, so remove EXECUTE.
-- * is_owner is intentionally left callable by anon/authenticated: RLS policies call it as the current
--   role, and it only answers "is the caller the owner?" for the caller's own token.

alter function public.before_write() set search_path = '';

revoke all on function public.audit_row() from public, anon, authenticated;
