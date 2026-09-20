/**
 * Snake_case <-> camelCase row/domain mappers, shared across
 * lib/data/supabase/*, plus the Postgres-error -> Arabic-message translator
 * that keeps error strings identical to lib/data/mock/* (see
 * docs/migration-plan.md step 2), so UI error handling never needs to
 * branch on which backend is active.
 */
import type { PostgrestError } from "@supabase/supabase-js";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type {
  AssignmentRow,
  AuditLogRow,
  CriterionRow,
  EvaluationRow,
  EvaluationScoreRow,
  HackathonRow,
  JudgeRow,
  ProjectRow,
} from "@/lib/supabase/types";
import type { Hackathon } from "@/lib/domain/hackathon";
import type { Project } from "@/lib/domain/project";
import type { Judge } from "@/lib/domain/judge";
import type { Criterion } from "@/lib/domain/criterion";
import type { Assignment } from "@/lib/domain/assignment";
import type { Evaluation, EvaluationScore } from "@/lib/domain/evaluation";
import type { AuditLog } from "@/lib/domain/audit-log";
import type { User } from "@/lib/domain/user";
import { UserRole } from "@/lib/domain/user";

export function supabase() {
  return getSupabaseBrowserClient();
}

export function hackathonToDomain(row: HackathonRow): Hackathon {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? undefined,
    startDate: row.start_date,
    endDate: row.end_date,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function projectToDomain(row: ProjectRow): Project {
  return {
    id: row.id,
    hackathonId: row.hackathon_id,
    projectNumber: row.project_number,
    teamName: row.team_name,
    projectName: row.project_name,
    description: row.description ?? undefined,
    category: row.category ?? undefined,
    projectUrl: row.project_url ?? undefined,
    demoUrl: row.demo_url ?? undefined,
    additionalInfo: row.additional_info ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function judgeToDomain(row: JudgeRow): Judge {
  return {
    id: row.id,
    hackathonId: row.hackathon_id,
    userId: row.user_id ?? undefined,
    name: row.name,
    email: row.email,
    phone: row.phone ?? undefined,
    notes: row.notes ?? undefined,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function criterionToDomain(row: CriterionRow): Criterion {
  return {
    id: row.id,
    hackathonId: row.hackathon_id,
    name: row.name,
    description: row.description ?? undefined,
    weight: Number(row.weight),
    maxScore: row.max_score,
    order: row.order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function assignmentToDomain(row: AssignmentRow): Assignment {
  return {
    id: row.id,
    hackathonId: row.hackathon_id,
    judgeId: row.judge_id,
    projectId: row.project_id,
    status: row.status,
    assignedAt: row.assigned_at,
    updatedAt: row.updated_at,
  };
}

export function evaluationScoreToDomain(
  row: EvaluationScoreRow
): EvaluationScore {
  return {
    id: row.id,
    evaluationId: row.evaluation_id,
    criterionId: row.criterion_id,
    score: Number(row.score),
    comment: row.comment ?? undefined,
  };
}

export function evaluationToDomain(
  row: EvaluationRow,
  scoreRows: EvaluationScoreRow[]
): Evaluation {
  return {
    id: row.id,
    hackathonId: row.hackathon_id,
    assignmentId: row.assignment_id,
    judgeId: row.judge_id,
    projectId: row.project_id,
    status: row.status,
    scores: scoreRows.map(evaluationScoreToDomain),
    submittedAt: row.submitted_at ?? undefined,
    reopenedAt: row.reopened_at ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function auditLogToDomain(row: AuditLogRow): AuditLog {
  return {
    id: row.id,
    hackathonId: row.hackathon_id,
    action: row.action,
    actorUserId: row.actor_user_id,
    actorName: row.actor_name,
    entityType: row.entity_type,
    entityId: row.entity_id,
    summary: row.summary,
    previousValue: row.previous_value ?? undefined,
    newValue: row.new_value ?? undefined,
    createdAt: row.created_at,
  };
}

/**
 * Builds the domain User for the currently-authenticated Supabase session:
 * reads the public.users profile row, then every public.judges row linked
 * to this auth identity (not just one — see docs/supabase-schema.md "Auth
 * linkage"), populating both `judgeId` (first/primary, back-compat) and
 * `judgeIdsByHackathon` (the full per-hackathon map).
 *
 * Only `status = 'active'` judges rows are included in
 * judgeId/judgeIdsByHackathon (017_judge_invitation.sql) — this is what
 * makes an admin disabling a judge (JudgeStatus.Inactive) actually take
 * effect: a disabled judge's Auth session still authenticates and their
 * `role` is still 'judge' (a real access boundary would need an RLS/DB
 * change, out of scope for this prototype-auth phase — see
 * lib/auth/require-role.tsx's own "UX convenience only" note), but every
 * hackathon they were assigned to is filtered out here, so they see zero
 * assignments and have no working judgeId for any app-level query. Their
 * historical assignments/evaluations rows are never touched by this
 * filter — only *this session's own visibility* into them is, and
 * re-activating the judge (status back to 'active') restores it
 * immediately on their next session refresh.
 */
export async function buildDomainUser(authUserId: string): Promise<User> {
  const client = supabase();

  const { data: profile, error: profileError } = await client
    .from("users")
    .select("*")
    .eq("id", authUserId)
    .single();

  if (profileError || !profile) {
    throw new Error("تعذّر العثور على بيانات المستخدم");
  }

  const base: User = {
    id: profile.id,
    email: profile.email,
    name: profile.name,
    role: profile.role,
  };

  if (profile.role !== UserRole.Judge) {
    return base;
  }

  const { data: judgeRows, error: judgesError } = await client
    .from("judges")
    .select("id, hackathon_id")
    .eq("user_id", authUserId)
    .eq("status", "active");

  if (judgesError) {
    throw new Error("تعذّر العثور على بيانات المحكّم");
  }

  const rows = judgeRows ?? [];
  if (rows.length === 0) {
    return base;
  }

  return {
    ...base,
    judgeId: rows[0].id,
    judgeIdsByHackathon: Object.fromEntries(
      rows.map((r) => [r.hackathon_id, r.id])
    ),
  };
}

/**
 * Translates known Postgres/RLS failures into the same Arabic messages the
 * mock repositories already throw, so UI error handling (toast.error(...))
 * never needs to know which backend produced the error. Falls back to the
 * raw Postgres message for anything not explicitly mapped.
 */
export function translatePostgresError(
  error: PostgrestError,
  context: {
    /** Shown when a unique-constraint violation is the duplicate-assignment one. */
    duplicateAssignment?: boolean;
    /** Shown when a row lookup by id came back empty. */
    notFoundMessage?: string;
  } = {}
): Error {
  // Postgres unique_violation
  if (error.code === "23505" && context.duplicateAssignment) {
    return new Error("هذا المحكّم مُعيّن بالفعل لهذا المشروع");
  }
  if (context.notFoundMessage && error.code === "PGRST116") {
    // PostgREST "no rows" for .single()
    return new Error(context.notFoundMessage);
  }
  return new Error(error.message);
}
