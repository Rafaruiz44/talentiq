drop function public.find_evaluation_run(
  uuid, uuid, uuid, text, text
);

create function public.find_evaluation_run(
  p_recruiter_id uuid,
  p_candidate_id uuid,
  p_position_id uuid,
  p_request_fingerprint text,
  p_evaluator_version text,
  p_requirements jsonb,
  p_resume_text text
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
    or jsonb_typeof(p_requirements) is distinct from 'object'
    or jsonb_typeof(p_requirements -> 'skills') is distinct from 'array'
    or p_resume_text is null
    or length(trim(p_resume_text)) = 0
    or length(p_resume_text) > 600000
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
  join public.positions as positions
    on positions.id = applications.position_id
    and positions.recruiter_id = runs.recruiter_id
  where runs.recruiter_id = p_recruiter_id
    and applications.position_id = p_position_id
    and runs.status = 'completed'
    and (
      (
        runs.candidate_id = p_candidate_id
        and runs.request_fingerprint = p_request_fingerprint
        and runs.evaluator_version = p_evaluator_version
      )
      or (
        runs.request_fingerprint is null
        and runs.evaluator_version is null
        and positions.updated_at <= runs.evaluated_at
        and jsonb_build_object(
          'role', p_requirements ->> 'role',
          'seniority', p_requirements ->> 'seniority',
          'seniorityPoints', (p_requirements ->> 'seniorityPoints')::smallint,
          'skills', (
            select coalesce(
              jsonb_agg(
                jsonb_build_object(
                  'name', requirement.skill ->> 'name',
                  'points', (requirement.skill ->> 'points')::smallint
                )
                order by
                  lower(requirement.skill ->> 'name'),
                  requirement.skill ->> 'name'
              ),
              '[]'::jsonb
            )
            from jsonb_array_elements(p_requirements -> 'skills')
              as requirement(skill)
          )
        ) = jsonb_build_object(
          'role', positions.title,
          'seniority', positions.seniority,
          'seniorityPoints', positions.seniority_points,
          'skills', (
            select coalesce(
              jsonb_agg(
                jsonb_build_object('name', skills.name, 'points', skills.points)
                order by lower(skills.name), skills.name
              ),
              '[]'::jsonb
            )
            from public.position_skills as skills
            where skills.position_id = positions.id
              and skills.recruiter_id = positions.recruiter_id
          )
        )
        and exists (
          select 1
          from public.candidate_documents as documents
          where documents.id = runs.candidate_document_id
            and documents.recruiter_id = runs.recruiter_id
            and documents.candidate_id = runs.candidate_id
            and documents.extracted_text = p_resume_text
        )
      )
    )
  order by runs.evaluated_at desc, runs.id
  limit 1;
end;
$$;

revoke all on function public.find_evaluation_run(
  uuid, uuid, uuid, text, text, jsonb, text
) from public, anon, authenticated;

grant execute on function public.find_evaluation_run(
  uuid, uuid, uuid, text, text, jsonb, text
) to service_role;
