alter table public.kiosks
  add column if not exists auth_token_hash text,
  add column if not exists revoked_at timestamptz,
  add column if not exists last_seen_at timestamptz;