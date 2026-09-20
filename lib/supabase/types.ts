/**
 * Hand-written row types matching supabase/migrations/001_initial_schema.sql
 * and 002_auth_linkage.sql exactly. Not generated via the Supabase CLI —
 * keep this file in sync by hand whenever those migrations change.
 *
 * These are the wire-format (snake_case, nullable-as-written) shapes;
 * lib/data/supabase/shared.ts maps them to the camelCase domain types in
 * lib/domain/*.ts. Nothing outside lib/data/supabase/* should import this
 * file — the rest of the app depends only on lib/domain/*.
 *
 * Every table type below must be declared with `type`, not `interface`:
 * supabase-js's generic client checks each table against
 * `Record<string, unknown>` via a conditional (`extends`) type, and
 * TypeScript does not consider a named `interface` to structurally satisfy
 * an index-signature type that way even when a `type` with the identical
 * members does — using `interface` here silently collapses every
 * insert/update call's argument type to `never`.
 *
 * Insert/Update variants exist because supabase-js's generic client types
 * .insert()/.update() against them specifically (defaulting to `never` if a
 * table only declares Row) — they are not read anywhere else in this repo.
 */

export type ClientRow = {
  id: string;
  name: string;
  contact_email: string | null;
  contact_phone: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};
export type ClientInsert = Partial<ClientRow> & Pick<ClientRow, "name">;
export type ClientUpdate = Partial<ClientRow>;

export type HackathonRow = {
  id: string;
  name: string;
  description: string | null;
  client_id: string | null;
  start_date: string;
  end_date: string;
  status: "draft" | "open_for_evaluation" | "completed" | "archived";
  /** Public landing-page visibility, added in 005_multi_competition_configuration.sql. */
  is_published: boolean;
  /** Branding/config columns, all added in 005_multi_competition_configuration.sql. */
  slug: string | null;
  logo_url: string | null;
  hero_image_url: string | null;
  primary_color: string | null;
  secondary_color: string | null;
  accent_color: string | null;
  landing_content: string | null;
  /** Actual scheduled start date+time, added in 011_whatsapp_automation.sql (Phase F4) — distinct from start_date/end_date above. Nullable. */
  event_datetime: string | null;
  /** NULL = active, NOT NULL = archived (016_hackathon_archiving.sql). Distinct from status/is_published — see the migration's own header note. */
  archived_at: string | null;
  created_at: string;
  updated_at: string;
};
export type HackathonInsert = Partial<HackathonRow> &
  Pick<HackathonRow, "name" | "start_date" | "end_date">;
export type HackathonUpdate = Partial<HackathonRow>;

export type ProjectRow = {
  id: string;
  hackathon_id: string;
  project_number: number;
  team_name: string;
  project_name: string;
  description: string | null;
  category: string | null;
  project_url: string | null;
  demo_url: string | null;
  additional_info: string | null;
  created_at: string;
  updated_at: string;
};
export type ProjectInsert = Partial<ProjectRow> &
  Pick<
    ProjectRow,
    "hackathon_id" | "project_number" | "team_name" | "project_name"
  >;
export type ProjectUpdate = Partial<ProjectRow>;

export type JudgeRow = {
  id: string;
  hackathon_id: string;
  user_id: string | null;
  name: string;
  email: string;
  status: "active" | "inactive";
  /** Optional contact phone, added in 017_judge_invitation.sql. */
  phone: string | null;
  /** Optional admin-only note, added in 017_judge_invitation.sql. */
  notes: string | null;
  created_at: string;
  updated_at: string;
};
export type JudgeInsert = Partial<JudgeRow> &
  Pick<JudgeRow, "hackathon_id" | "name" | "email">;
export type JudgeUpdate = Partial<JudgeRow>;

export type CriterionRow = {
  id: string;
  hackathon_id: string;
  name: string;
  description: string | null;
  weight: number;
  max_score: number;
  order: number;
  created_at: string;
  updated_at: string;
};
export type CriterionInsert = Partial<CriterionRow> &
  Pick<CriterionRow, "hackathon_id" | "name" | "weight">;
export type CriterionUpdate = Partial<CriterionRow>;

export type AssignmentRow = {
  id: string;
  hackathon_id: string;
  judge_id: string;
  project_id: string;
  status: "pending" | "in_progress" | "completed";
  assigned_at: string;
  updated_at: string;
};
export type AssignmentInsert = Partial<AssignmentRow> &
  Pick<AssignmentRow, "hackathon_id" | "judge_id" | "project_id">;
