-- Ingest state for Python backfill checkpointing
create table if not exists public.ingest_state (
  site_name text primary key,
  backfill_end timestamptz,
  updated_at timestamptz default now()
);

-- Helpful index
create index if not exists idx_ingest_state_updated on public.ingest_state(updated_at desc);

