-- =============================================================================
-- InnovationRaces Judging System — Grouping / Team Assignment (Phase F3)
--
-- public.groups and public.group_members ALREADY EXIST, deployed since
-- 004_application_pipeline.sql, with RLS enabled and admin-only policies
-- (groups_all_admin / group_members_all_admin). No application code was ever
-- built against them. This migration does NOT create new tables — it only:
--   1. Adds the two columns the Grouping Center needs that the original
--      004 schema didn't include (description, capacity).
--   2. Grants `authenticated` the base table privileges it needs to use
--      these tables at all — the exact same missing-GRANT bug already found
--      and fixed for applications/eligibility_results/etc. in migration 009.
--      RLS policies were already correct; PostgREST was 403-ing before RLS
--      ever ran, for the same root-cause reason.
--   3. Widens audit_logs.action (additive-only, same pattern as
--      008_eligibility_and_screening_configuration.sql) to allow the 4 new
--      group-related audit actions.
--
-- Untouched by this migration: applications, application_answers,
-- eligibility_results, application_screenings, application_forms,
-- application_form_questions, eligibility_rules, ai_screening_criteria
-- (all already fixed/correct from migration 009), every judging table
-- (projects/judges/criteria/assignments/evaluations/evaluation_scores),
-- whatsapp_messages (left exactly as-is — no automation added, per Phase F3
-- scope), and every existing RLS policy on any table (none dropped, none
-- created here beyond what 004 already defined).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. New columns on the existing public.groups table (additive only)
-- -----------------------------------------------------------------------------
alter table public.groups add column description text;

alter table public.groups add column capacity integer not null default 0
  check (capacity >= 0);
-- capacity = 0 means "unlimited" (no cap enforced). Capacity is enforced in
-- the application/repository layer (GroupRepository.assign()/move() check
-- current member count < capacity when capacity > 0), matching how this
-- codebase already enforces comparable business rules elsewhere (e.g.
-- "one application_forms row per hackathon" in
-- SupabaseApplicationFormRepository.create()) rather than a DB trigger.

comment on column public.groups.capacity is
  'Maximum group_members rows for this group. 0 = unlimited. Enforced by GroupRepository, not a DB constraint/trigger.';

-- -----------------------------------------------------------------------------
-- 2. Grant authenticated the privileges the admin Grouping Center needs.
--    groups_all_admin / group_members_all_admin (004_application_pipeline.sql)
--    are unchanged and remain the actual row-level access boundary — this
--    only lets `authenticated` attempt the table at all, exactly like
--    migration 009 did for applications/eligibility_results/etc.
--    No grant to `anon` — groups are never publicly readable.
-- -----------------------------------------------------------------------------
grant select, insert, update, delete on public.groups to authenticated;
grant select, insert, update, delete on public.group_members to authenticated;

-- -----------------------------------------------------------------------------
-- 3. Widen audit_logs.action — additive only (see file header / migration
--    008's own identical pattern). Every existing row's action value is one
--    of the 18 values already allowed and remains valid; this only adds 4
--    new allowed values for group-management audit entries.
-- -----------------------------------------------------------------------------
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
    'ai_criterion_changed',
    'group_created',
    'applicant_assigned_to_group',
    'applicant_moved_between_groups',
    'applicant_removed_from_group'
  ]));
