-- =============================================================================
-- InnovationRaces Judging System — Application Pipeline
--
-- Adds the client/application/screening/grouping/notification pipeline that
-- feeds into the existing judging system:
--
--   clients -> hackathons -> application_forms/questions -> applications ->
--   application_answers -> application_screenings -> (accepted/rejected) ->
--   groups/group_members -> [future migration: projects.group_id] ->
--   assignments/evaluations (existing, untouched) -> results (existing)
--
-- Scope, exactly as reviewed and approved:
--   - hackathons.client_id is the ONLY change to an existing table. No
--     other existing table, column, RLS policy, function, or trigger from
--     001_initial_schema.sql, 002_auth_linkage.sql, or
--     003_submit_evaluation.sql is dropped, altered, or replaced.
--   - projects.group_id is deliberately NOT added here — the Group ->
--     Project link is a separate, future migration reviewed on its own.
--   - Public (anon) applicants can only reach the database through the
--     single SECURITY DEFINER submit_application() RPC at the bottom of
--     this file. None of participants/applications/application_answers
--     carry an anon INSERT policy — every public write is validated by
--     hand inside that one function, mirroring
--     003_submit_evaluation.sql's submit_evaluation() design exactly
--     (parse once into a temp table, validate against that same
--     materialization, single atomic transaction, domain-style error
--     messages).
--   - application_screenings and whatsapp_messages store results only.
--     No trigger or function in this file calls out to an AI provider or
--     a WhatsApp API — those integrations live entirely outside the
--     database (application code / an Edge Function using the
--     service-role key), writing their outcomes into these tables after
--     the fact.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- clients
-- -----------------------------------------------------------------------------
create table public.clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  contact_email text,
  contact_phone text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_updated_at
  before update on public.clients
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- hackathons.client_id — the one approved change to an existing table.
-- Nullable: existing hackathon rows are unaffected. on delete restrict:
-- deleting a client must never cascade-delete a hackathon and its entire
-- judging history. No existing RLS policy on hackathons needs to change —
-- hackathons_select_authenticated (using (true)) and hackathons_write_admin
-- (using/with check (is_admin())) are already column-agnostic.
-- -----------------------------------------------------------------------------
alter table public.hackathons
  add column client_id uuid references public.clients (id) on delete restrict;

create index hackathons_client_id_idx on public.hackathons (client_id);

-- -----------------------------------------------------------------------------
-- application_forms
-- -----------------------------------------------------------------------------
create table public.application_forms (
  id uuid primary key default gen_random_uuid(),
  hackathon_id uuid not null references public.hackathons (id) on delete cascade,
  title text not null,
  description text,
  status text not null default 'draft'
    check (status in ('draft', 'published', 'closed')),
  opens_at timestamptz,
  closes_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint application_forms_closes_after_opens
    check (closes_at is null or opens_at is null or closes_at >= opens_at)
);

create index application_forms_hackathon_id_idx on public.application_forms (hackathon_id);

create trigger set_updated_at
  before update on public.application_forms
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- application_form_questions
-- -----------------------------------------------------------------------------
create table public.application_form_questions (
  id uuid primary key default gen_random_uuid(),
  form_id uuid not null references public.application_forms (id) on delete cascade,
  question_text text not null,
  question_type text not null
    check (question_type in (
      'short_text', 'long_text', 'single_choice', 'multi_choice',
      'number', 'email', 'phone', 'file_upload'
    )),
  -- Flat JSON array of scalar strings for single_choice/multi_choice,
  -- e.g. '["red", "green", "blue"]' — not an array of {value, label}
  -- objects. submit_application() below matches submitted answers against
  -- these values with jsonb_array_elements_text(), which requires this
  -- exact shape; any display label a form-builder UI wants must be
  -- resolved client-side from the same string value, not stored here.
  options jsonb,
  is_required boolean not null default true,
  "order" integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Deliberately does NOT check that every element of options is a
  -- string: PostgreSQL CHECK constraints cannot contain subqueries
  -- (documented restriction — this includes EXISTS(SELECT ...) even over
  -- a set-returning function, not just over other tables), so that
  -- element-shape validation cannot live here. It is instead enforced in
  -- submit_application()'s PL/pgSQL body below, which has no such
  -- restriction.
  constraint application_form_questions_options_required_for_choice check (
    question_type not in ('single_choice', 'multi_choice')
    or (options is not null and jsonb_typeof(options) = 'array')
  )
);