export type AssignmentUpdate = Partial<AssignmentRow>;

export type EvaluationRow = {
  id: string;
  hackathon_id: string;
  assignment_id: string;
  judge_id: string;
  project_id: string;
  status: "draft" | "submitted";
  submitted_at: string | null;
  reopened_at: string | null;
  created_at: string;
  updated_at: string;
};
export type EvaluationInsert = Partial<EvaluationRow> &
  Pick<
    EvaluationRow,
    "hackathon_id" | "assignment_id" | "judge_id" | "project_id"
  >;
export type EvaluationUpdate = Partial<EvaluationRow>;

export type EvaluationScoreRow = {
  id: string;
  evaluation_id: string;
  criterion_id: string;
  score: number;
  comment: string | null;
};
export type EvaluationScoreInsert = Partial<EvaluationScoreRow> &
  Pick<EvaluationScoreRow, "evaluation_id" | "criterion_id" | "score">;
export type EvaluationScoreUpdate = Partial<EvaluationScoreRow>;

export type UserRow = {
  id: string;
  email: string;
  name: string;
  role: "admin" | "judge";
  created_at: string;
  updated_at: string;
};
export type UserInsert = Partial<UserRow> &
  Pick<UserRow, "id" | "email" | "name" | "role">;
export type UserUpdate = Partial<UserRow>;

/**
 * application_forms / application_form_questions / applications /
 * application_answers / participants — all from
 * 004_application_pipeline.sql. `is_enabled` on
 * ApplicationFormQuestionRow was added in
 * 006_form_question_enabled_state.sql (Phase D).
 */
export type ApplicationFormRow = {
  id: string;
  hackathon_id: string;
  title: string;
  description: string | null;
  status: "draft" | "published" | "closed";
  opens_at: string | null;
  closes_at: string | null;
  created_at: string;
  updated_at: string;
};
export type ApplicationFormInsert = Partial<ApplicationFormRow> &
  Pick<ApplicationFormRow, "hackathon_id" | "title">;
export type ApplicationFormUpdate = Partial<ApplicationFormRow>;

export type ApplicationFormQuestionRow = {
  id: string;
  form_id: string;
  question_text: string;
  question_type:
    | "short_text"
    | "long_text"
    | "single_choice"
    | "multi_choice"
    | "number"
    | "email"
    | "phone"
    | "file_upload"
    | "url";
  options: string[] | null;
  is_required: boolean;
  order: number;
  help_text: string | null;
  placeholder: string | null;
  is_enabled: boolean;
  /** Added by supabase/migrations/012_file_upload_question_metadata.sql — NOT YET APPLIED, see that file's header. `{ documentPurpose?: string }` today, meaningful only for question_type = 'file_upload'. */
  metadata: { documentPurpose?: string } | null;
  created_at: string;
  updated_at: string;
};
export type ApplicationFormQuestionInsert = Partial<ApplicationFormQuestionRow> &
  Pick<ApplicationFormQuestionRow, "form_id" | "question_text" | "question_type">;
export type ApplicationFormQuestionUpdate = Partial<ApplicationFormQuestionRow>;

/**
 * Read-only in this phase — used only to check whether a question has
 * historical answers before allowing deletion. No repository writes these;
 * `ApplicationAnswerInsert`/`Update` are declared solely because
 * supabase-js's generic table constraints require Insert/Update members to
 * exist on every table entered into `Database.Tables` (see file-header
 * note), not because anything in this phase performs those operations.
 */
export type ApplicationAnswerRow = {
  id: string;
  application_id: string;
  question_id: string;
  answer_text: string | null;
  answer_options: string[] | null;
  /** Added in 007_application_file_uploads.sql — populated only together, only for a file_upload answer. */
  file_path: string | null;
  file_metadata: { original_filename: string; mime_type: string; size_bytes: number } | null;
  created_at: string;
  updated_at: string;
};
export type ApplicationAnswerInsert = Partial<ApplicationAnswerRow> &
  Pick<ApplicationAnswerRow, "application_id" | "question_id">;
export type ApplicationAnswerUpdate = Partial<ApplicationAnswerRow>;

