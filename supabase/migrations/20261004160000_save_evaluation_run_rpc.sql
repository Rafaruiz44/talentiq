create function public.save_evaluation_run(
  p_recruiter_id uuid,
  p_candidate_id uuid,
  p_candidate_document_id uuid,
  p_position_id uuid,
  p_earned_points numeric,
  p_total_points numeric,
  p_verdict text,
  p_strengths text[],
  p_gaps text[]
)
returns table(application_id uuid, evaluation_run_id uuid)
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
    evaluated_at
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
    now()
  )
  returning id into v_evaluation_run_id;

  return query select v_application_id, v_evaluation_run_id;
end;
$$;

revoke all on function public.save_evaluation_run(
  uuid, uuid, uuid, uuid, numeric, numeric, text, text[], text[]
) from public, anon, authenticated;

grant execute on function public.save_evaluation_run(
  uuid, uuid, uuid, uuid, numeric, numeric, text, text[], text[]
) to service_role;
