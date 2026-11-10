-- Biblib database setup. Run once in Supabase: Dashboard > SQL Editor > New query > paste > Run.
-- Safe to re-run.

-- One row per project. The whole project (name, style, sources…) is stored as JSON in `data`.
create table if not exists public.projects (
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id         text not null check (id ~ '^[A-Za-z0-9_-]{1,40}$'),
  data       jsonb not null check (pg_column_size(data) < 2000000),
  position   integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

-- Row-level security: every query only ever sees the signed-in user's own rows.
alter table public.projects enable row level security;

drop policy if exists "Users read own projects" on public.projects;
create policy "Users read own projects" on public.projects
  for select to authenticated using (user_id = (select auth.uid()));

drop policy if exists "Users add own projects" on public.projects;
create policy "Users add own projects" on public.projects
  for insert to authenticated with check (user_id = (select auth.uid()));

drop policy if exists "Users update own projects" on public.projects;
create policy "Users update own projects" on public.projects
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

drop policy if exists "Users delete own projects" on public.projects;
create policy "Users delete own projects" on public.projects
  for delete to authenticated using (user_id = (select auth.uid()));

-- Lets a signed-in user delete their own account (their projects go with it via ON DELETE CASCADE).
-- The browser can't delete auth users directly, so this runs with elevated rights but only ever
-- touches the caller's own row.
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  delete from auth.users where id = auth.uid();
end;
$$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