/**
 * `applications` (004_application_pipeline.sql). `anon` still has zero
 * direct SELECT/INSERT/UPDATE grant on this table (confirmed live) — the
 * only reason it is declared as a real `Database.Tables` entry (Phase E.1)
 * is that the server-only admin client
 * (lib/supabase/server-admin-client.ts, service_role, used exclusively by
 * app/api/applications/*) reads it directly to authorize upload requests,
 * since it cannot call the anon-scoped repository layer's RLS-gated reads
 * for a table anon cannot see at all. The browser-side app never imports
 * this type or queries this table directly — only submit_application(),
 * initiate_application(), register_application_file(), and
 * finalize_application() (all SECURITY DEFINER RPCs) do.
 */
export type ApplicationRow = {
  id: string;
  hackathon_id: string;
  form_id: string;
  participant_id: string;
  /** 'draft' added in 007_application_file_uploads.sql for the two-step file-upload flow (see initiate_application()/finalize_application()). */
  status:
    | "draft"
    | "submitted"
    | "under_review"
    | "accepted"
    | "rejected"
    | "waitlisted";
  submitted_at: string;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
};
export type ApplicationInsert = Partial<ApplicationRow> &
  Pick<ApplicationRow, "hackathon_id" | "form_id" | "participant_id">;
export type ApplicationUpdate = Partial<ApplicationRow>;

/**
 * `participants` (004_application_pipeline.sql). Declared here (Phase F0)
 * for the same reason `ApplicationRow` was declared in Phase E.1: the
 * Applicant Management Center reads this table directly under the admin's
 * own authenticated session (`participants_all_admin` policy, admin-only,
 * already existed since 004) — no new RLS policy is needed, only this type
 * so the admin-facing ApplicationRepository can type its `.from("participants")`
 * calls. Never used by the public/anonymous flow, which only ever reaches
 * this table indirectly through submit_application()/initiate_application().
 */
export type ParticipantRow = {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  created_at: string;
  updated_at: string;
};
export type ParticipantInsert = Partial<ParticipantRow> &
  Pick<ParticipantRow, "full_name" | "email">;
export type ParticipantUpdate = Partial<ParticipantRow>;

/**
 * `application_screenings` (004_application_pipeline.sql) — read-only in
 * this phase (Applicant Management displays the latest screening result;
 * F0 writes no screening rows itself, per "Do NOT implement AI execution in
 * F0"). Declared here for the same admin-read reason as ParticipantRow above.
 */
export type ApplicationScreeningRow = {
  id: string;
  application_id: string;
  screened_by: "ai" | "admin";
  score: number | null;
  recommendation: "accept" | "reject" | "waitlist" | "needs_review" | null;
  notes: string | null;
  raw_result: unknown;
  created_at: string;
};
export type ApplicationScreeningInsert = Partial<ApplicationScreeningRow> &
  Pick<ApplicationScreeningRow, "application_id" | "screened_by">;
export type ApplicationScreeningUpdate = Partial<ApplicationScreeningRow>;

export type AuditLogRow = {
  id: string;
  hackathon_id: string;
  action:
    | "evaluation_submitted"
    | "evaluation_reopened"
    | "judge_created"
    | "judge_updated"
    | "project_created"
    | "project_updated"
    | "assignment_created"
    | "assignment_removed"
    | "criterion_created"
    | "criterion_updated"
    | "hackathon_created"
    | "hackathon_updated"
    /** Added in 008_eligibility_and_screening_configuration.sql (Phase F0). */
    | "application_status_changed"
    | "eligibility_rule_changed"
    | "ai_criterion_changed"
    /** Added in 010_group_assignment.sql (Phase F3 — Grouping / Team Assignment). */
    | "group_created"
    | "applicant_assigned_to_group"
    | "applicant_moved_between_groups"
    | "applicant_removed_from_group"
    /** Added in 016_hackathon_archiving.sql. */
    | "hackathon_archived"
    | "hackathon_restored"
    /** Added in 017_judge_invitation.sql. */
    | "judge_invited"
    | "judge_disabled"
    | "judge_enabled";
  actor_user_id: string;
  actor_name: string;
  entity_type: string;
  entity_id: string;
  summary: string;
  previous_value: unknown;
  new_value: unknown;
  created_at: string;
};
export type AuditLogInsert = Partial<AuditLogRow> &
  Pick<
    AuditLogRow,
    | "hackathon_id"
    | "action"
    | "actor_user_id"
    | "actor_name"
    | "entity_type"
    | "entity_id"
    | "summary"
  >;
export type AuditLogUpdate = Partial<AuditLogRow>;

