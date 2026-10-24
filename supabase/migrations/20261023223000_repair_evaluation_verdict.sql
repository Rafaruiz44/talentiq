create or replace function public.save_evaluation_run(
  p_recruiter_id uuid,
  p_candidate_id uuid,
  p_candidate_document_id uuid,
  p_position_id uuid,
  p_earned_points numeric,
  p_total_points numeric,
  p_verdict text,
  p_strengths text[],
  p_gaps text[],
  p_interview_questions text[],
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
    or p_interview_questions is null
    or (p_verdict = 'Apto' and cardinality(p_interview_questions) <> 3)
    or (p_verdict = 'No Apto' and cardinality(p_interview_questions) <> 0)
    or exists (
      select 1
      from unnest(p_strengths || p_gaps || p_interview_questions)
        as values_to_check(item)
      where item is null
        or length(trim(item)) = 0
        or length(item) > 1000
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
    update public.evaluation_runs
    set
      candidate_document_id = p_candidate_document_id,
      earned_points = p_earned_points,
      total_points = p_total_points,
      verdict = p_verdict,
      strengths = p_strengths,
      gaps = p_gaps,
      evaluated_at = now()
    where id = v_evaluation_run_id
      and recruiter_id = p_recruiter_id;

    delete from public.interview_questions
    where evaluation_run_id = v_evaluation_run_id
      and recruiter_id = p_recruiter_id;

    insert into public.interview_questions (
      recruiter_id,
      evaluation_run_id,
      question
    )
    select p_recruiter_id, v_evaluation_run_id, questions.question
    from unnest(p_interview_questions) with ordinality as questions(question, position)
    order by questions.position;

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

  insert into public.interview_questions (
    recruiter_id,
    evaluation_run_id,
    question
  )
  select p_recruiter_id, v_evaluation_run_id, questions.question
  from unnest(p_interview_questions) with ordinality as questions(question, position)
  order by questions.position;

  return query select v_application_id, v_evaluation_run_id, false;
end;
$$;
