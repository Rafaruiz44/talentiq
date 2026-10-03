-- Initial private workspace schema for Talentiq.
-- Apply only to a Supabase project configured for this application.

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.positions (
  id uuid primary key default gen_random_uuid(),
  recruiter_id uuid not null references public.profiles (id) on delete cascade,
  title text not null check (length(trim(title)) > 0),
  seniority text not null check (
    seniority in ('Trainee', 'Junior', 'Semi Senior', 'Senior', 'Lead')
  ),
  seniority_points smallint not null default 5 check (
    seniority_points between 1 and 10
  ),
  status text not null default 'Nueva' check (
    status in ('Nueva', 'Abierta', 'Cubierta', 'Cancelada')
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, recruiter_id)
);

create table public.position_skills (
  id uuid primary key default gen_random_uuid(),
  recruiter_id uuid not null references public.profiles (id) on delete cascade,
  position_id uuid not null,
  name text not null check (length(trim(name)) > 0),
  points smallint not null check (points between 1 and 10),
  created_at timestamptz not null default now(),
  foreign key (position_id, recruiter_id)
    references public.positions (id, recruiter_id) on delete cascade,
  unique (id, recruiter_id)
);

create unique index position_skills_name_per_position_idx
  on public.position_skills (position_id, lower(name));

create table public.candidates (
  id uuid primary key default gen_random_uuid(),
  recruiter_id uuid not null references public.profiles (id) on delete cascade,
  full_name text not null check (length(trim(full_name)) > 0),
  email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, recruiter_id)
);

create table public.candidate_documents (
  id uuid primary key default gen_random_uuid(),
  recruiter_id uuid not null references public.profiles (id) on delete cascade,
  candidate_id uuid not null,
  original_file_name text not null check (length(trim(original_file_name)) > 0),
  mime_type text not null check (mime_type = 'application/pdf'),
  size_bytes bigint not null check (size_bytes between 1 and 5242880),
  storage_path text not null unique,
  extracted_text text,
  processing_status text not null default 'pending' check (
    processing_status in ('pending', 'processing', 'processed', 'failed')
  ),
  processing_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (candidate_id, recruiter_id)
    references public.candidates (id, recruiter_id) on delete cascade,
  unique (id, recruiter_id, candidate_id),
  check (
    split_part(storage_path, '/', 1) = recruiter_id::text
    and split_part(storage_path, '/', 2) <> ''
  ),
  check (
    processing_status <> 'processed' or extracted_text is not null
  ),
  check (
    processing_status <> 'failed' or processing_error is not null
  )
);

create table public.applications (
  id uuid primary key default gen_random_uuid(),
  recruiter_id uuid not null references public.profiles (id) on delete cascade,
  candidate_id uuid not null,
  position_id uuid not null,
  stage text check (
    stage is null or stage in ('Evaluado', 'En entrevista', 'Descartado')
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (candidate_id, recruiter_id)
    references public.candidates (id, recruiter_id) on delete cascade,
  foreign key (position_id, recruiter_id)
    references public.positions (id, recruiter_id) on delete cascade,
  unique (id, recruiter_id, candidate_id),
  unique (recruiter_id, candidate_id, position_id)
);

comment on column public.applications.stage is
  'NULL until the first evaluation completes successfully; subsequent stages are tracked per candidate-position application.';

create table public.evaluation_runs (
  id uuid primary key default gen_random_uuid(),
  recruiter_id uuid not null references public.profiles (id) on delete cascade,
  application_id uuid not null,
  candidate_id uuid not null,
  candidate_document_id uuid not null,
  status text not null default 'queued' check (
    status in ('queued', 'processing', 'completed', 'failed')
  ),
  earned_points numeric(8, 2),
  total_points numeric(8, 2),
  verdict text check (verdict is null or verdict in ('Apto', 'No Apto')),
  strengths text[] not null default '{}',
  gaps text[] not null default '{}',
  error_message text,
  evaluated_at timestamptz,
  created_at timestamptz not null default now(),
  foreign key (application_id, recruiter_id, candidate_id)
    references public.applications (id, recruiter_id, candidate_id)
    on delete cascade,
  foreign key (candidate_document_id, recruiter_id, candidate_id)
    references public.candidate_documents (id, recruiter_id, candidate_id),
  unique (id, recruiter_id),
  check (
    (
      status = 'completed'
      and earned_points is not null
      and total_points is not null
      and total_points > 0
      and earned_points between 0 and total_points
      and verdict is not null
      and evaluated_at is not null
      and error_message is null
    )
    or (
      status in ('queued', 'processing')
      and earned_points is null
      and total_points is null
      and verdict is null
      and evaluated_at is null
      and error_message is null
    )
    or (
      status = 'failed'
      and error_message is not null
      and earned_points is null
      and total_points is null
      and verdict is null
      and evaluated_at is null
      and cardinality(strengths) = 0
      and cardinality(gaps) = 0
    )
  )
);

comment on table public.evaluation_runs is
  'Append-only evaluation history. Authenticated clients have read-only access; trusted server-side code records runs.';

create table public.interview_questions (
  id uuid primary key default gen_random_uuid(),
  recruiter_id uuid not null references public.profiles (id) on delete cascade,
  evaluation_run_id uuid not null,
  question text not null check (length(trim(question)) > 0),
  created_at timestamptz not null default now(),
  foreign key (evaluation_run_id, recruiter_id)
    references public.evaluation_runs (id, recruiter_id) on delete cascade
);

create index positions_recruiter_status_idx
  on public.positions (recruiter_id, status);

create index candidates_recruiter_name_idx
  on public.candidates (recruiter_id, full_name);

create index candidate_documents_candidate_created_idx
  on public.candidate_documents (candidate_id, created_at desc);

create index applications_recruiter_position_stage_idx
  on public.applications (recruiter_id, position_id, stage);

create index applications_candidate_created_idx
  on public.applications (candidate_id, created_at desc);

create index evaluation_runs_application_created_idx
  on public.evaluation_runs (application_id, created_at desc);

create index interview_questions_evaluation_run_idx
  on public.interview_questions (evaluation_run_id, created_at);

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create trigger positions_set_updated_at
before update on public.positions
for each row execute function public.set_updated_at();

create trigger candidates_set_updated_at
before update on public.candidates
for each row execute function public.set_updated_at();

create trigger candidate_documents_set_updated_at
before update on public.candidate_documents
for each row execute function public.set_updated_at();

create trigger applications_set_updated_at
before update on public.applications
for each row execute function public.set_updated_at();

create function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    new.email,
    coalesce(
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name'
    )
  )
  on conflict (id) do update
    set email = excluded.email,
        display_name = coalesce(
          excluded.display_name,
          public.profiles.display_name
        );

  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_auth_user();

