-- Supabase API security: application access is through the Starling Express API.
alter table public.shipments enable row level security;
alter table public.shipment_events enable row level security;
alter table public.quote_requests enable row level security;
alter table public.contact_messages enable row level security;
alter table public.admin_users enable row level security;
alter table public.audit_logs enable row level security;
alter table public.email_notifications enable row level security;
revoke all on table public.shipments, public.shipment_events, public.quote_requests, public.contact_messages, public.admin_users, public.audit_logs, public.email_notifications from anon, authenticated;
alter default privileges for role postgres in schema public revoke select, insert, update, delete on tables from anon, authenticated, service_role;
alter default privileges for role postgres in schema public revoke execute on functions from anon, authenticated, service_role;
alter default privileges for role postgres in schema public revoke usage, select on sequences from anon, authenticated, service_role;
alter default privileges for role postgres in schema public revoke execute on functions from public;
revoke execute on function public.rls_auto_enable() from public, anon, authenticated, service_role;
grant execute on function public.rls_auto_enable() to postgres;