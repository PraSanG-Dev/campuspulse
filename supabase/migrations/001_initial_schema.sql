-- ============================================================
-- Migration 001 — Initial schema
-- Run this in Supabase → SQL Editor (Phase 4 will walk you through it)
-- ============================================================

-- Enable the pgcrypto extension (needed for gen_random_uuid on older Postgres)
create extension if not exists pgcrypto;

-- ── profiles ─────────────────────────────────────────────────────────────────
create table if not exists profiles (
  id                uuid primary key references auth.users on delete cascade,
  full_name         text,
  avatar_url        text,
  attendance_target integer not null default 75,
  created_at        timestamptz not null default now()
);

alter table profiles enable row level security;

create policy "Users can read their own profile"
  on profiles for select using (auth.uid() = id);

create policy "Users can update their own profile"
  on profiles for update using (auth.uid() = id);

-- ── subjects ─────────────────────────────────────────────────────────────────
create table if not exists subjects (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users on delete cascade,
  name       text not null,
  created_at timestamptz not null default now()
);

alter table subjects enable row level security;

create policy "Users manage their own subjects"
  on subjects for all using (auth.uid() = user_id);

-- ── attendance_records ────────────────────────────────────────────────────────
create table if not exists attendance_records (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users on delete cascade,
  subject_id  uuid not null references subjects on delete cascade,
  class_date  date not null,
  status      text not null check (status in ('present', 'absent', 'cancelled')),
  created_at  timestamptz not null default now(),
  unique(subject_id, class_date)
);

alter table attendance_records enable row level security;

create policy "Users manage their own attendance"
  on attendance_records for all using (auth.uid() = user_id);

-- ── timetable_slots ───────────────────────────────────────────────────────────
create table if not exists timetable_slots (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users on delete cascade,
  day_of_week  integer not null check (day_of_week between 0 and 6),  -- 0=Mon
  start_time   time not null,
  end_time     time not null,
  subject_name text not null,
  room         text,
  created_at   timestamptz not null default now()
);

alter table timetable_slots enable row level security;

create policy "Users manage their own timetable"
  on timetable_slots for all using (auth.uid() = user_id);

-- ── documents ─────────────────────────────────────────────────────────────────
create table if not exists documents (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users on delete cascade,
  file_name  text not null,
  file_path  text not null,   -- path inside Supabase storage bucket
  page_count integer not null default 0,
  status     text not null default 'processing'
             check (status in ('processing', 'ready', 'failed')),
  created_at timestamptz not null default now()
);

alter table documents enable row level security;

create policy "Users manage their own documents"
  on documents for all using (auth.uid() = user_id);

-- ── document_chunks ───────────────────────────────────────────────────────────
create table if not exists document_chunks (
  id          uuid primary key default gen_random_uuid(),
  document_id uuid not null references documents on delete cascade,
  user_id     uuid not null references auth.users on delete cascade,
  page_number integer not null,
  content     text not null,
  -- tsv column for Postgres full-text search
  tsv         tsvector generated always as (to_tsvector('english', content)) stored,
  -- nullable embedding column — ready for a future vector upgrade
  embedding   vector(1536)  -- requires pgvector extension; add in Phase 6
);

create index if not exists document_chunks_tsv_idx
  on document_chunks using gin(tsv);

alter table document_chunks enable row level security;

create policy "Users read their own chunks"
  on document_chunks for all using (auth.uid() = user_id);

-- ── extracted_items ───────────────────────────────────────────────────────────
create table if not exists extracted_items (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users on delete cascade,
  document_id  uuid references documents on delete set null,
  kind         text not null check (kind in ('deadline','eligibility','document_required','next_step')),
  text         text not null,
  item_date    date,
  page_number  integer,
  source_quote text,
  confidence   text not null check (confidence in ('high','low')),
  status       text not null default 'pending'
               check (status in ('pending','confirmed','rejected')),
  created_at   timestamptz not null default now()
);

alter table extracted_items enable row level security;

create policy "Users manage their own extracted items"
  on extracted_items for all using (auth.uid() = user_id);

-- ── reminders ─────────────────────────────────────────────────────────────────
create table if not exists reminders (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users on delete cascade,
  title          text not null,
  remind_at      timestamptz not null,
  source_item_id uuid references extracted_items on delete set null,
  created_at     timestamptz not null default now()
);

alter table reminders enable row level security;

create policy "Users manage their own reminders"
  on reminders for all using (auth.uid() = user_id);

-- ── chat_messages ─────────────────────────────────────────────────────────────
create table if not exists chat_messages (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users on delete cascade,
  role          text not null check (role in ('user','assistant')),
  content       text not null,
  citations     jsonb,
  answer_status text check (answer_status in ('grounded','not_found')),
  created_at    timestamptz not null default now()
);

alter table chat_messages enable row level security;

create policy "Users manage their own chat messages"
  on chat_messages for all using (auth.uid() = user_id);
