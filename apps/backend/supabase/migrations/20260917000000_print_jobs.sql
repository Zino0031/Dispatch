create type public.print_job_status as enum (
  'QUEUED',
  'SENT_TO_KIOSK',
  'DOWNLOAD_START',
  'DOWNLOAD_COMPLETE',
  'PRINTING_STARTED',
  'PRINT_SUCCESS',
  'ERROR',
  'PRINTER_ERROR',
  'CANCELLED'
);

create type public.print_payment_status as enum (
  'NOT_REQUIRED',
  'PENDING',
  'AUTHORIZED',
  'FAILED',
  'REFUNDED'
);

create table public.print_jobs (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid references auth.users(id) on delete set null,
  guest_token_hash text,
  kiosk_id text not null,
  document_key text not null,
  document_mime_type text not null,
  document_size_bytes bigint not null check (document_size_bytes > 0),
  copies integer not null check (copies between 1 and 50),
  color text not null check (color in ('bw', 'color')),
  duplex boolean not null default false,
  status public.print_job_status not null default 'QUEUED',
  payment_status public.print_payment_status not null default 'PENDING',
  idempotency_key text not null,
  attempt integer not null default 0,
  lease_expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  cleanup_completed_at timestamptz,
  unique (idempotency_key)
);

create index print_jobs_owner_idx on public.print_jobs(owner_user_id);
create index print_jobs_status_idx on public.print_jobs(status);

create table public.print_job_status_history (
  id bigint generated always as identity primary key,
  print_job_id uuid not null references public.print_jobs(id) on delete cascade,
  status public.print_job_status not null,
  message text,
  created_at timestamptz not null default now()
);

create table public.print_payments (
  id uuid primary key default gen_random_uuid(),
  print_job_id uuid not null references public.print_jobs(id) on delete cascade,
  provider text not null,
  provider_reference text,
  points integer not null check (points > 0),
  status public.print_payment_status not null,
  created_at timestamptz not null default now(),
  unique (provider, provider_reference)
);

alter table public.print_jobs enable row level security;
alter table public.print_job_status_history enable row level security;
alter table public.print_payments enable row level security;

create policy "users can read their print jobs"
  on public.print_jobs for select
  using (owner_user_id = auth.uid());

create policy "users can read their job history"
  on public.print_job_status_history for select
  using (
    exists (
      select 1 from public.print_jobs
      where print_jobs.id = print_job_status_history.print_job_id
        and print_jobs.owner_user_id = auth.uid()
    )
  );

create policy "users can read their payments"
  on public.print_payments for select
  using (
    exists (
      select 1 from public.print_jobs
      where print_jobs.id = print_payments.print_job_id
        and print_jobs.owner_user_id = auth.uid()
    )
  );

insert into storage.buckets (id, name, public)
values ('print-documents', 'print-documents', false)
on conflict (id) do nothing;