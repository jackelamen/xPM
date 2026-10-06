-- Per-person settings that should follow them across devices
-- (My Tasks sections and column choices, project column visibility, ...).
-- Small flags (Pulse, weekly rituals, auto-archive) live in auth user metadata instead.
-- The app falls back to browser-only storage until this table exists.
create table if not exists public.user_prefs (
    user_id uuid not null references auth.users(id) on delete cascade,
    key text not null,
    value jsonb not null default '{}'::jsonb,
    updated_at timestamptz not null default now(),
    primary key (user_id, key)
);

alter table public.user_prefs enable row level security;

create policy "user_prefs_select" on public.user_prefs for select using (auth.uid() = user_id);
create policy "user_prefs_insert" on public.user_prefs for insert with check (auth.uid() = user_id);
create policy "user_prefs_update" on public.user_prefs for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "user_prefs_delete" on public.user_prefs for delete using (auth.uid() = user_id);
