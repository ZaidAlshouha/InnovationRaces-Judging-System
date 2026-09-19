-- =============================================================================
-- InnovationRaces Judging System — Application File Uploads (Phase E.1)
--
-- Adds the minimum schema needed to let a public applicant attach private
-- files (CV, certificates, pitch deck, etc.) to a file_upload question
-- answer, via a new two-step submission flow (initiate → upload → register
-- → finalize) that sits alongside the existing single-call
-- submit_application() RPC — that RPC is NOT modified in this migration.
--
-- Inspected before writing this migration (live schema, see conversation):
--   - application_answers had no column capable of holding file metadata
--     (only answer_text/answer_options) — file_path/file_metadata below are
--     the minimal addition.
--   - applications.status CHECK had no pre-submission state — 'draft' is
--     added, defaulted, so new draft applications are created explicitly
--     and existing rows (all already 'submitted' or later) are unaffected.
--   - applications_unique_per_hackathon was a plain UNIQUE(hackathon_id,
--     participant_id) table constraint with exactly one dependent (its own
--     backing index) — safe to drop and replace with a partial unique
--     index that excludes 'draft' rows, so an abandoned draft never
--     permanently blocks a participant from starting a real submission.
--   - application_answers_application_id_fkey is already ON DELETE CASCADE
--     (deleting an application already cascades to its answers) —
--     confirmed no FK change needed for cleanup to work correctly.
--   - No RLS policy exists for `anon` on applications/application_answers/
--     participants today (only the existing *_all_admin policies) — this
--     migration adds no RLS policy anywhere; every new write path is a new
--     SECURITY DEFINER RPC, exactly like submit_application() already is.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- application_answers: file metadata for file_upload question answers.
-- Nullable — every non-file answer keeps using answer_text/answer_options
-- exactly as before; these two columns are populated only together, only
-- for a file_upload answer.
-- -----------------------------------------------------------------------------
alter table public.application_answers
  add column file_path text,
  add column file_metadata jsonb;

alter table public.application_answers
  add constraint application_answers_file_columns_together
  check ((file_path is null) = (file_metadata is null));

-- -----------------------------------------------------------------------------
-- applications: add the 'draft' pre-submission state.
-- -----------------------------------------------------------------------------
alter table public.applications
  drop constraint applications_status_check;

alter table public.applications
  add constraint applications_status_check
  check (status = any (array[
    'draft', 'submitted', 'under_review', 'accepted', 'rejected', 'waitlisted'
  ]));

alter table public.applications
  alter column status set default 'draft';

-- -----------------------------------------------------------------------------
-- Replace the plain unique constraint with a partial unique index that
-- excludes 'draft' rows, so an abandoned draft application does not
-- permanently occupy a participant's one-submission-per-hackathon slot.
-- Every existing row is already 'submitted' or later (this migration adds
-- 'draft' as a value nothing could have used before today), so this drop +
-- recreate changes behavior only for rows created after this migration —
-- no existing data is affected or at risk of violating the new index.
-- -----------------------------------------------------------------------------
alter table public.applications
  drop constraint applications_unique_per_hackathon;

create unique index applications_unique_per_hackathon
  on public.applications (hackathon_id, participant_id)
  where status <> 'draft';

-- -----------------------------------------------------------------------------
-- Shared validation helper — extracted from submit_application()'s existing
-- body verbatim (same checks, same order, same Arabic exception messages),
-- so submit_application() and the new finalize_application() (added by the
-- application layer, not this migration) call one authoritative
-- implementation instead of maintaining two copies. submit_application()'s
-- own signature/behavior/return value are unchanged — only the internal
-- validation block is now delegated to this function instead of being
-- inlined, and finalize_application() (to be added next) calls the same
-- function.
--
-- Raises the same exceptions submit_application() already raises today; the
-- one behavioral difference is required-ness for file_upload questions,
-- which now checks EXISTS(... file_path ...) — a case that could not occur
-- before this migration since no answer could carry a file_path at all.
-- -----------------------------------------------------------------------------
create or replace function public.validate_application_answers(
  p_form_id uuid,
  p_answers jsonb
) returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_answer_count integer;
  v_distinct_question_count integer;
  v_missing_required_count integer;
  v_foreign_question_count integer;
  v_invalid_type_count integer;