/**
 * eligibility_rules / ai_screening_criteria / eligibility_results
 * (008_eligibility_and_screening_configuration.sql, Phase F0).
 */
export type EligibilityRuleRow = {
  id: string;
  hackathon_id: string;
  name: string;
  description: string | null;
  rule_type:
    | "age_min"
    | "age_max"
    | "answer_equals"
    | "answer_contains"
    | "answer_in"
    | "number_range"
    | "field_required"
    | "document_required";
  question_id: string | null;
  comparison_value: {
    text?: string;
    number?: number;
    min?: number;
    max?: number;
    values?: string[];
  } | null;
  is_enabled: boolean;
  is_blocking: boolean;
  failure_message: string;
  order: number;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};
export type EligibilityRuleInsert = Partial<EligibilityRuleRow> &
  Pick<EligibilityRuleRow, "hackathon_id" | "name" | "rule_type" | "failure_message">;
export type EligibilityRuleUpdate = Partial<EligibilityRuleRow>;

export type AiScreeningCriterionRow = {
  id: string;
  hackathon_id: string;
  name: string;
  description: string | null;
  weight: number;
  is_enabled: boolean;
  order: number;
  created_at: string;
  updated_at: string;
};
export type AiScreeningCriterionInsert = Partial<AiScreeningCriterionRow> &
  Pick<AiScreeningCriterionRow, "hackathon_id" | "name" | "weight">;
export type AiScreeningCriterionUpdate = Partial<AiScreeningCriterionRow>;

export type EligibilityResultRow = {
  id: string;
  application_id: string;
  is_eligible: boolean;
  passed_rule_ids: string[];
  failed_rule_ids: string[];
  skipped_rule_ids: string[];
  reasons: string[];
  evaluated_at: string;
};
export type EligibilityResultInsert = Partial<EligibilityResultRow> &
  Pick<EligibilityResultRow, "application_id" | "is_eligible">;
export type EligibilityResultUpdate = Partial<EligibilityResultRow>;

/**
 * `public.groups` (004_application_pipeline.sql; description/capacity added
 * in 010_group_assignment.sql, Phase F3 — Grouping / Team Assignment).
 * capacity = 0 means unlimited — enforced by GroupRepository, not a DB
 * constraint.
 */
export type GroupRow = {
  id: string;
  hackathon_id: string;
  name: string;
  description: string | null;
  capacity: number;
  created_at: string;
  updated_at: string;
};
export type GroupInsert = Partial<GroupRow> &
  Pick<GroupRow, "hackathon_id" | "name">;
export type GroupUpdate = Partial<GroupRow>;

/**
 * `public.group_members` (004_application_pipeline.sql). UNIQUE(application_id)
 * (group_members_participant_unique_per_hackathon) is the DB-level backstop
 * for "one group per application" — see GroupRepository.
 */
export type GroupMemberRow = {
  id: string;
  group_id: string;
  application_id: string;
  created_at: string;
};
export type GroupMemberInsert = Partial<GroupMemberRow> &
  Pick<GroupMemberRow, "group_id" | "application_id">;
export type GroupMemberUpdate = Partial<GroupMemberRow>;

/**
 * `public.whatsapp_messages` (004_application_pipeline.sql) — append-only
 * notification/delivery log written by the "InnovationRaces — WhatsApp
 * Notifications" n8n workflow (Phase F4). The Next.js app only ever READS
 * this table (authenticated has SELECT only, granted in
 * 011_whatsapp_automation.sql) — no repository method here inserts/updates
 * a row; that stays exclusively n8n's job via its own Postgres credential.
 */
export type WhatsappMessageRow = {
  id: string;
  application_id: string;
  message_type: "accepted" | "rejected" | "group_assigned" | "reminder" | "other";
  phone: string;
  status: "pending" | "sent" | "delivered" | "failed";
  provider_message_id: string | null;
  error_message: string | null;
  sent_at: string | null;
  created_at: string;
};

/**
 * `public.hackathon_reminder_settings` (011_whatsapp_automation.sql,
 * Phase F4) — one row per hackathon, admin-configurable WhatsApp reminder
 * schedule. n8n reads this fresh on every poll; no timing is hard-coded in
 * the workflow.
 */
