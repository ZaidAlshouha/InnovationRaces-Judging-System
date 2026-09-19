-- =============================================================================
-- InnovationRaces Judging System — Eligibility, AI-Screening Configuration &
-- Applicant Management (Phase F0)
--
-- Adds the dynamic, per-competition eligibility-rule engine, AI-screening
-- criteria configuration, and persisted eligibility results that the
-- Applicant Management Center (app/admin/hackathons/[hackathonId]/applicants)
-- reads/writes — plus a public-safe view so the landing page can display
-- ("شروط المشاركة") the resulting requirements without exposing rule
-- internals. This is Phase F0: configuration + evaluator + admin UI only.
-- No n8n workflow, credential, or AI execution is added by this migration or
-- by any code in this phase — see AGENTS.md Phase F0 scope.
--
-- Nothing in 001-007 is dropped, altered, or replaced, with ONE exception
-- (both purely additive, both widen-only, same pattern as
-- 005_multi_competition_configuration.sql's question_type widening and
-- 006_form_question_enabled_state.sql's additive column):
--   - audit_logs.action CHECK constraint gains 3 new allowed values
--     (application_status_changed, eligibility_rule_changed,
--     ai_criterion_changed) so applicant decisions can be recorded through
--     the EXISTING audit_logs table/page instead of a new duplicate audit
--     system, per explicit instruction. No existing row's `action` value
--     becomes invalid; no existing policy on audit_logs changes.
--   - No other existing table, column, RLS policy, function, or trigger is
--     touched. In particular: applications/application_answers/
--     participants/application_forms/application_form_questions and every
--     judging table (projects/judges/criteria/assignments/evaluations/
--     evaluation_scores) are completely untouched — their RLS and RPCs
--     behave identically to before this migration.
--
-- New tables (all admin-only RLS, same pattern as clients/application_forms
-- write policies — see 004_application_pipeline.sql):
--   - eligibility_rules: one competition's dynamic eligibility-rule
--     configuration. Generic rule_type + jsonb comparison_value (not one
--     column/rule per requirement) so new eligibility requirements never
--     need a schema change — mirrors this migration's own design goal.
--   - ai_screening_criteria: one competition's configurable AI-screening
--     criteria (name/description/weight/enabled/order). Configuration only
--     — no function here calls an AI provider; that remains entirely
--     outside the database (a future n8n workflow / Edge Function), exactly
--     like application_screenings already documented in
--     004_application_pipeline.sql.
--   - eligibility_results: the PERSISTED output of the deterministic
--     eligibility evaluator (lib/domain/eligibility-evaluation.ts), one
--     current row per application (upsert, not append-only — unlike
--     application_screenings, there is no "AI vs admin override" axis here;
--     eligibility is fully reproducible from the current rule set at any
--     time, so a stale result is simply replaced on re-evaluation).
--
-- New view:
--   - published_eligibility_rules: the public-facing projection, mirroring
--     published_competitions' own design exactly (005_multi_competition_
--     configuration.sql) — an explicit column whitelist (id, hackathon_id,
--     name, description, order only; NEVER rule_type, question_id,
--     comparison_value, is_blocking, or metadata), filtered to
--     is_enabled = true AND is_blocking = true, granted SELECT to
--     anon/authenticated. A non-blocking (soft/preference) rule is an
--     internal screening signal, never a published "requirement" — matching
--     the F0 spec's landing-page example showing only hard requirements.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- eligibility_rules
-- -----------------------------------------------------------------------------
create table public.eligibility_rules (
  id uuid primary key default gen_random_uuid(),
  hackathon_id uuid not null references public.hackathons (id) on delete cascade,
  name text not null,
  description text,
  rule_type text not null check (rule_type in (
    'age_min', 'age_max', 'answer_equals', 'answer_contains', 'answer_in',
    'number_range', 'field_required', 'document_required'
  )),
  -- Nullable: a future non-question-based rule_type could exist without one.
  -- Every rule_type currently defined DOES require it — enforced at the
  -- domain/Zod layer (lib/domain/eligibility-rule.ts), not duplicated here
  -- as a CHECK, since "which rule_types require it" is exactly the kind of
  -- business rule this migration's own design principle says should live in
  -- one place, not be re-derived from a CHECK constraint's rule_type list.
  -- ON DELETE SET NULL (not CASCADE/RESTRICT): deleting a form question must
  -- never silently delete or block-delete an eligibility rule — the rule
  -- becomes inert (the evaluator treats a null questionId as "skipped",
  -- exactly like a missing answer) and stays visible for the admin to fix
  -- or remove, matching this migration's "no invented cascade behavior"
  -- principle.
  question_id uuid references public.application_form_questions (id) on delete set null,
  comparison_value jsonb,
  is_enabled boolean not null default true,
  is_blocking boolean not null default true,
  failure_message text not null,
  "order" integer not null default 0,
  metadata jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index eligibility_rules_hackathon_id_idx on public.eligibility_rules (hackathon_id);
create index eligibility_rules_question_id_idx on public.eligibility_rules (question_id);

create trigger set_updated_at
  before update on public.eligibility_rules
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- ai_screening_criteria — configuration only, no AI execution in this
-- migration or this phase.
-- -----------------------------------------------------------------------------
create table public.ai_screening_criteria (
  id uuid primary key default gen_random_uuid(),
  hackathon_id uuid not null references public.hackathons (id) on delete cascade,
  name text not null,
  description text,
  -- Same weight convention as criteria.weight (001_initial_schema.sql):
  -- whole-number percentage. Unlike judging criteria, enabled weights are
  -- NOT required to sum to exactly 100 (validated at the domain layer,
  -- lib/domain/ai-screening-criterion.ts::validateAiScreeningCriteriaWeights)
  -- — an admin may deliberately enable a subset of defined criteria at any
  -- time, so no CHECK constraint (which cannot see sibling rows/enabled
  -- state) is added here, same reasoning 001_initial_schema.sql documents
  -- for judging criteria's own set-level weight invariant.
  weight numeric(5, 2) not null check (weight > 0 and weight <= 100),
  is_enabled boolean not null default true,
  "order" integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index ai_screening_criteria_hackathon_id_idx on public.ai_screening_criteria (hackathon_id);

create trigger set_updated_at
  before update on public.ai_screening_criteria
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- eligibility_results — persisted, upsert-by-application_id output of the
-- deterministic evaluator. One current row per application; re-evaluation
-- replaces it (application_id is UNIQUE, not just indexed).
-- -----------------------------------------------------------------------------
create table public.eligibility_results (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications (id) on delete cascade,
  is_eligible boolean not null,
  passed_rule_ids jsonb not null default '[]'::jsonb,
  failed_rule_ids jsonb not null default '[]'::jsonb,
  skipped_rule_ids jsonb not null default '[]'::jsonb,
  reasons jsonb not null default '[]'::jsonb,
  evaluated_at timestamptz not null default now(),
  constraint eligibility_results_application_unique unique (application_id)
);

create index eligibility_results_application_id_idx on public.eligibility_results (application_id);
create index eligibility_results_is_eligible_idx on public.eligibility_results (is_eligible);

-- =============================================================================
-- Row Level Security — every new table follows the exact admin-only, no-anon
-- pattern already used for clients/participants/applications/application_answers/
-- application_screenings (004_application_pipeline.sql). Public exposure is
-- mediated entirely through published_eligibility_rules below, never through
-- direct grants on these tables — identical in spirit to how
-- published_competitions mediates public hackathons access
-- (005_multi_competition_configuration.sql).
-- =============================================================================
alter table public.eligibility_rules enable row level security;
alter table public.ai_screening_criteria enable row level security;
alter table public.eligibility_results enable row level security;

create policy eligibility_rules_all_admin on public.eligibility_rules
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy ai_screening_criteria_all_admin on public.ai_screening_criteria
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- eligibility_results: admin-only. Writes happen from the admin's own
-- authenticated session (re-running the evaluator client-side/server-side
-- as an admin action) in this phase — no SECURITY DEFINER RPC is added
-- here since no anonymous/public write path is needed for F0. A future n8n
-- workflow (Phase F1+) would read this table via a service-role connection,
-- which bypasses RLS entirely, exactly like application_screenings already
-- documents for its own future AI writer.
create policy eligibility_results_all_admin on public.eligibility_results
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- -----------------------------------------------------------------------------
-- published_eligibility_rules — the ONLY public-facing surface for
-- eligibility-rule data. Explicit column whitelist: never rule_type,
-- question_id, comparison_value, is_blocking, or metadata. Filtered to
-- enabled AND blocking rules only — a disabled rule isn't a current
-- requirement, and a non-blocking rule is an internal screening signal, not
-- a published applicant-facing requirement. Standard (definer-security)
-- view: runs with the view owner's privileges, not the querying role's —
-- anon is never granted any privilege on eligibility_rules itself, only on
-- this view, mirroring published_competitions exactly.
-- -----------------------------------------------------------------------------
create view public.published_eligibility_rules
  as
  select
    id,
    hackathon_id,
    name,
    description,
    "order"
  from public.eligibility_rules
  where is_enabled = true
    and is_blocking = true;

grant select on public.published_eligibility_rules to anon, authenticated;

-- =============================================================================
-- audit_logs.action — additive widen only (see file header). Every existing
-- row's action value is one of the 12 values already allowed and remains
-- valid; this only adds 3 new allowed values for applicant-decision and
-- eligibility/AI-criteria-configuration audit entries written by the
-- Applicant Management Center and the Competition Control Center's new
-- "Eligibility & Screening" section. No existing policy on audit_logs
-- changes (audit_logs_select_admin / audit_logs_insert_authenticated from
-- 001_initial_schema.sql remain exactly as they are).
-- =============================================================================
alter table public.audit_logs
  drop constraint audit_logs_action_check;

alter table public.audit_logs
  add constraint audit_logs_action_check check (action = any (array[
    'evaluation_submitted',
    'evaluation_reopened',
    'judge_created',
    'judge_updated',
    'project_created',
    'project_updated',
    'assignment_created',
    'assignment_removed',
    'criterion_created',
    'criterion_updated',
    'hackathon_created',
    'hackathon_updated',
    'application_status_changed',
    'eligibility_rule_changed',
    'ai_criterion_changed'
  ]));
