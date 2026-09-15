/**
 * Branded string ID types.
 *
 * Every domain entity is referenced by a stable, opaque ID — never by name.
 * Branding prevents accidentally passing a JudgeId where a ProjectId is
 * expected, even though both are plain strings at runtime (and will be
 * Postgres UUIDs once Supabase is connected).
 */

type Brand<T, B extends string> = T & { readonly __brand: B };

export type HackathonId = Brand<string, "HackathonId">;
export type ProjectId = Brand<string, "ProjectId">;
export type JudgeId = Brand<string, "JudgeId">;
export type CriterionId = Brand<string, "CriterionId">;
export type AssignmentId = Brand<string, "AssignmentId">;
export type EvaluationId = Brand<string, "EvaluationId">;
export type EvaluationScoreId = Brand<string, "EvaluationScoreId">;
export type UserId = Brand<string, "UserId">;
export type AuditLogId = Brand<string, "AuditLogId">;

export function asHackathonId(id: string): HackathonId {
  return id as HackathonId;
}
export function asProjectId(id: string): ProjectId {
  return id as ProjectId;
}
export function asJudgeId(id: string): JudgeId {
  return id as JudgeId;
}
export function asCriterionId(id: string): CriterionId {
  return id as CriterionId;
}
export function asAssignmentId(id: string): AssignmentId {
  return id as AssignmentId;
}
export function asEvaluationId(id: string): EvaluationId {
  return id as EvaluationId;
}
export function asEvaluationScoreId(id: string): EvaluationScoreId {
  return id as EvaluationScoreId;
}
export function asUserId(id: string): UserId {
  return id as UserId;
}
export function asAuditLogId(id: string): AuditLogId {
  return id as AuditLogId;
}
