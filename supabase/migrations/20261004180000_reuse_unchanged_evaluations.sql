alter table public.evaluation_runs
  add column request_fingerprint text,
  add column evaluator_version text;

alter table public.evaluation_runs
  add constraint evaluation_runs_request_fingerprint_check
    check (
      request_fingerprint is null
      or request_fingerprint ~ '^[0-9a-f]{64}$'
    ),
  add constraint evaluation_runs_evaluator_version_check
    check (
      evaluator_version is null
      or (
        length(trim(evaluator_version)) > 0
        and length(evaluator_version) <= 100
      )
    );

create unique index evaluation_runs_application_request_unique_idx
  on public.evaluation_runs (
    recruiter_id,
    application_id,
    request_fingerprint,
    evaluator_version
  )
  where status = 'completed'
    and request_fingerprint is not null
    and evaluator_version is not null;

create function public.find_evaluation_run(
  p_recruiter_id uuid,
  p_candidate_id uuid,
  p_position_id uuid,
  p_request_fingerprint text,
  p_evaluator_version text
)
returns table(
  candidate_name text,
  earned_points numeric,
  total_points numeric,
  verdict text,
  strengths text[],
  gaps text[],
  evaluation_run_id uuid
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.role()) is distinct from 'service_role' then
    raise exception 'Service role is required';
  end if;

  if p_recruiter_id is null
    or p_candidate_id is null
    or p_position_id is null
    or p_request_fingerprint is null
    or p_request_fingerprint !~ '^[0-9a-f]{64}$'
    or p_evaluator_version is null
    or length(trim(p_evaluator_version)) = 0
    or length(p_evaluator_version) > 100
  then
    raise exception 'Invalid evaluation lookup';
  end if;

  return query
  select
    candidates.full_name,
    runs.earned_points,
    runs.total_points,
    runs.verdict,
    runs.strengths,
    runs.gaps,
    runs.id
  from public.evaluation_runs as runs
  join public.applications as applications
    on applications.id = runs.application_id
    and applications.recruiter_id = runs.recruiter_id
    and applications.candidate_id = runs.candidate_id
  join public.candidates as candidates
    on candidates.id = runs.candidate_id
    and candidates.recruiter_id = runs.recruiter_id
  where runs.recruiter_id = p_recruiter_id
    and runs.candidate_id = p_candidate_id
    and applications.position_id = p_position_id
    and runs.status = 'completed'
    and runs.request_fingerprint = p_request_fingerprint
    and runs.evaluator_version = p_evaluator_version
  order by runs.evaluated_at desc, runs.id
  limit 1;
end;
$$;

drop function public.save_evaluation_run(
  uuid, uuid, uuid, uuid, numeric, numeric, text, text[], text[]
);

create function public.save_evaluation_run(
  p_recruiter_id uuid,
  p_candidate_id uuid,
  p_candidate_document_id uuid,
  p_position_id uuid,
  p_earned_points numeric,
  p_total_points numeric,
  p_verdict text,
  p_strengths text[],
  p_gaps text[],
  p_request_fingerprint text,
  p_evaluator_version text
)
returns table(
  application_id uuid,
  evaluation_run_id uuid,
  reused_existing boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_application_id uuid;
  v_evaluation_run_id uuid;
begin
  if (select auth.role()) is distinct from 'service_role' then
    raise exception 'Service role is required';
  end if;

  if p_recruiter_id is null
    or p_candidate_id is null
    or p_candidate_document_id is null
    or p_position_id is null
    or p_earned_points is null
    or p_total_points is null
    or p_total_points <= 0
    or p_earned_points < 0
    or p_earned_points > p_total_points
    or p_verdict is null
    or p_verdict not in ('Apto', 'No Apto')
    or p_strengths is null
    or p_gaps is null
    or exists (
      select 1
      from unnest(p_strengths || p_gaps) as values_to_check(item)
      where item is null or length(item) > 1000
    )
    or p_request_fingerprint is null
    or p_request_fingerprint !~ '^[0-9a-f]{64}$'
    or p_evaluator_version is null
    or length(trim(p_evaluator_version)) = 0
    or length(p_evaluator_version) > 100
  then
    raise exception 'Invalid evaluation result';
  end if;

  insert into public.applications (
    recruiter_id,
    candidate_id,
    position_id,
    stage
  )
  values (
    p_recruiter_id,
    p_candidate_id,
    p_position_id,
    'Evaluado'
  )
  on conflict (recruiter_id, candidate_id, position_id)
  do update set
    stage = coalesce(applications.stage, 'Evaluado'),
    updated_at = now()
  returning id into v_application_id;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtext(v_application_id::text),
    pg_catalog.hashtext(p_request_fingerprint || p_evaluator_version)
  );

  select runs.id
  into v_evaluation_run_id
  from public.evaluation_runs as runs
  where runs.recruiter_id = p_recruiter_id
    and runs.application_id = v_application_id
    and runs.request_fingerprint = p_request_fingerprint
    and runs.evaluator_version = p_evaluator_version
    and runs.status = 'completed'
  order by runs.evaluated_at desc, runs.id
  limit 1;

  if v_evaluation_run_id is not null then
    return query select v_application_id, v_evaluation_run_id, true;
    return;
  end if;

  insert into public.evaluation_runs (
    recruiter_id,
    application_id,
    candidate_id,
    candidate_document_id,
    status,
    earned_points,
    total_points,
    verdict,
    strengths,
    gaps,
    evaluated_at,
    request_fingerprint,
    evaluator_version
  )
  values (
    p_recruiter_id,
    v_application_id,
    p_candidate_id,
    p_candidate_document_id,
    'completed',
    p_earned_points,
    p_total_points,
    p_verdict,
    p_strengths,
    p_gaps,
    now(),
    p_request_fingerprint,
    p_evaluator_version
  )
  returning id into v_evaluation_run_id;

  return query select v_application_id, v_evaluation_run_id, false;
end;
$$;

revoke all on function public.find_evaluation_run(
  uuid, uuid, uuid, text, text
) from public, anon, authenticated;

grant execute on function public.find_evaluation_run(
  uuid, uuid, uuid, text, text
) to service_role;

revoke all on function public.save_evaluation_run(
  uuid, uuid, uuid, uuid, numeric, numeric, text, text[], text[], text, text
) from public, anon, authenticated;

grant execute on function public.save_evaluation_run(
  uuid, uuid, uuid, uuid, numeric, numeric, text, text[], text[], text, text
) to service_role;
