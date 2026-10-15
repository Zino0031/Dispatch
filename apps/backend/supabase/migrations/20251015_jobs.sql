-- Jobs table for Supabase/Postgres-backed JobStore (issue #9).
-- Raw access tokens never persist: only access_token_sha256 (compare hashed).
-- file_url points at Supabase Storage or local uploads until #10 moves storage.
create table if not exists jobs (
  print_job_id uuid primary key,
  access_token_sha256 text not null,
  kiosk_id text not null,
  file_url text not null,
  copies int not null check (copies between 1 and 50),
  color text not null check (color in ('bw', 'color')),
  duplex boolean not null default false,
  payment_intent_id text,
  user_id text,
  pages_estimate int,
  status text not null,
  history jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists jobs_kiosk_id_idx on jobs (kiosk_id);
create index if not exists jobs_user_id_idx on jobs (user_id);
create index if not exists jobs_created_at_idx on jobs (created_at desc);
