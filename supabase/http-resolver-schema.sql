create table public.mox_http_resolver_control (
 id boolean primary key default true check(id),
 lease_until timestamptz,
 next_run_at timestamptz not null default now()
);
create table public.mox_http_resolver_runs (
 id uuid primary key default gen_random_uuid(),
 requested_at timestamptz not null default now(),
 source_id text not null,
 operation text not null check(operation in ('resolve','renewal_probe')),
 result text not null,
 evidence jsonb not null default '{}'::jsonb
);
alter table public.mox_http_resolver_control enable row level security;
alter table public.mox_http_resolver_runs enable row level security;
revoke all on public.mox_http_resolver_control, public.mox_http_resolver_runs from anon,authenticated;
grant all on public.mox_http_resolver_control, public.mox_http_resolver_runs to service_role;
create policy http_worker_only on public.mox_http_resolver_control for all to service_role using(true) with check(true);
create policy http_worker_only on public.mox_http_resolver_runs for all to service_role using(true) with check(true);
insert into public.mox_http_resolver_control(id) values(true);
create function public.mox_claim_http_resolution() returns boolean language plpgsql security invoker set search_path='' as $$
begin
 update public.mox_http_resolver_control set lease_until=now()+interval '120 seconds',next_run_at=now()+interval '120 seconds'
 where id=true and next_run_at<=now() and (lease_until is null or lease_until<now());
 return found;
end $$;
revoke all on function public.mox_claim_http_resolution() from public,anon,authenticated;
grant execute on function public.mox_claim_http_resolution() to service_role;