begin
  create temporary table if not exists tmp_validate_answers (
    question_id uuid,
    answer_text text,
    answer_options jsonb,
    file_path text
  ) on commit drop;
  truncate tmp_validate_answers;

  insert into tmp_validate_answers
  select *
  from jsonb_to_recordset(p_answers) as a(
    question_id uuid,
    answer_text text,
    answer_options jsonb,
    file_path text
  );

  select count(*) into v_answer_count from tmp_validate_answers;

  select count(*)
  into v_foreign_question_count
  from tmp_validate_answers t
  left join public.application_form_questions q
    on q.id = t.question_id
    and q.form_id = p_form_id
  where q.id is null;

  if v_foreign_question_count > 0 then
    raise exception 'أحد الأسئلة لا ينتمي إلى هذا النموذج' using errcode = 'P0001';
  end if;

  select count(distinct question_id)
  into v_distinct_question_count
  from tmp_validate_answers;

  if v_distinct_question_count <> v_answer_count then
    raise exception 'لا يمكن تكرار الإجابة على نفس السؤال أكثر من مرة' using errcode = 'P0001';
  end if;

  select count(*)
  into v_missing_required_count
  from public.application_form_questions q
  where q.form_id = p_form_id
    and q.is_required
    and not exists (
      select 1 from tmp_validate_answers t
      where t.question_id = q.id
        and (
          (t.answer_text is not null and btrim(t.answer_text) <> '')
          or (
            t.answer_options is not null
            and jsonb_typeof(t.answer_options) = 'array'
            and jsonb_array_length(t.answer_options) > 0
            and exists (
              select 1 from jsonb_array_elements_text(t.answer_options) as el(v)
              where btrim(el.v) <> ''
            )
          )
          or t.file_path is not null
        )
    );

  if v_missing_required_count > 0 then
    raise exception 'يجب الإجابة على جميع الأسئلة المطلوبة' using errcode = 'P0001';
  end if;

  select count(*)
  into v_invalid_type_count
  from tmp_validate_answers t
  join public.application_form_questions q on q.id = t.question_id
  where
    (
      q.question_type = 'single_choice'
      and t.answer_text is not null
      and btrim(t.answer_text) <> ''
      and not exists (
        select 1 from jsonb_array_elements_text(q.options) as opt(v)
        where opt.v = t.answer_text
      )
    )
    or
    (
      q.question_type = 'multi_choice'
      and t.answer_options is not null
      and jsonb_typeof(t.answer_options) = 'array'
      and exists (
        select 1 from jsonb_array_elements_text(t.answer_options) as sel(v)
        where not exists (
          select 1 from jsonb_array_elements_text(q.options) as opt(v)
          where opt.v = sel.v
        )
      )
    )
    or
    (
      q.question_type = 'number'
      and t.answer_text is not null
      and btrim(t.answer_text) <> ''
      and t.answer_text !~ '^[+-]?[0-9]+(\.[0-9]+)?$'
    )
    or
    (
      q.question_type = 'email'
      and (
        (q.is_required and (t.answer_text is null or btrim(t.answer_text) = ''))
        or (
          t.answer_text is not null
          and btrim(t.answer_text) <> ''
          and t.answer_text !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
        )
      )
    )
    or
    (
      q.question_type = 'phone'
      and q.is_required
      and (t.answer_text is null or btrim(t.answer_text) = '')
    );

  if v_invalid_type_count > 0 then
    raise exception 'إحدى الإجابات لا تطابق نوع السؤال المطلوب' using errcode = 'P0001';
  end if;
end;
$function$;

-- No EXECUTE grant to anon/authenticated on this helper — it is called only
-- from inside other SECURITY DEFINER functions (submit_application(),
-- finalize_application()), never directly by a client.
revoke all on function public.validate_application_answers(uuid, jsonb) from public;

