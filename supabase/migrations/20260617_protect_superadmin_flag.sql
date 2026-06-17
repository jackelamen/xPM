-- Prevent privilege escalation: the profiles UPDATE policy is auth.uid() = id,
-- which would otherwise let any logged-in user set is_superadmin = true on their
-- own row via the client SDK. This trigger freezes the is_superadmin column for
-- the app roles (authenticated/anon); it can still be changed by the service role,
-- the Supabase dashboard, or direct SQL (postgres/supabase_admin).

create or replace function public.protect_superadmin_flag()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Privileged callers (dashboard SQL editor, service_role key, admin roles)
  -- may set the flag freely.
  if current_user in ('postgres', 'supabase_admin', 'service_role') then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.is_superadmin := false;            -- never self-grant on signup
  elsif tg_op = 'UPDATE'
        and new.is_superadmin is distinct from old.is_superadmin then
    new.is_superadmin := old.is_superadmin; -- silently ignore attempts to change it
  end if;

  return new;
end;
$$;

drop trigger if exists trg_protect_superadmin on profiles;
create trigger trg_protect_superadmin
  before insert or update on profiles
  for each row execute function public.protect_superadmin_flag();
