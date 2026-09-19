-- =============================================================================
-- InnovationRaces Judging System — Form Question Enabled State (Phase D)
--
-- Schema limitation discovered while building the Dynamic Form Builder:
-- application_form_questions (004_application_pipeline.sql) has no
-- enabled/disabled column. The Form Builder must let an admin "soft disable"
-- a question instead of destructively deleting one that already has
-- historical application_answers referencing it (application_answers.
-- question_id is ON DELETE RESTRICT, by design, to protect historical data).
-- Without this column there is no way to hide a question from future
-- submissions while preserving its historical answers.
--
-- Single additive column, safe default, no RLS/grant changes needed —
-- existing application_form_questions_write_admin / _select_admin /
-- _select_public policies already cover it via `select *` / whole-row
-- writes. Existing rows are unaffected: every current question becomes
-- is_enabled = true, i.e. no behavior change for what's already in the
-- database. submit_application() is not modified by this migration and
-- does not reference is_enabled — it is not in scope for Phase D to change
-- that function, and enforcing is_enabled at submission time is left for
-- the future public-application phase.
-- =============================================================================

alter table public.application_form_questions
  add column is_enabled boolean not null default true;