export type HackathonReminderSettingsRow = {
  hackathon_id: string;
  is_enabled: boolean;
  lead_time_value: number;
  lead_time_unit: "hours" | "days";
  send_at_time: string;
  updated_at: string;
};
export type HackathonReminderSettingsInsert = Partial<HackathonReminderSettingsRow> &
  Pick<HackathonReminderSettingsRow, "hackathon_id">;
export type HackathonReminderSettingsUpdate = Partial<HackathonReminderSettingsRow>;

/**
 * `public.published_eligibility_rules`
 * (008_eligibility_and_screening_configuration.sql) — public-safe column
 * whitelist, filtered to is_enabled = true AND is_blocking = true. Mirrors
 * `PublishedCompetitionRow`'s own read-only view type exactly.
 */
export type PublishedEligibilityRuleRow = {
  id: string;
  hackathon_id: string;
  name: string;
  description: string | null;
  order: number;
};

/**
 * Minimal Database shape for typing the Supabase client's .from() calls.
 * `Relationships`, `Views`, and `Functions` are required (empty) members —
 * current @supabase/postgrest-js's GenericTable/GenericSchema constraints
 * require them to be present for the generic to resolve at all; omitting
 * them silently falls back to `never` for every row/insert/update type
 * instead of erroring, which is why they're spelled out here even though
 * this schema defines no views or foreign-key relationship metadata beyond
 * what Row/Insert/Update already capture.
 */
type NoRelationships = { Relationships: [] };

/**
 * Args/Returns for supabase/migrations/003_submit_evaluation.sql's RPC.
 * p_scores is typed as the exact shape SupabaseEvaluationRepository.submit()
 * sends — { criterion_id, score, comment }[] — matching the columns
 * jsonb_to_recordset() parses it into inside the function body.
 */
export type SubmitEvaluationArgs = {
  p_assignment_id: string;
  p_scores: { criterion_id: string; score: number; comment: string | null }[];
};

/**
 * Args/Returns for submit_application() (004_application_pipeline.sql,
 * signature confirmed by inspecting the live function before writing this
 * type — see docs in lib/data/supabase/published-application-repository.ts).
 * p_answers is typed as the exact shape jsonb_to_recordset() parses it into
 * inside the function body: { question_id, answer_text, answer_options }[].
 */
export type SubmitApplicationArgs = {
  p_hackathon_id: string;
  p_form_id: string;
  p_full_name: string;
  p_email: string;
  p_phone: string | null;
  p_answers: {
    question_id: string;
    answer_text: string | null;
    answer_options: string[] | null;
  }[];
};

/** Args/Returns for initiate_application() (007_application_file_uploads.sql). */
export type InitiateApplicationArgs = {
  p_hackathon_id: string;
  p_form_id: string;
  p_full_name: string;
  p_email: string;
  p_phone: string | null;
};

/**
 * Args for register_application_file() (007_application_file_uploads.sql).
 * Returns the previous file_path (text) if the file was replaced, or null.
 */
export type RegisterApplicationFileArgs = {
  p_application_id: string;
  p_question_id: string;
  p_storage_path: string;
  p_original_filename: string;
  p_mime_type: string;
  p_size_bytes: number;
};

/**
 * Args/Returns for finalize_application() (007_application_file_uploads.sql).
 * p_answers carries only non-file answers — file answers were already
 * registered via register_application_file() earlier in the flow.
 */
export type FinalizeApplicationArgs = {
  p_application_id: string;
  p_answers: {
    question_id: string;
    answer_text: string | null;
    answer_options: string[] | null;
  }[];
};

/**
 * `public.published_competitions` (005_multi_competition_configuration.sql)
 * — a plain (non-`security_invoker`) view exposing an explicit column
 * whitelist from `hackathons`, filtered to `is_published = true`. Read-only:
 * this app never writes to it. Declared as a Row-only view type per
 * supabase-js's `GenericView` shape.
 */
export type PublishedCompetitionRow = {
  id: string;
  name: string;
  description: string | null;
  slug: string | null;
  logo_url: string | null;
  hero_image_url: string | null;
  primary_color: string | null;
  secondary_color: string | null;
  accent_color: string | null;
  landing_content: string | null;
  start_date: string;
  end_date: string;
  created_at: string;
};