-- -----------------------------------------------------------------------------
-- submit_application(): unchanged signature, unchanged behavior, unchanged
-- return value and exception messages. The only change is that its
-- validation block (identical logic to before) is now delegated to
-- validate_application_answers() instead of being inlined, so it shares one
-- authoritative implementation with finalize_application(). Note
-- p_answers here still only ever contains question_id/answer_text/
-- answer_options from existing callers — file_path is simply an additional
-- optional key the shared validator tolerates (defaults to null via
-- jsonb_to_recordset when absent), so existing callers of
-- submit_application() are entirely unaffected.
-- -----------------------------------------------------------------------------
create or replace function public.submit_application(
  p_hackathon_id uuid,
  p_form_id uuid,
  p_full_name text,
  p_email text,
  p_phone text,
  p_answers jsonb
) returns applications
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_form public.application_forms%rowtype;
  v_participant_id uuid;
  v_application public.applications%rowtype;
begin
  select *
  into v_form
  from public.application_forms
  where id = p_form_id
    and hackathon_id = p_hackathon_id;

  if not found then
    raise exception 'النموذج غير موجود لهذا الهاكاثون' using errcode = 'P0001';
  end if;

  if v_form.status <> 'published' then
    raise exception 'هذا النموذج غير متاح للتقديم حاليًا' using errcode = 'P0001';
  end if;

  if v_form.opens_at is not null and now() < v_form.opens_at then
    raise exception 'لم يفتح التقديم على هذا النموذج بعد' using errcode = 'P0001';
  end if;

  if v_form.closes_at is not null and now() > v_form.closes_at then
    raise exception 'انتهى التقديم على هذا النموذج' using errcode = 'P0001';
  end if;

  perform public.validate_application_answers(p_form_id, p_answers);

  insert into public.participants (full_name, email, phone)
  values (p_full_name, p_email, p_phone)
  on conflict (email) do update
  set full_name = excluded.full_name,
      phone = coalesce(excluded.phone, public.participants.phone)
  returning id into v_participant_id;

  insert into public.applications (hackathon_id, form_id, participant_id, status)
  values (p_hackathon_id, v_form.id, v_participant_id, 'submitted')
  returning * into v_application;

  insert into public.application_answers (application_id, question_id, answer_text, answer_options)
  select v_application.id, question_id, answer_text, answer_options
  from jsonb_to_recordset(p_answers) as a(
    question_id uuid,
    answer_text text,
    answer_options jsonb
  );

  return v_application;
exception
  when unique_violation then
    raise exception 'لقد قمت بالتقديم على هذا الهاكاثون مسبقًا' using errcode = 'P0001';
end;
$function$;

-- -----------------------------------------------------------------------------
-- initiate_application(): creates (or reuses) a 'draft' application for the
-- two-step file-upload flow. Reuses an existing draft for the same
-- (hackathon, participant-by-email) pair instead of creating a new one each
-- call, so retrying/reloading the public page does not accumulate orphaned
-- drafts. Performs the same form/window checks submit_application() does —
-- duplicated here deliberately (three short IF checks, not the ~60-line
-- answer-validation block) since they are the *entry* checks, not the
-- shared answer-validation logic this migration consolidates.
-- -----------------------------------------------------------------------------
create or replace function public.initiate_application(
  p_hackathon_id uuid,
  p_form_id uuid,
  p_full_name text,
  p_email text,
  p_phone text
) returns applications
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_form public.application_forms%rowtype;
  v_participant_id uuid;
  v_existing_draft public.applications%rowtype;
  v_application public.applications%rowtype;
