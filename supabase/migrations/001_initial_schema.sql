-- ============================================================
-- Migration 001 — Initial schema (CampusPulse)
-- Run this in Supabase → SQL Editor → New Query → Run
-- ============================================================

-- ── Extensions ───────────────────────────────────────────────────────────────
create extension if not exists pgcrypto;

-- ── profiles ─────────────────────────────────────────────────────────────────
create table if not exists public.profiles (
  id                uuid primary key references auth.users on delete cascade,
  full_name         text,
  avatar_url        text,
  attendance_target integer not null default 75,
  created_at        timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Users can read their own profile"
  on public.profiles for select using (auth.uid() = id);

create policy "Users can update their own profile"
  on public.profiles for update using (auth.uid() = id);

create policy "Users can insert their own profile"
  on public.profiles for insert with check (auth.uid() = id);

-- Auto-create a profile row whenever a user signs up via auth
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, attendance_target)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    75
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ── subjects ─────────────────────────────────────────────────────────────────
create table if not exists public.subjects (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users on delete cascade,
  name       text not null,
  created_at timestamptz not null default now()
);

alter table public.subjects enable row level security;

create policy "Users manage their own subjects"
  on public.subjects for all using (auth.uid() = user_id);

-- ── attendance_records ────────────────────────────────────────────────────────
create table if not exists public.attendance_records (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users on delete cascade,
  subject_id  uuid not null references public.subjects on delete cascade,
  class_date  date not null,
  status      text not null check (status in ('present', 'absent', 'cancelled')),
  created_at  timestamptz not null default now(),
  unique(subject_id, class_date)
);

alter table public.attendance_records enable row level security;

create policy "Users manage their own attendance"
  on public.attendance_records for all using (auth.uid() = user_id);

-- ── timetable_slots ───────────────────────────────────────────────────────────
create table if not exists public.timetable_slots (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users on delete cascade,
  day_of_week  integer not null check (day_of_week between 0 and 6),  -- 0=Mon, 5=Sat
  start_time   time not null,
  end_time     time not null,
  subject_name text not null,
  room         text,
  created_at   timestamptz not null default now()
);

alter table public.timetable_slots enable row level security;

create policy "Users manage their own timetable"
  on public.timetable_slots for all using (auth.uid() = user_id);

-- ── documents ─────────────────────────────────────────────────────────────────
create table if not exists public.documents (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users on delete cascade,
  file_name  text not null,
  file_path  text not null,
  page_count integer not null default 0,
  status     text not null default 'processing'
             check (status in ('processing', 'ready', 'failed')),
  created_at timestamptz not null default now()
);

alter table public.documents enable row level security;

create policy "Users manage their own documents"
  on public.documents for all using (auth.uid() = user_id);

-- ── document_chunks ───────────────────────────────────────────────────────────
create table if not exists public.document_chunks (
  id          uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents on delete cascade,
  user_id     uuid not null references auth.users on delete cascade,
  page_number integer not null,
  content     text not null,
  tsv         tsvector generated always as (to_tsvector('english', content)) stored
);

create index if not exists document_chunks_tsv_idx
  on public.document_chunks using gin(tsv);

alter table public.document_chunks enable row level security;

create policy "Users read their own chunks"
  on public.document_chunks for all using (auth.uid() = user_id);

-- ── extracted_items ───────────────────────────────────────────────────────────
create table if not exists public.extracted_items (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users on delete cascade,
  document_id  uuid references public.documents on delete set null,
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

alter table public.extracted_items enable row level security;

create policy "Users manage their own extracted items"
  on public.extracted_items for all using (auth.uid() = user_id);

-- ── reminders ─────────────────────────────────────────────────────────────────
create table if not exists public.reminders (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users on delete cascade,
  title          text not null,
  remind_at      timestamptz not null,
  source_item_id uuid references public.extracted_items on delete set null,
  created_at     timestamptz not null default now()
);

alter table public.reminders enable row level security;

create policy "Users manage their own reminders"
  on public.reminders for all using (auth.uid() = user_id);

-- ── chat_messages ─────────────────────────────────────────────────────────────
create table if not exists public.chat_messages (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users on delete cascade,
  role          text not null check (role in ('user','assistant')),
  content       text not null,
  citations     jsonb,
  answer_status text check (answer_status in ('grounded','not_found')),
  created_at    timestamptz not null default now()
);

alter table public.chat_messages enable row level security;

create policy "Users manage their own chat messages"
  on public.chat_messages for all using (auth.uid() = user_id);

-- ── storage bucket for college documents ──────────────────────────────────────
insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict (id) do nothing;

create policy "Users can upload own documents to storage"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'documents' and
    (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Users can read own documents in storage"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'documents' and
    (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Users can delete own documents in storage"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'documents' and
    (storage.foldername(name))[1] = auth.uid()::text
  );
