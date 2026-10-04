create function public.save_candidate_document(
  p_recruiter_id uuid,
  p_full_name text,
  p_original_file_name text,
  p_mime_type text,
  p_size_bytes bigint,
  p_storage_path text,
  p_extracted_text text
)
returns table(candidate_id uuid, candidate_document_id uuid)
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
    or p_storage_path is null
    or p_storage_path !~* (
      '^' || p_recruiter_id::text
      || '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/resume[.]pdf$'
    )
  then
    raise exception 'Invalid candidate document';
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
    processing_status
  )
  values (
    p_recruiter_id,
    v_candidate_id,
    trim(p_original_file_name),
    p_mime_type,
    p_size_bytes,
    p_storage_path,
    p_extracted_text,
    'processed'
  )
  returning id into v_candidate_document_id;

  return query select v_candidate_id, v_candidate_document_id;
end;
$$;

revoke all on function public.save_candidate_document(
  uuid, text, text, text, bigint, text, text
) from public, anon, authenticated;

grant execute on function public.save_candidate_document(
  uuid, text, text, text, bigint, text, text
) to service_role;

create policy candidate_cvs_delete_own
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'candidate-cvs'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );
