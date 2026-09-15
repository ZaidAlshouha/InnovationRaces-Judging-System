import { z } from "zod";

export const AuditAction = {
  EvaluationSubmitted: "evaluation_submitted",
  EvaluationReopened: "evaluation_reopened",
  JudgeCreated: "judge_created",
  JudgeUpdated: "judge_updated",
  ProjectCreated: "project_created",
  ProjectUpdated: "project_updated",
  AssignmentCreated: "assignment_created",
  AssignmentRemoved: "assignment_removed",
  CriterionCreated: "criterion_created",
  CriterionUpdated: "criterion_updated",
  HackathonCreated: "hackathon_created",
  HackathonUpdated: "hackathon_updated",
} as const;

export type AuditAction = (typeof AuditAction)[keyof typeof AuditAction];

export const AUDIT_ACTION_LABELS_AR: Record<AuditAction, string> = {
  [AuditAction.EvaluationSubmitted]: "أرسل تقييمًا",
  [AuditAction.EvaluationReopened]: "أعاد فتح تقييم",
  [AuditAction.JudgeCreated]: "أضاف محكّمًا جديدًا",
  [AuditAction.JudgeUpdated]: "عدّل بيانات محكّم",
  [AuditAction.ProjectCreated]: "أضاف مشروعًا جديدًا",
  [AuditAction.ProjectUpdated]: "عدّل بيانات مشروع",
  [AuditAction.AssignmentCreated]: "أضاف توزيع محكّم على مشروع",
  [AuditAction.AssignmentRemoved]: "أزال توزيع محكّم عن مشروع",
  [AuditAction.CriterionCreated]: "أضاف معيار تقييم جديد",
  [AuditAction.CriterionUpdated]: "عدّل معيار تقييم",
  [AuditAction.HackathonCreated]: "أنشأ هاكاثونًا جديدًا",
  [AuditAction.HackathonUpdated]: "عدّل بيانات هاكاثون",
};

export const auditLogSchema = z.object({
  id: z.string(),
  hackathonId: z.string(),
  action: z.enum([
    AuditAction.EvaluationSubmitted,
    AuditAction.EvaluationReopened,
    AuditAction.JudgeCreated,
    AuditAction.JudgeUpdated,
    AuditAction.ProjectCreated,
    AuditAction.ProjectUpdated,
    AuditAction.AssignmentCreated,
    AuditAction.AssignmentRemoved,
    AuditAction.CriterionCreated,
    AuditAction.CriterionUpdated,
    AuditAction.HackathonCreated,
    AuditAction.HackathonUpdated,
  ]),
  actorUserId: z.string(),
  actorName: z.string(),
  entityType: z.string(),
  entityId: z.string(),
  /** Human-readable summary in Arabic, e.g. "أحمد أرسل تقييم فريق Alpha". */
  summary: z.string(),
  previousValue: z.unknown().optional(),
  newValue: z.unknown().optional(),
  createdAt: z.string(),
});

export type AuditLog = z.infer<typeof auditLogSchema>;

export type CreateAuditLogInput = Omit<AuditLog, "id" | "createdAt">;