create trigger on_auth_user_updated
after update of email, raw_user_meta_data on auth.users
for each row execute function public.handle_new_auth_user();

alter table public.profiles enable row level security;
alter table public.positions enable row level security;
alter table public.position_skills enable row level security;
alter table public.candidates enable row level security;
alter table public.candidate_documents enable row level security;
alter table public.applications enable row level security;
alter table public.evaluation_runs enable row level security;
alter table public.interview_questions enable row level security;

create policy profiles_select_self
  on public.profiles for select to authenticated
  using (id = (select auth.uid()));

create policy profiles_update_self
  on public.profiles for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

create policy positions_select_own
  on public.positions for select to authenticated
  using (recruiter_id = (select auth.uid()));

create policy positions_insert_own
  on public.positions for insert to authenticated
  with check (recruiter_id = (select auth.uid()));

create policy positions_update_own
  on public.positions for update to authenticated
  using (recruiter_id = (select auth.uid()))
  with check (recruiter_id = (select auth.uid()));

create policy position_skills_select_own
  on public.position_skills for select to authenticated
  using (recruiter_id = (select auth.uid()));

create policy position_skills_insert_own
  on public.position_skills for insert to authenticated
  with check (recruiter_id = (select auth.uid()));

create policy position_skills_update_own
  on public.position_skills for update to authenticated
  using (recruiter_id = (select auth.uid()))
  with check (recruiter_id = (select auth.uid()));

create policy candidates_select_own
  on public.candidates for select to authenticated
  using (recruiter_id = (select auth.uid()));

create policy candidates_insert_own
  on public.candidates for insert to authenticated
  with check (recruiter_id = (select auth.uid()));

create policy candidates_update_own
  on public.candidates for update to authenticated
  using (recruiter_id = (select auth.uid()))
  with check (recruiter_id = (select auth.uid()));

create policy candidate_documents_select_own
  on public.candidate_documents for select to authenticated
  using (recruiter_id = (select auth.uid()));

create policy candidate_documents_insert_own
  on public.candidate_documents for insert to authenticated
  with check (
    recruiter_id = (select auth.uid())
    and processing_status = 'pending'
    and extracted_text is null
    and processing_error is null
  );

create policy applications_select_own
  on public.applications for select to authenticated
  using (recruiter_id = (select auth.uid()));

create policy applications_insert_own
  on public.applications for insert to authenticated
  with check (
    recruiter_id = (select auth.uid())
    and stage is null
  );

create policy applications_update_own
  on public.applications for update to authenticated
  using (recruiter_id = (select auth.uid()))
  with check (
    recruiter_id = (select auth.uid())
    and (
      stage is null
      or exists (
        select 1
        from public.evaluation_runs
        where evaluation_runs.application_id = applications.id
          and evaluation_runs.recruiter_id = applications.recruiter_id
          and evaluation_runs.status = 'completed'
      )
    )
  );

create policy evaluation_runs_select_own
  on public.evaluation_runs for select to authenticated
  using (recruiter_id = (select auth.uid()));

create policy interview_questions_select_own
  on public.interview_questions for select to authenticated
  using (recruiter_id = (select auth.uid()));

grant select on public.profiles to authenticated;
grant update (display_name) on public.profiles to authenticated;

grant select, insert, update on
  public.positions,
  public.position_skills,
  public.candidates,
  public.applications
to authenticated;

grant select, insert on public.candidate_documents to authenticated;

grant select on
  public.evaluation_runs,
  public.interview_questions
to authenticated;

grant select, insert, update on
  public.profiles,
  public.positions,
  public.position_skills,
  public.candidates,
  public.candidate_documents,
  public.applications,
  public.evaluation_runs,
  public.interview_questions
to service_role;

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'candidate-cvs',
  'candidate-cvs',
  false,
  5242880,
  array['application/pdf']
)
on conflict (id) do update
  set name = excluded.name,
      public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create policy candidate_cvs_select_own
  on storage.objects for select to authenticated
  using (
    bucket_id = 'candidate-cvs'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

create policy candidate_cvs_insert_own
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'candidate-cvs'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

create policy candidate_cvs_update_own
  on storage.objects for update to authenticated
  using (
    bucket_id = 'candidate-cvs'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  )
  with check (
    bucket_id = 'candidate-cvs'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );
