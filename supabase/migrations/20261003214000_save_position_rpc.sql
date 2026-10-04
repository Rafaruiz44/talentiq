-- Save a position and its weighted skills as one transaction.
create function public.save_position(
  p_position_id uuid,
  p_title text,
  p_seniority text,
  p_seniority_points smallint,
  p_skills jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_recruiter_id uuid := (select auth.uid());
  v_position_id uuid;
  v_skill jsonb;
begin
  if v_recruiter_id is null then
    raise exception 'Authentication is required';
  end if;

  if p_title is null or length(trim(p_title)) = 0 then
    raise exception 'Position title is required';
  end if;

  if p_seniority is null
    or p_seniority not in ('Trainee', 'Junior', 'Semi Senior', 'Senior', 'Lead')
  then
    raise exception 'Invalid seniority';
  end if;

  if p_seniority_points not between 1 and 10 then
    raise exception 'Seniority points must be between 1 and 10';
  end if;

  if jsonb_typeof(p_skills) is distinct from 'array' then
    raise exception 'Skills must be a JSON array';
  end if;

  if jsonb_array_length(p_skills) = 0 then
    raise exception 'At least one skill is required';
  end if;

  for v_skill in select value from jsonb_array_elements(p_skills)
  loop
    if jsonb_typeof(v_skill) is distinct from 'object'
      or jsonb_typeof(v_skill -> 'name') is distinct from 'string'
      or length(trim(v_skill ->> 'name')) = 0
      or jsonb_typeof(v_skill -> 'points') is distinct from 'number'
      or (v_skill ->> 'points')::numeric not between 1 and 10
      or (v_skill ->> 'points')::numeric <> trunc((v_skill ->> 'points')::numeric)
    then
      raise exception 'Each skill requires a non-empty name and integer points between 1 and 10';
    end if;
  end loop;

  if p_position_id is null then
    insert into public.positions (
      recruiter_id,
      title,
      seniority,
      seniority_points
    )
    values (
      v_recruiter_id,
      trim(p_title),
      p_seniority,
      p_seniority_points
    )
    returning id into v_position_id;
  else
    update public.positions
    set title = trim(p_title),
        seniority = p_seniority,
        seniority_points = p_seniority_points
    where id = p_position_id
      and recruiter_id = v_recruiter_id
    returning id into v_position_id;

    if v_position_id is null then
      raise exception 'Position not found or not owned by the authenticated recruiter';
    end if;

    delete from public.position_skills
    where position_id = v_position_id
      and recruiter_id = v_recruiter_id;
  end if;

  insert into public.position_skills (
    recruiter_id,
    position_id,
    name,
    points
  )
  select
    v_recruiter_id,
    v_position_id,
    trim(skill.name),
    skill.points::smallint
  from jsonb_to_recordset(p_skills) as skill(name text, points numeric);

  return v_position_id;
end;
$$;

revoke all on function public.save_position(uuid, text, text, smallint, jsonb)
  from public, anon;
grant execute on function public.save_position(uuid, text, text, smallint, jsonb)
  to authenticated;