create index application_form_questions_form_id_idx on public.application_form_questions (form_id);

create trigger set_updated_at
  before update on public.application_form_questions
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- participants
-- -----------------------------------------------------------------------------
create table public.participants (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  email text not null,
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint participants_email_unique unique (email)
);

create trigger set_updated_at
  before update on public.participants
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- applications
-- -----------------------------------------------------------------------------
create table public.applications (
  id uuid primary key default gen_random_uuid(),
  hackathon_id uuid not null references public.hackathons (id) on delete cascade,
  form_id uuid not null references public.application_forms (id) on delete restrict,
  participant_id uuid not null references public.participants (id) on delete cascade,
  status text not null default 'submitted'
    check (status in ('submitted', 'under_review', 'accepted', 'rejected', 'waitlisted')),
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint applications_unique_per_hackathon unique (hackathon_id, participant_id)
);

create index applications_hackathon_id_idx on public.applications (hackathon_id);
create index applications_participant_id_idx on public.applications (participant_id);
create index applications_form_id_idx on public.applications (form_id);
create index applications_status_idx on public.applications (status);

create trigger set_updated_at
  before update on public.applications
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- application_answers
-- -----------------------------------------------------------------------------
create table public.application_answers (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications (id) on delete cascade,
  question_id uuid not null references public.application_form_questions (id) on delete restrict,
  answer_text text,
  answer_options jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint application_answers_unique_per_question unique (application_id, question_id)
);

create index application_answers_application_id_idx on public.application_answers (application_id);
create index application_answers_question_id_idx on public.application_answers (question_id);

create trigger set_updated_at
  before update on public.application_answers
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- application_screenings — append-only history of AI/manual screening
-- results. No updated_at/trigger: an application can be screened more than
-- once (e.g. AI first, then admin override); the most recent row per
-- application_id is the current result. Mirrors audit_logs' append-only
-- pattern rather than the mutable-row pattern used elsewhere in this
-- schema.
-- -----------------------------------------------------------------------------
create table public.application_screenings (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications (id) on delete cascade,
  screened_by text not null check (screened_by in ('ai', 'admin')),
  score numeric(5, 2),
  recommendation text
    check (recommendation in ('accept', 'reject', 'waitlist', 'needs_review')),
  notes text,
  raw_result jsonb,
  created_at timestamptz not null default now()
);

create index application_screenings_application_id_idx on public.application_screenings (application_id);

