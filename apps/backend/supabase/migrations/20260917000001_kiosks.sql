create table public.kiosks (
  kiosk_id text primary key,
  display_name text not null,
  printer_name text,
  auth_token_hash text,
  revoked_at timestamptz,
  last_seen_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.kiosks enable row level security;