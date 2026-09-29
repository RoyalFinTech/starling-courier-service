-- Final security and reporting indexes.
alter function public.set_updated_at() set search_path = pg_catalog;
create index if not exists idx_audit_logs_admin_user on public.audit_logs (admin_user_id, created_at desc);