export type Database = {
  public: {
    Tables: {
      clients: {
        Row: ClientRow;
        Insert: ClientInsert;
        Update: ClientUpdate;
      } & NoRelationships;
      hackathons: {
        Row: HackathonRow;
        Insert: HackathonInsert;
        Update: HackathonUpdate;
      } & NoRelationships;
      projects: {
        Row: ProjectRow;
        Insert: ProjectInsert;
        Update: ProjectUpdate;
      } & NoRelationships;
      judges: {
        Row: JudgeRow;
        Insert: JudgeInsert;
        Update: JudgeUpdate;
      } & NoRelationships;
      criteria: {
        Row: CriterionRow;
        Insert: CriterionInsert;
        Update: CriterionUpdate;
      } & NoRelationships;
      assignments: {
        Row: AssignmentRow;
        Insert: AssignmentInsert;
        Update: AssignmentUpdate;
      } & NoRelationships;
      evaluations: {
        Row: EvaluationRow;
        Insert: EvaluationInsert;
        Update: EvaluationUpdate;
      } & NoRelationships;
      evaluation_scores: {
        Row: EvaluationScoreRow;
        Insert: EvaluationScoreInsert;
        Update: EvaluationScoreUpdate;
      } & NoRelationships;
      users: {
        Row: UserRow;
        Insert: UserInsert;
        Update: UserUpdate;
      } & NoRelationships;
      audit_logs: {
        Row: AuditLogRow;
        Insert: AuditLogInsert;
        Update: AuditLogUpdate;
      } & NoRelationships;
      application_forms: {
        Row: ApplicationFormRow;
        Insert: ApplicationFormInsert;
        Update: ApplicationFormUpdate;
      } & NoRelationships;
      application_form_questions: {
        Row: ApplicationFormQuestionRow;
        Insert: ApplicationFormQuestionInsert;
        Update: ApplicationFormQuestionUpdate;
      } & NoRelationships;
      application_answers: {
        Row: ApplicationAnswerRow;
        Insert: ApplicationAnswerInsert;
        Update: ApplicationAnswerUpdate;
      } & NoRelationships;
      applications: {
        Row: ApplicationRow;
        Insert: ApplicationInsert;
        Update: ApplicationUpdate;
      } & NoRelationships;
      participants: {
        Row: ParticipantRow;
        Insert: ParticipantInsert;
        Update: ParticipantUpdate;
      } & NoRelationships;
      application_screenings: {
        Row: ApplicationScreeningRow;
        Insert: ApplicationScreeningInsert;
        Update: ApplicationScreeningUpdate;
      } & NoRelationships;
      eligibility_rules: {
        Row: EligibilityRuleRow;
        Insert: EligibilityRuleInsert;
        Update: EligibilityRuleUpdate;
      } & NoRelationships;
      ai_screening_criteria: {
        Row: AiScreeningCriterionRow;
        Insert: AiScreeningCriterionInsert;
        Update: AiScreeningCriterionUpdate;
      } & NoRelationships;
      eligibility_results: {
        Row: EligibilityResultRow;
        Insert: EligibilityResultInsert;
        Update: EligibilityResultUpdate;
      } & NoRelationships;
      groups: {
        Row: GroupRow;
        Insert: GroupInsert;
        Update: GroupUpdate;
      } & NoRelationships;
      group_members: {
        Row: GroupMemberRow;
        Insert: GroupMemberInsert;
        Update: GroupMemberUpdate;
      } & NoRelationships;
      whatsapp_messages: {
        Row: WhatsappMessageRow;
        Insert: WhatsappMessageRow;
        Update: Partial<WhatsappMessageRow>;
      } & NoRelationships;
      hackathon_reminder_settings: {
        Row: HackathonReminderSettingsRow;
        Insert: HackathonReminderSettingsInsert;
        Update: HackathonReminderSettingsUpdate;
      } & NoRelationships;
    };
    Views: {
      published_competitions: {
        Row: PublishedCompetitionRow;
      } & NoRelationships;
      published_eligibility_rules: {
        Row: PublishedEligibilityRuleRow;
      } & NoRelationships;
    };
    Functions: {
      submit_evaluation: {
        Args: SubmitEvaluationArgs;
        Returns: EvaluationRow;
      };
      submit_application: {
        Args: SubmitApplicationArgs;
        Returns: ApplicationRow;
      };
      initiate_application: {
        Args: InitiateApplicationArgs;
        Returns: ApplicationRow;
      };
      register_application_file: {
        Args: RegisterApplicationFileArgs;
        Returns: string | null;
      };
      finalize_application: {
        Args: FinalizeApplicationArgs;
        Returns: ApplicationRow;
      };
    };
  };
};
