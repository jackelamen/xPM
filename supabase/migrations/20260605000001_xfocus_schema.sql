-- xFocus schema migration
-- Apply with: supabase migration up (from ~/Documents/edgex-focus)
-- Or: supabase db push (if using linked project)

-- ── focus_sessions ───────────────────────────────────────────────
create table if not exists focus_sessions (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  date              date not null,
  started_at        timestamptz,
  ended_at          timestamptz,
  duration_mins     int not null,
  focus_type        text,
  energy_level      int,                      -- 1=Low 2=Medium 3=High 4=Peak
  task_ids          uuid[],
  task_names        text[],
  completed         boolean default false,
  time_block_id     uuid,
  notes             text,
  -- Post-session review
  felt_score        int,                      -- 1-5: flow/focus quality
  got_distracted    boolean,
  distraction_count int default 0,
  task_completed    text,                     -- 'yes' | 'no' | 'partial'
  would_repeat      boolean,
  created_at        timestamptz default now()
);

alter table focus_sessions enable row level security;

create policy "Users own their focus sessions"
  on focus_sessions for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists focus_sessions_user_date on focus_sessions(user_id, date);

-- ── time_blocks ──────────────────────────────────────────────────
create table if not exists time_blocks (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  date        date not null,
  title       text not null,
  start_time  time not null,
  end_time    time not null,
  color       text default '#f97316',
  task_ids    uuid[],
  task_names  text[],
  focus_type  text,
  notes       text,
  completed   boolean default false,
  session_id  uuid references focus_sessions(id) on delete set null,
  created_at  timestamptz default now()
);

alter table time_blocks enable row level security;

create policy "Users own their time blocks"
  on time_blocks for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists time_blocks_user_date on time_blocks(user_id, date);

-- ── intentions ───────────────────────────────────────────────────
create table if not exists intentions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  date        date not null,
  text        text not null,
  created_at  timestamptz default now(),
  unique(user_id, date)
);

alter table intentions enable row level security;

create policy "Users own their intentions"
  on intentions for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ── distractions ─────────────────────────────────────────────────
create table if not exists distractions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  date        date not null,
  session_id  uuid references focus_sessions(id) on delete set null,
  label       text,
  logged_at   timestamptz default now()
);

alter table distractions enable row level security;

create policy "Users own their distractions"
  on distractions for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists distractions_user_date on distractions(user_id, date);