begin
  select *
  into v_form
  from public.application_forms
  where id = p_form_id
    and hackathon_id = p_hackathon_id;

  if not found then
    raise exception 'النموذج غير موجود لهذا الهاكاثون' using errcode = 'P0001';
  end if;

  if v_form.status <> 'published' then
    raise exception 'هذا النموذج غير متاح للتقديم حاليًا' using errcode = 'P0001';
  end if;

  if v_form.opens_at is not null and now() < v_form.opens_at then
    raise exception 'لم يفتح التقديم على هذا النموذج بعد' using errcode = 'P0001';
  end if;

  if v_form.closes_at is not null and now() > v_form.closes_at then
    raise exception 'انتهى التقديم على هذا النموذج' using errcode = 'P0001';
  end if;

  insert into public.participants (full_name, email, phone)
  values (p_full_name, p_email, p_phone)
  on conflict (email) do update
  set full_name = excluded.full_name,
      phone = coalesce(excluded.phone, public.participants.phone)
  returning id into v_participant_id;

  -- A non-draft application already exists for this participant/hackathon
  -- — same duplicate-submission case submit_application() catches via
  -- unique_violation, surfaced here with the same message up front instead
  -- of after an avoidable insert attempt.
  if exists (
    select 1 from public.applications
    where hackathon_id = p_hackathon_id
      and participant_id = v_participant_id
      and status <> 'draft'
  ) then
    raise exception 'لقد قمت بالتقديم على هذا الهاكاثون مسبقًا' using errcode = 'P0001';
  end if;

  -- Reuse an existing draft for this exact (hackathon, participant, form)
  -- rather than creating another one, so reloading the page or retrying
  -- after an interruption does not accumulate abandoned drafts.
  select *
  into v_existing_draft
  from public.applications
  where hackathon_id = p_hackathon_id
    and participant_id = v_participant_id
    and form_id = p_form_id
    and status = 'draft'
  limit 1;

  if found then
    return v_existing_draft;
  end if;

  -- submitted_at keeps its column default (now()) here since it is
  -- NOT NULL and this migration does not relax that — it is meaningless
  -- while status = 'draft' and is overwritten with the real value by
  -- finalize_application() below.
  insert into public.applications (hackathon_id, form_id, participant_id, status)
  values (p_hackathon_id, p_form_id, v_participant_id, 'draft')
  returning * into v_application;

  return v_application;
end;
$function$;

-- -----------------------------------------------------------------------------
-- register_application_file(): records one uploaded file's metadata against
-- a draft application's file_upload question. Never trusts a client-
-- supplied storage path as-is — recomputes the deterministic path
-- server-side and rejects any mismatch, so a client cannot register a path
-- belonging to a different application or question.
--
-- Returns the PREVIOUS file_path for this (application, question) pair, if
-- one existed and differs from the newly-registered path — or null. Postgres
-- cannot call the Storage API itself (no SQL-level "delete object" call
-- exists), so the caller (app/api/applications/register-file/route.ts) uses
-- this return value to delete the now-orphaned old Storage object itself,
-- immediately after this function commits the new one in application_answers.
-- -----------------------------------------------------------------------------
create or replace function public.register_application_file(
  p_application_id uuid,
  p_question_id uuid,
  p_storage_path text,
  p_original_filename text,
  p_mime_type text,
  p_size_bytes bigint
) returns text
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_application public.applications%rowtype;
  v_question public.application_form_questions%rowtype;
  v_expected_path text;
  v_previous_path text;
