-- Reading Record: security rules for the static site.
-- The site now talks to Supabase straight from the browser with the publishable key, so
-- Supabase itself must decide who may change things:
--   * everyone may read the library (media, notes, experiences), as before;
--   * only addresses listed in public.site_admins may add, edit or delete.
-- Run once in Supabase → SQL Editor. Safe to run again.

create table if not exists public.site_admins (
  email text primary key
);
-- No policies on site_admins: the list can't be read or changed through the API.
alter table public.site_admins enable row level security;

-- True when the signed-in caller's email is in site_admins.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.site_admins
    where lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

do $$
declare
  t text;
begin
  foreach t in array array['media', 'notes', 'experiences'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "Anyone can read" on public.%I', t);
    execute format('drop policy if exists "Admin can write" on public.%I', t);
    execute format('create policy "Anyone can read" on public.%I for select to anon, authenticated using (true)', t);
    execute format(
      'create policy "Admin can write" on public.%I for all to authenticated using (public.is_admin()) with check (public.is_admin())',
      t
    );
    execute format('grant select on public.%I to anon, authenticated', t);
    execute format('grant insert, update, delete on public.%I to authenticated', t);
    execute format('revoke insert, update, delete on public.%I from anon', t);
  end loop;
end
$$;

-- Then add your sign-in address (the one in ADMIN_EMAILS):
-- insert into public.site_admins (email) values ('you@example.com') on conflict do nothing;
