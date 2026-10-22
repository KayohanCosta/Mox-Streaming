create table if not exists public.mox_catalog (
 id text primary key check (id ~ '^[a-f0-9]{24}$'),
 title text not null,
 kind text not null,
 site text not null check (site in ('vod','tv')),
 page_url text not null check (page_url like 'https://%'),
 metadata jsonb not null default '{}'::jsonb,
 updated_at timestamptz not null default now()
);
create index if not exists mox_catalog_site_kind_idx on public.mox_catalog(site,kind);
create table if not exists public.mox_movie_mappings (
 tmdb_id integer primary key check (tmdb_id > 0),
 metadata jsonb not null,
 updated_at timestamptz not null default now()
);
create table if not exists public.mox_origins (
 site text primary key check (site in ('vod','tv')),
 metadata jsonb not null,
 updated_at timestamptz not null default now()
);
create table if not exists public.mox_profiles (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
 name text not null check (length(btrim(name)) between 1 and 24),
 color smallint not null default 0 check (color between 0 and 4),
 created_at timestamptz not null default now(),
 unique(id,owner_id)
);
create index if not exists mox_profiles_owner_idx on public.mox_profiles(owner_id);
create table if not exists public.mox_profile_progress (
 profile_id uuid not null,
 owner_id uuid not null default auth.uid(),
 media_key text not null check (length(media_key) between 1 and 100),
 metadata jsonb not null,
 updated_at timestamptz not null default now(),
 primary key(profile_id,media_key),
 foreign key(profile_id,owner_id) references public.mox_profiles(id,owner_id) on delete cascade
);
create index if not exists mox_profile_progress_owner_idx on public.mox_profile_progress(owner_id);
create table if not exists public.mox_profile_favorites (
 profile_id uuid not null,
 owner_id uuid not null default auth.uid(),
 media_key text not null check (length(media_key) between 1 and 100),
 metadata jsonb not null,
 created_at timestamptz not null default now(),
 primary key(profile_id,media_key),
 foreign key(profile_id,owner_id) references public.mox_profiles(id,owner_id) on delete cascade
);
create index if not exists mox_profile_favorites_owner_idx on public.mox_profile_favorites(owner_id);

alter table public.mox_catalog enable row level security;
revoke all on public.mox_catalog from anon, authenticated;
grant select on public.mox_catalog to anon, authenticated;
drop policy if exists catalog_read on public.mox_catalog;
create policy catalog_read on public.mox_catalog for select to anon, authenticated using (true);

alter table public.mox_movie_mappings enable row level security;
revoke all on public.mox_movie_mappings from anon, authenticated;
grant select on public.mox_movie_mappings to anon, authenticated;
drop policy if exists catalog_read on public.mox_movie_mappings;
create policy catalog_read on public.mox_movie_mappings for select to anon, authenticated using (true);

alter table public.mox_origins enable row level security;
revoke all on public.mox_origins from anon, authenticated;
grant select on public.mox_origins to anon, authenticated;
drop policy if exists catalog_read on public.mox_origins;
create policy catalog_read on public.mox_origins for select to anon, authenticated using (true);

alter table public.mox_profiles enable row level security;
revoke all on public.mox_profiles from anon, authenticated;
grant select, insert, update, delete on public.mox_profiles to authenticated;
drop policy if exists owner_access on public.mox_profiles;
create policy owner_access on public.mox_profiles for all to authenticated
using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);

alter table public.mox_profile_progress enable row level security;
revoke all on public.mox_profile_progress from anon, authenticated;
grant select, insert, update, delete on public.mox_profile_progress to authenticated;
drop policy if exists owner_access on public.mox_profile_progress;
create policy owner_access on public.mox_profile_progress for all to authenticated
using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);

alter table public.mox_profile_favorites enable row level security;
revoke all on public.mox_profile_favorites from anon, authenticated;
grant select, insert, update, delete on public.mox_profile_favorites to authenticated;
drop policy if exists owner_access on public.mox_profile_favorites;
create policy owner_access on public.mox_profile_favorites for all to authenticated
using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
