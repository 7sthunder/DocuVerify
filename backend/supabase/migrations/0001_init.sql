-- DocuVerify — initial schema
-- Matches backend/app/main.py (job dict) + backend/app/pipeline.py (report shape).

create extension if not exists pgcrypto;

-- Analysis jobs — one row per upload/analysis.
-- Column set mirrors the job dict in app/main.py:102-112 plus the
-- denormalized assessment headline for cheap list queries.
create table if not exists public.jobs (
    id              text primary key,              -- uuid hex[:12], matches main.py job_id
    user_id         uuid references auth.users (id) on delete cascade,
    filename        text not null,                 -- original upload filename
    original_name   text not null,                 -- saved "original<ext>"
    status          text not null default 'queued'
                    check (status in ('queued', 'processing', 'complete', 'failed')),
    error           text,
    suspicion_score numeric,                       -- denormalized from report.assessment
    risk_level      text,                          -- denormalized from report.assessment
    report          jsonb,                         -- full report (assessment/findings/pages/reliability)
    created_at      timestamptz not null default now(),
    finished_at     timestamptz,
    job_dir         text                           -- local temp workspace path (server-side only)
);

create index if not exists jobs_user_id_idx   on public.jobs (user_id);
create index if not exists jobs_created_at_idx on public.jobs (created_at desc);

alter table public.jobs enable row level security;

-- Owners see only their own jobs; anonymous analysis (pre-auth) still allowed.
create policy "jobs_select_own" on public.jobs
    for select using (auth.uid() = user_id or user_id is null);
create policy "jobs_insert_own" on public.jobs
    for insert with check (auth.uid() = user_id or user_id is null);
create policy "jobs_update_own" on public.jobs
    for update using (auth.uid() = user_id or user_id is null);
create policy "jobs_delete_own" on public.jobs
    for delete using (auth.uid() = user_id or user_id is null);

-- Upload byte storage (private bucket; job_id-prefixed paths).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
select 'documents', 'documents', false, 26214400,
       array['application/pdf', 'image/jpeg', 'image/png']
where not exists (select 1 from storage.buckets where id = 'documents');

-- Storage RLS: object path layout = "{job_id}/{filename}".
create policy "documents_select_own" on storage.objects
    for select using (
        bucket_id = 'documents'
        and exists (select 1 from public.jobs j
                    where j.id::text = (storage.foldername(name))[1]
                    and (auth.uid() = j.user_id or j.user_id is null))
    );
create policy "documents_insert_own" on storage.objects
    for insert with check (
        bucket_id = 'documents'
        and exists (select 1 from public.jobs j
                    where j.id::text = (storage.foldername(name))[1]
                    and (auth.uid() = j.user_id or j.user_id is null))
    );