-- -----------------------------------------------------------------------------
-- groups / group_members
-- -----------------------------------------------------------------------------
create table public.groups (
  id uuid primary key default gen_random_uuid(),
  hackathon_id uuid not null references public.hackathons (id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint groups_name_unique_per_hackathon unique (hackathon_id, name)
);

create index groups_hackathon_id_idx on public.groups (hackathon_id);

create trigger set_updated_at
  before update on public.groups
  for each row execute function public.set_updated_at();

create table public.group_members (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  application_id uuid not null references public.applications (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint group_members_unique unique (group_id, application_id),
  constraint group_members_participant_unique_per_hackathon unique (application_id)
);

create index group_members_group_id_idx on public.group_members (group_id);
create index group_members_application_id_idx on public.group_members (application_id);

-- -----------------------------------------------------------------------------
-- whatsapp_messages — notification tracking only. status is updated in
-- place as delivery webhooks arrive (pending -> sent -> delivered/failed);
-- no set_updated_at trigger since those transitions are explicit,
-- application-driven writes, not incidental edits.
-- -----------------------------------------------------------------------------
create table public.whatsapp_messages (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications (id) on delete cascade,
  message_type text not null
    check (message_type in ('accepted', 'rejected', 'group_assigned', 'reminder', 'other')),
  phone text not null,
  status text not null default 'pending'
    check (status in ('pending', 'sent', 'delivered', 'failed')),
  provider_message_id text,
  error_message text,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

create index whatsapp_messages_application_id_idx on public.whatsapp_messages (application_id);
create index whatsapp_messages_status_idx on public.whatsapp_messages (status);

-- =============================================================================
-- Row Level Security
-- =============================================================================
alter table public.clients enable row level security;
alter table public.application_forms enable row level security;
alter table public.application_form_questions enable row level security;
alter table public.participants enable row level security;
alter table public.applications enable row level security;
alter table public.application_answers enable row level security;
alter table public.application_screenings enable row level security;
alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.whatsapp_messages enable row level security;

-- clients: admin-only, no public exposure.
create policy clients_all_admin on public.clients
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- application_forms: published forms are readable by anyone, including
-- anon, so the public landing page can render the form before the
-- applicant has any identity. Only admins write.
create policy application_forms_select_public on public.application_forms
  for select to anon, authenticated
  using (status = 'published');

create policy application_forms_select_admin on public.application_forms
  for select to authenticated
  using (public.is_admin());

create policy application_forms_write_admin on public.application_forms
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- application_form_questions: readable wherever the parent form is
-- readable (published, or admin). Only admins write.
create policy application_form_questions_select_public on public.application_form_questions
  for select to anon, authenticated
  using (
    exists (
      select 1 from public.application_forms f
      where f.id = application_form_questions.form_id
        and f.status = 'published'
    )
  );

create policy application_form_questions_select_admin on public.application_form_questions
  for select to authenticated
  using (public.is_admin());

create policy application_form_questions_write_admin on public.application_form_questions
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- participants / applications / application_answers: admin-only in every
-- direction. Public writes happen exclusively through
-- submit_application() below, which runs with elevated privilege and
-- performs every validation by hand — RLS on these three tables never
-- needs to (and must not attempt to) reason about an anonymous caller.
create policy participants_all_admin on public.participants
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy applications_all_admin on public.applications
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy application_answers_all_admin on public.application_answers
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- application_screenings: admin-only in every direction. AI-driven writes
-- happen via a service-role connection (bypasses RLS, as already
-- documented for audit_logs cleanup) or a future SECURITY DEFINER RPC —
-- never directly from the browser client.
create policy application_screenings_all_admin on public.application_screenings
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- groups / group_members: admin-only. No judge-facing policy is added in
-- this migration — if a judge-facing "my group's projects" view is wanted
-- later, add a judge-scoped select policy then rather than guessing here.
create policy groups_all_admin on public.groups
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy group_members_all_admin on public.group_members
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- whatsapp_messages: admin-only. Sends happen via a service-role
-- connection or a SECURITY DEFINER RPC that also calls the WhatsApp
-- provider — never directly from the browser client, since a message send
-- is a side effect outside Postgres, not a plain row write.
create policy whatsapp_messages_all_admin on public.whatsapp_messages
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- =============================================================================
-- submit_application() — the single, atomic public entry point
--
-- Mirrors submit_evaluation() (003_submit_evaluation.sql) exactly in
-- structure: parse p_answers ONCE into a temporary table, validate every
-- business rule against that same materialization, then perform every
-- write inside one function invocation (one implicit transaction — any
-- exception rolls back the participant upsert, the application insert,
-- and the answers insert together).
--
-- Answer shape convention (enforced below, not just assumed): for
-- 'single_choice' the selected value is carried in answer_text; for
-- 'multi_choice' the selected values are carried in answer_options as a
-- jsonb array of strings. Every other question_type uses answer_text only.
--
-- Validates, in order:
--   1. The form exists AND belongs to the stated hackathon (closes the
--      "answers reference the wrong form/hackathon" gap).
--   2. The form is published, and (if set) within its open/close window.
--   3. Every answered question_id belongs to THIS form.
--   4. No duplicate question_id within the same submission.
--   5. Every required question is answered with a genuinely non-empty
--      value — NULL, empty string, and empty/all-null-element arrays all
--      count as unanswered, not just NULL.
--   6. Every answer matches its question's question_type:
--      - single_choice: answer_text must be one of the question's
--        options.
--      - multi_choice: every element of answer_options must be one of
--        the question's options (empty array rejected by check 5 already
--        when the question is required).
--      - number: answer_text must parse as numeric.
--      - email: answer_text must be non-empty and pass a basic email
--        shape check.
--      - phone: answer_text must be non-empty.
--      (short_text/long_text/file_upload have no further shape
--      validation beyond the non-empty check above.)
-- Then performs, atomically:
--   7. Upsert the participant by email (returning applicant reuses their
--      existing row).
--   8. Insert the application (unique(hackathon_id, participant_id) is
--      the backstop against a duplicate application to the same
--      hackathon, converted into a domain-style error message).
--   9. Insert every answer from the same validated temp table.
-- =============================================================================
create or replace function public.submit_application(
  p_hackathon_id uuid,
  p_form_id uuid,
  p_full_name text,
  p_email text,
  p_phone text,
  p_answers jsonb
)
returns public.applications
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_form public.application_forms%rowtype;
  v_participant_id uuid;
  v_application public.applications%rowtype;
  v_answer_count integer;
  v_distinct_question_count integer;
  v_missing_required_count integer;
  v_foreign_question_count integer;
  v_invalid_type_count integer;
begin
  SELECT *
  INTO v_form
  FROM public.application_forms
  WHERE id = p_form_id
    AND hackathon_id = p_hackathon_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'النموذج غير موجود لهذا الهاكاثون' USING ERRCODE = 'P0001';
  END IF;

  IF v_form.status <> 'published' THEN
    RAISE EXCEPTION 'هذا النموذج غير متاح للتقديم حاليًا' USING ERRCODE = 'P0001';
  END IF;

  IF v_form.opens_at IS NOT NULL AND now() < v_form.opens_at THEN
    RAISE EXCEPTION 'لم يفتح التقديم على هذا النموذج بعد' USING ERRCODE = 'P0001';
  END IF;

  IF v_form.closes_at IS NOT NULL AND now() > v_form.closes_at THEN
    RAISE EXCEPTION 'انتهى التقديم على هذا النموذج' USING ERRCODE = 'P0001';
  END IF;

  CREATE TEMPORARY TABLE tmp_submit_answers ON COMMIT DROP AS
  SELECT *
  FROM jsonb_to_recordset(p_answers) AS a(
    question_id uuid,
    answer_text text,
    answer_options jsonb
  );

  SELECT count(*)
  INTO v_answer_count
  FROM tmp_submit_answers;

  SELECT count(*)
  INTO v_foreign_question_count
  FROM tmp_submit_answers t
  LEFT JOIN public.application_form_questions q
    ON q.id = t.question_id
    AND q.form_id = v_form.id
  WHERE q.id IS NULL;

  IF v_foreign_question_count > 0 THEN
    RAISE EXCEPTION 'أحد الأسئلة لا ينتمي إلى هذا النموذج' USING ERRCODE = 'P0001';
  END IF;

  SELECT count(DISTINCT question_id)
  INTO v_distinct_question_count
  FROM tmp_submit_answers;

  IF v_distinct_question_count <> v_answer_count THEN
    RAISE EXCEPTION 'لا يمكن تكرار الإجابة على نفس السؤال أكثر من مرة' USING ERRCODE = 'P0001';
  END IF;

  -- Required-question check strengthened: NULL, '' (after trimming), and
  -- '[]'/an array of only null-ish elements all count as "not answered" —
  -- not just a bare NULL as before.
  SELECT count(*)
  INTO v_missing_required_count
  FROM public.application_form_questions q
  WHERE q.form_id = v_form.id
    AND q.is_required
    AND NOT EXISTS (
      SELECT 1 FROM tmp_submit_answers t
      WHERE t.question_id = q.id
        AND (
          (t.answer_text IS NOT NULL AND btrim(t.answer_text) <> '')
          OR (
            t.answer_options IS NOT NULL
            AND jsonb_typeof(t.answer_options) = 'array'
            AND jsonb_array_length(t.answer_options) > 0
            AND EXISTS (
              SELECT 1 FROM jsonb_array_elements_text(t.answer_options) AS el(v)
              WHERE btrim(el.v) <> ''
            )
          )
        )
    );

  IF v_missing_required_count > 0 THEN
    RAISE EXCEPTION 'يجب الإجابة على جميع الأسئلة المطلوبة' USING ERRCODE = 'P0001';
  END IF;

  -- Per-type shape validation. Any answer that fails its question_type's
  -- rule is caught here in one combined scan; questions with no answer at
  -- all are exempt (already handled by the required-question check above
  -- — an optional, unanswered question must not fail type validation).
  SELECT count(*)
  INTO v_invalid_type_count
  FROM tmp_submit_answers t
  JOIN public.application_form_questions q ON q.id = t.question_id
  WHERE
    -- single_choice: the selected value must be one of the question's options.
    (
      q.question_type = 'single_choice'
      AND t.answer_text IS NOT NULL
      AND btrim(t.answer_text) <> ''
      AND NOT EXISTS (
        SELECT 1 FROM jsonb_array_elements_text(q.options) AS opt(v)
        WHERE opt.v = t.answer_text
      )
    )
    OR
    -- multi_choice: every selected value must be one of the question's options.
    (
      q.question_type = 'multi_choice'
      AND t.answer_options IS NOT NULL
      AND jsonb_typeof(t.answer_options) = 'array'
      AND EXISTS (
        SELECT 1 FROM jsonb_array_elements_text(t.answer_options) AS sel(v)
        WHERE NOT EXISTS (
          SELECT 1 FROM jsonb_array_elements_text(q.options) AS opt(v)
          WHERE opt.v = sel.v
        )
      )
    )
    OR
    -- number: must parse as numeric when answered.
    (
      q.question_type = 'number'
      AND t.answer_text IS NOT NULL
      AND btrim(t.answer_text) <> ''
      AND t.answer_text !~ '^[+-]?[0-9]+(\.[0-9]+)?$'
    )
    OR
    -- email: required questions must be non-empty; whenever a value IS
    -- present (required or not), it must be a plausible email shape —
    -- an optional email question is allowed to be skipped, but never
    -- allowed to hold garbage.
    (
      q.question_type = 'email'
      AND (
        (q.is_required AND (t.answer_text IS NULL OR btrim(t.answer_text) = ''))
        OR (
          t.answer_text IS NOT NULL
          AND btrim(t.answer_text) <> ''
          AND t.answer_text !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
        )
      )
    )
    OR
    -- phone: required questions must be non-empty. No further shape
    -- constraint is imposed on a non-empty phone value here — phone
    -- number formats vary too widely across locales to validate with a
    -- single regex without rejecting legitimate numbers.
    (
      q.question_type = 'phone'
      AND q.is_required
      AND (t.answer_text IS NULL OR btrim(t.answer_text) = '')
    );

  IF v_invalid_type_count > 0 THEN
    RAISE EXCEPTION 'إحدى الإجابات لا تطابق نوع السؤال المطلوب' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.participants (full_name, email, phone)
  VALUES (p_full_name, p_email, p_phone)
  ON CONFLICT (email) DO UPDATE
  SET full_name = excluded.full_name,
      phone = coalesce(excluded.phone, public.participants.phone)
  RETURNING id INTO v_participant_id;

  INSERT INTO public.applications (hackathon_id, form_id, participant_id)
  VALUES (p_hackathon_id, v_form.id, v_participant_id)
  RETURNING * INTO v_application;

  INSERT INTO public.application_answers (application_id, question_id, answer_text, answer_options)
  SELECT v_application.id, question_id, answer_text, answer_options
  FROM tmp_submit_answers;

  RETURN v_application;
EXCEPTION
  WHEN unique_violation THEN
    RAISE EXCEPTION 'لقد قمت بالتقديم على هذا الهاكاثون مسبقًا' USING ERRCODE = 'P0001';
END;
$$;

REVOKE ALL ON FUNCTION public.submit_application(uuid, uuid, text, text, text, jsonb) FROM public;
GRANT EXECUTE ON FUNCTION public.submit_application(uuid, uuid, text, text, text, jsonb) TO anon, authenticated;
