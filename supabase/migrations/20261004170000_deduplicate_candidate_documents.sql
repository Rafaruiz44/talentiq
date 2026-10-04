alter table public.candidate_documents
  add column content_fingerprint text;

update public.candidate_documents
set content_fingerprint = md5(extracted_text)
where extracted_text is not null;

create index candidate_documents_recruiter_fingerprint_idx
  on public.candidate_documents (recruiter_id, content_fingerprint)
  where content_fingerprint is not null;

drop function public.save_candidate_document(
  uuid, text, text, text, bigint, text, text
);

create function public.find_candidate_document_by_fingerprint(
  p_recruiter_id uuid,
  p_content_fingerprint text,
  p_extracted_text text
)
returns table(candidate_id uuid, candidate_document_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.role()) is distinct from 'service_role' then
    raise exception 'Service role is required';
  end if;

  if p_recruiter_id is null
    or p_content_fingerprint is null
    or p_content_fingerprint !~ '^[0-9a-f]{32}$'
    or p_extracted_text is null
    or length(trim(p_extracted_text)) = 0
    or length(p_extracted_text) > 600000
    or p_content_fingerprint is distinct from md5(p_extracted_text)
  then
    raise exception 'Invalid candidate fingerprint';
  end if;

  return query
  select documents.candidate_id, documents.id
  from public.candidate_documents as documents
  where documents.recruiter_id = p_recruiter_id
    and documents.content_fingerprint = p_content_fingerprint
    and documents.extracted_text = p_extracted_text
  order by documents.created_at, documents.id
  limit 1;
end;
$$;

create function public.save_candidate_document(
  p_recruiter_id uuid,
  p_full_name text,
  p_original_file_name text,
  p_mime_type text,
  p_size_bytes bigint,
  p_storage_path text,
  p_extracted_text text,
  p_content_fingerprint text
)
returns table(
  candidate_id uuid,
  candidate_document_id uuid,
  reused_existing boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_candidate_id uuid;
  v_candidate_document_id uuid;
begin
  if (select auth.role()) is distinct from 'service_role' then
    raise exception 'Service role is required';
  end if;

  if p_recruiter_id is null
    or p_full_name is null
    or length(trim(p_full_name)) = 0
    or length(p_full_name) > 200
    or p_original_file_name is null
    or length(trim(p_original_file_name)) = 0
    or length(p_original_file_name) > 255
    or p_mime_type is distinct from 'application/pdf'
    or p_size_bytes not between 1 and 5242880
    or p_extracted_text is null
    or length(trim(p_extracted_text)) = 0
    or length(p_extracted_text) > 600000
    or p_content_fingerprint is null
    or p_content_fingerprint !~ '^[0-9a-f]{32}$'
    or p_content_fingerprint is distinct from md5(p_extracted_text)
    or p_storage_path is null
    or p_storage_path !~* (
      '^' || p_recruiter_id::text
      || '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/resume[.]pdf$'
    )
  then
    raise exception 'Invalid candidate document';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtext(p_recruiter_id::text),
    pg_catalog.hashtext(p_content_fingerprint)
  );

  select documents.candidate_id, documents.id
  into v_candidate_id, v_candidate_document_id
  from public.candidate_documents as documents
  where documents.recruiter_id = p_recruiter_id
    and documents.content_fingerprint = p_content_fingerprint
    and documents.extracted_text = p_extracted_text
  order by documents.created_at, documents.id
  limit 1;

  if v_candidate_document_id is not null then
    return query select v_candidate_id, v_candidate_document_id, true;
    return;
  end if;

  insert into public.candidates (recruiter_id, full_name)
  values (p_recruiter_id, trim(p_full_name))
  returning id into v_candidate_id;

  insert into public.candidate_documents (
    recruiter_id,
    candidate_id,
    original_file_name,
    mime_type,
    size_bytes,
    storage_path,
    extracted_text,
    processing_status,
    content_fingerprint
  )
  values (
    p_recruiter_id,
    v_candidate_id,
    trim(p_original_file_name),
    p_mime_type,
    p_size_bytes,
    p_storage_path,
    p_extracted_text,
    'processed',
    p_content_fingerprint
  )
  returning id into v_candidate_document_id;

  return query select v_candidate_id, v_candidate_document_id, false;
end;
$$;

revoke all on function public.find_candidate_document_by_fingerprint(
  uuid, text, text
) from public, anon, authenticated;

grant execute on function public.find_candidate_document_by_fingerprint(
  uuid, text, text
) to service_role;

revoke all on function public.save_candidate_document(
  uuid, text, text, text, bigint, text, text, text
) from public, anon, authenticated;

grant execute on function public.save_candidate_document(
  uuid, text, text, text, bigint, text, text, text
) to service_role;