begin
  select * into v_application
  from public.applications
  where id = p_application_id;

  if not found then
    raise exception 'الطلب غير موجود' using errcode = 'P0001';
  end if;

  if v_application.status <> 'draft' then
    raise exception 'لا يمكن إضافة ملفات لطلب تم إرساله بالفعل' using errcode = 'P0001';
  end if;

  select * into v_question
  from public.application_form_questions
  where id = p_question_id
    and form_id = v_application.form_id;

  if not found then
    raise exception 'أحد الأسئلة لا ينتمي إلى هذا النموذج' using errcode = 'P0001';
  end if;

  if v_question.question_type <> 'file_upload' then
    raise exception 'هذا السؤال لا يقبل رفع الملفات' using errcode = 'P0001';
  end if;

  -- The one deterministic path this (application, question) pair is ever
  -- allowed to register — matches exactly what the upload-url API route
  -- computes before minting a signed upload URL (see
  -- lib/storage/application-file-path.ts). A mismatch here means the
  -- client is attempting to register a path it was never issued a signed
  -- URL for.
  v_expected_path := 'applications/' || p_application_id || '/' || p_question_id || '/' ||
    regexp_replace(p_original_filename, '[^a-zA-Z0-9._-]', '_', 'g');

  if p_storage_path <> v_expected_path then
    raise exception 'مسار الملف غير صالح' using errcode = 'P0001';
  end if;

  -- Replacing a previously-registered file for the same question: capture
  -- the old path to return to the caller (see this function's header note).
  select file_path into v_previous_path
  from public.application_answers
  where application_id = p_application_id
    and question_id = p_question_id;

  insert into public.application_answers (
    application_id, question_id, file_path, file_metadata
  )
  values (
    p_application_id,
    p_question_id,
    p_storage_path,
    jsonb_build_object(
      'original_filename', p_original_filename,
      'mime_type', p_mime_type,
      'size_bytes', p_size_bytes
    )
  )
  on conflict (application_id, question_id) do update
  set file_path = excluded.file_path,
      file_metadata = excluded.file_metadata,
      answer_text = null,
      answer_options = null,
      updated_at = now();

  if v_previous_path is not null and v_previous_path <> p_storage_path then
    return v_previous_path;
  end if;

  return null;
end;
$function$;

-- -----------------------------------------------------------------------------
-- finalize_application(): the second half of the two-step flow. Runs the
-- exact same shared validation submit_application() uses, then inserts the
-- non-file answers and flips the draft to 'submitted'. Required file_upload
-- questions are satisfied by application_answers rows register_application_file()
-- already inserted — this function does not accept file data in p_answers.
-- -----------------------------------------------------------------------------
create or replace function public.finalize_application(
  p_application_id uuid,
  p_answers jsonb
) returns applications
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_application public.applications%rowtype;
  v_combined_answers jsonb;
  v_updated public.applications%rowtype;
begin
  select * into v_application
  from public.applications
  where id = p_application_id;

  if not found then
    raise exception 'الطلب غير موجود' using errcode = 'P0001';
  end if;

  if v_application.status <> 'draft' then
    raise exception 'تم إرسال هذا الطلب بالفعل' using errcode = 'P0001';
  end if;

  -- Merge the non-file answers being finalized now with the file answers
  -- already registered in application_answers (from register_application_file()
  -- calls made earlier in the flow), so the shared validator sees the
  -- complete answer set exactly as submit_application() would — including
  -- file_path, so a required file_upload question is recognized as answered.
  select coalesce(p_answers, '[]'::jsonb) || coalesce(
    (
      select jsonb_agg(
        jsonb_build_object(
          'question_id', question_id,
          'answer_text', answer_text,
          'answer_options', answer_options,
          'file_path', file_path
        )
      )
      from public.application_answers
      where application_id = p_application_id
        and file_path is not null
    ),
    '[]'::jsonb
  )
  into v_combined_answers;

  perform public.validate_application_answers(v_application.form_id, v_combined_answers);

  insert into public.application_answers (application_id, question_id, answer_text, answer_options)
  select p_application_id, question_id, answer_text, answer_options
  from jsonb_to_recordset(p_answers) as a(
    question_id uuid,
    answer_text text,
    answer_options jsonb
  )
  on conflict (application_id, question_id) do update
  set answer_text = excluded.answer_text,
      answer_options = excluded.answer_options,
      updated_at = now();

  update public.applications
  set status = 'submitted',
      submitted_at = now()
  where id = p_application_id
  returning * into v_updated;

  return v_updated;
exception
  when unique_violation then
    raise exception 'لقد قمت بالتقديم على هذا الهاكاثون مسبقًا' using errcode = 'P0001';
end;
$function$;

-- -----------------------------------------------------------------------------
-- Grants: anon may call all three new RPCs, exactly like submit_application()
-- already is. No table grants are added — every write still goes through a
-- SECURITY DEFINER function.
-- -----------------------------------------------------------------------------
grant execute on function public.initiate_application(uuid, uuid, text, text, text) to anon, authenticated;
grant execute on function public.register_application_file(uuid, uuid, text, text, text, bigint) to anon, authenticated;
grant execute on function public.finalize_application(uuid, jsonb) to anon, authenticated;
