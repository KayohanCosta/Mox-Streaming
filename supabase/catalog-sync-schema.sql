create table if not exists public.mox_catalog_sync_state (
 id boolean primary key default true check(id),
 active boolean not null default true,
 lease_id uuid,
 next_run_at timestamptz not null default now(),
 lease_until timestamptz,
 started_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 last_error text
);
create table if not exists public.mox_catalog_sync_queue (
 url text primary key,
 state text not null default 'pending' check(state in ('pending','done','blocked')),
 attempts integer not null default 0,
 discovered_at timestamptz not null default now(),
 processed_at timestamptz,
 last_error text
);
alter table public.mox_catalog_sync_state enable row level security;
alter table public.mox_catalog_sync_queue enable row level security;
revoke all on public.mox_catalog_sync_state,public.mox_catalog_sync_queue from anon,authenticated;
grant all on public.mox_catalog_sync_state,public.mox_catalog_sync_queue to service_role;
insert into public.mox_catalog_sync_state(id) values(true) on conflict do nothing;
insert into public.mox_catalog_sync_queue(url) values('https://redecanais.by/'),('https://redecanais.by/browse.html') on conflict do nothing;
insert into public.mox_catalog_sync_queue(url)
select page_url from public.mox_catalog where site='vod' and (kind='series' or page_url ~ '^https://redecanais.by/browse-[^/]+-videos-[0-9]+-date.html$') on conflict do nothing;
create or replace function public.mox_claim_catalog_sync() returns uuid language plpgsql security invoker set search_path='' as $$
declare token uuid;
begin
 update public.mox_catalog_sync_state set lease_id=gen_random_uuid(),next_run_at=now()+interval '60 seconds',lease_until=now()+interval '120 seconds',updated_at=now()
 where id=true and active and next_run_at<=now() and (lease_until is null or lease_until<now()) returning lease_id into token;
 return token;
end $$;
revoke all on function public.mox_claim_catalog_sync() from public,anon,authenticated;
grant execute on function public.mox_claim_catalog_sync() to service_role;

create or replace function public.mox_catalog_sync_status() returns jsonb language sql stable security invoker set search_path='' as $$
select jsonb_build_object('active',s.active,'started_at',s.started_at,'updated_at',s.updated_at,'last_error',s.last_error,
'pages',jsonb_build_object('pending',(select count(*) from public.mox_catalog_sync_queue where state='pending'),'done',(select count(*) from public.mox_catalog_sync_queue where state='done'),'blocked',(select count(*) from public.mox_catalog_sync_queue where state='blocked')),
'complete',not exists(select 1 from public.mox_catalog_sync_queue where state<>'done') and exists(select 1 from public.mox_catalog_sync_queue where state='done'),
'scope','discovered_catalog_pages_only','playback_validated',false) from public.mox_catalog_sync_state s where id=true;
$$;
revoke all on function public.mox_catalog_sync_status() from public,anon,authenticated;
grant execute on function public.mox_catalog_sync_status() to service_role;

-- These queues are only accessible to the server-side worker.
create policy sync_worker_only on public.mox_catalog_sync_state for all to service_role using (true) with check (true);
create policy sync_worker_only on public.mox_catalog_sync_queue for all to service_role using (true) with check (true);
