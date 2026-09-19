-- =============================================================================
-- InnovationRaces Judging System — Grant authenticated-role table privileges
-- for the application/eligibility/screening pipeline (Phase F2 bugfix)
--
-- Root cause: 004_application_pipeline.sql, 007_application_file_uploads.sql
-- and 008_eligibility_and_screening_configuration.sql each defined RLS
-- policies for the `authenticated` role (e.g. applications_all_admin,
-- eligibility_results_all_admin) but never issued the underlying PostgreSQL
-- GRANT that lets `authenticated` attempt these tables at all. RLS policies
-- only restrict which ROWS a role can see once it already has table-level
-- privilege; without the GRANT, PostgREST rejects every request with 403
-- before RLS is ever evaluated — regardless of how correct the policy is.
--
-- This was invisible for `hackathons`/`clients`/`judges`/`projects`
-- (001_initial_schema.sql) because those tables received Supabase's
-- project-provisioning default authenticated/anon grants; the newer
-- application-pipeline tables did not inherit them, for reasons unrelated
-- to their RLS policies (all of which were already correct and are NOT
-- changed by this migration).
--
-- Confirmed via information_schema.role_table_grants: `authenticated` had
-- no SELECT/INSERT/UPDATE/DELETE on any of the 9 tables below (only the
-- harmless default REFERENCES/TRIGGER/TRUNCATE), which is exactly why the
-- Applicant Detail page's `applications?select=...` request returned 403
-- while `users?select=*...` (which DOES have authenticated SELECT) returned
-- 200 in the same authenticated session.
--
-- This migration ONLY grants table-level privileges. It does not:
--   - create, drop, or modify any RLS policy (every existing *_all_admin /
--     *_select_admin / *_write_admin policy from 004/007/008 is untouched
--     and remains the actual row-level access boundary)
--   - touch RLS or grants on judging tables (projects/judges/criteria/
--     assignments/evaluations/evaluation_scores) — untouched
--   - touch the anonymous/public security model: `anon` receives NO new
--     grants here. submit_application() and the file-upload RPC are
--     SECURITY DEFINER (004_application_pipeline.sql /
--     007_application_file_uploads.sql), so the anonymous public-submission
--     path already runs with the function owner's privileges and never
--     needed direct table grants on applications/participants/
--     application_answers — that remains exactly as designed.
--   - grant anything to application_screenings beyond SELECT for
--     `authenticated`: n8n writes application_screenings via a direct
--     Postgres role/credential (see the "InnovationRaces — Application
--     Screening" n8n workflow, Phase F1), not via this HTTP/PostgREST
--     `authenticated` role, so no INSERT/UPDATE grant is added here.
--
-- Privileges granted, scoped to exactly what
-- lib/data/supabase/application-repository.ts,
-- lib/data/supabase/eligibility-result-repository.ts,
-- lib/data/supabase/eligibility-rule-repository.ts,
-- lib/data/supabase/ai-screening-criterion-repository.ts,
-- lib/data/supabase/application-form-repository.ts, and
-- lib/data/supabase/application-form-question-repository.ts actually
-- perform against each table as the signed-in admin:
--   - applications:               SELECT, UPDATE   (list/getDetail; decide/markUnderReview)
--   - participants:                SELECT           (read-only join for display)
--   - application_answers:         SELECT           (admin never writes answers)
--   - application_forms:           SELECT, INSERT, UPDATE  (form-builder create()/update() — no DELETE call exists)
--   - application_form_questions:  SELECT, INSERT, UPDATE, DELETE  (form-builder CRUD; delete() relies on application_answers_question_id_fkey's existing ON DELETE RESTRICT to reject deletes of answered questions — that FK behavior is unchanged by this migration)
--   - eligibility_rules:           SELECT, INSERT, UPDATE, DELETE  (admin rule-builder CRUD)
--   - ai_screening_criteria:       SELECT, INSERT, UPDATE, DELETE  (admin criteria CRUD)
--   - eligibility_results:         SELECT, INSERT, UPDATE  (getDetail/list reads; useEvaluateApplicantEligibility's save() upserts — no DELETE call exists)
--   - application_screenings:      SELECT only  (admin reads AI screening results; never writes them)
--
-- Every grant is `TO authenticated` only — RLS policies already in place
-- continue to restrict actual rows to admins via is_admin().
-- =============================================================================

grant select, update on public.applications to authenticated;
grant select on public.participants to authenticated;
grant select on public.application_answers to authenticated;
grant select, insert, update on public.application_forms to authenticated;
grant select, insert, update, delete on public.application_form_questions to authenticated;
grant select, insert, update, delete on public.eligibility_rules to authenticated;
grant select, insert, update, delete on public.ai_screening_criteria to authenticated;
grant select, insert, update on public.eligibility_results to authenticated;
grant select on public.application_screenings to authenticated;
