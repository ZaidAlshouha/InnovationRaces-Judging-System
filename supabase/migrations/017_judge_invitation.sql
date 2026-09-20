-- =============================================================================
-- InnovationRaces Judging System — Admin Judge Account Management
--
-- Adds only what the existing `judges` schema genuinely lacks for the
-- Admin Judge Account Management feature. Everything else this feature
-- needs already exists and is reused as-is:
--   - judges.hackathon_id (001_initial_schema.sql): a judge already belongs
--     to exactly one hackathon per row; "a judge in multiple hackathons" is
--     already representable as multiple judges rows sharing one
--     judges.user_id once linked — no join table is introduced here.
--   - judges.user_id -> auth.users.id, on delete set null
--     (001_initial_schema.sql): the sole Auth linkage column. Untouched.
--   - judges.status ('active'/'inactive', 001_initial_schema.sql): already
--     the enable/disable mechanism this feature needs. Untouched.
--   - handle_new_auth_user() / link_judge_to_existing_auth_user() / their
--     triggers (002_auth_linkage.sql): the bidirectional auto-linking
--     between a judges row and an auth.users row by email. Untouched —
--     this migration relies on them exactly as they already run.
--   - judges_select_admin / judges_write_admin / judges_update_admin /
--     judges_delete_admin / judges_select_self RLS policies
--     (001_initial_schema.sql): already permit an authenticated admin
--     (is_admin()) to select/insert/update/delete any judges row, and a
--     judge to select their own row. Untouched, and this feature's judges
--     INSERT/UPDATE goes through these existing policies under the
--     signed-in admin's own session — not through service_role, so no new
--     grant is needed on `judges` either.
--
-- What is genuinely missing:
--   - judges.phone (nullable) and judges.notes (nullable): the Add Judge
--     dialog's optional fields have nowhere to be stored today. Both
--     purely additive, nullable, no default needed — existing rows are
--     unaffected.
--   - 2 new audit_logs.action values (additive widen, same pattern as
--     008/016's own widens): judge_invited, judge_disabled/judge_enabled.
--     judge_created/judge_updated already exist and are reused for the
--     "judge row created" and "judge details edited" events; only the
--     invitation-sent and enable/disable-specific events are new.
--
-- Widened from the LIVE constraint definition (confirmed via
-- pg_get_constraintdef before writing this migration, exactly like
-- 016_hackathon_archiving.sql's own note on why this matters — the file
-- history alone is not always a reliable source for what is live).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. judges.phone / judges.notes — optional, purely additive.
-- -----------------------------------------------------------------------------
alter table public.judges
  add column phone text,
  add column notes text;

comment on column public.judges.phone is
  'Optional contact phone, set by the admin when inviting/editing a judge. Never used for Auth (email + Supabase Auth session remain the only sign-in identity).';
comment on column public.judges.notes is
  'Optional free-text admin note about this judge (e.g. area of expertise). Never shown to the judge themselves — admin-only, same visibility as the rest of this table (judges_select_self only exposes a judge''s own row, and this column carries no judge-facing UI).';

-- -----------------------------------------------------------------------------
-- 2. audit_logs.action — additive widen, 2 new values.
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
    'applicant_removed_from_group',
    'hackathon_archived',
    'hackathon_restored',
    'judge_invited',
    'judge_disabled',
    'judge_enabled'
  ]));
