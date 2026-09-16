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

export type HackathonRow = {
  id: string;
  name: string;
  description: string | null;
  start_date: string;
  end_date: string;
  status: "draft" | "open_for_evaluation" | "completed" | "archived";
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
    | "hackathon_updated";
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

export type Database = {
  public: {
    Tables: {
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
    };
    Views: Record<string, never>;
    Functions: {
      submit_evaluation: {
        Args: SubmitEvaluationArgs;
        Returns: EvaluationRow;
      };
    };
  };
};
