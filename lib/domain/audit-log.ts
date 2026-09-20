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
  /** Added in 008_eligibility_and_screening_configuration.sql (Phase F0). */
  ApplicationStatusChanged: "application_status_changed",
  EligibilityRuleChanged: "eligibility_rule_changed",
  AiCriterionChanged: "ai_criterion_changed",
  /** Added in 010_group_assignment.sql (Phase F3 — Grouping / Team Assignment). */
  GroupCreated: "group_created",
  ApplicantAssignedToGroup: "applicant_assigned_to_group",
  ApplicantMovedBetweenGroups: "applicant_moved_between_groups",
  ApplicantRemovedFromGroup: "applicant_removed_from_group",
  /** Added in 016_hackathon_archiving.sql. */
  HackathonArchived: "hackathon_archived",
  HackathonRestored: "hackathon_restored",
  /** Added in 017_judge_invitation.sql. */
  JudgeInvited: "judge_invited",
  JudgeDisabled: "judge_disabled",
  JudgeEnabled: "judge_enabled",
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
  [AuditAction.ApplicationStatusChanged]: "غيّر حالة طلب تقديم",
  [AuditAction.EligibilityRuleChanged]: "عدّل شرط أهلية",
  [AuditAction.AiCriterionChanged]: "عدّل معيار فرز ذكي",
  [AuditAction.GroupCreated]: "أنشأ مجموعة جديدة",
  [AuditAction.ApplicantAssignedToGroup]: "أسند متقدمًا إلى مجموعة",
  [AuditAction.ApplicantMovedBetweenGroups]: "نقل متقدمًا بين مجموعتين",
  [AuditAction.ApplicantRemovedFromGroup]: "أزال متقدمًا من مجموعة",
  [AuditAction.HackathonArchived]: "أرشف مسابقة",
  [AuditAction.HackathonRestored]: "استعاد مسابقة من الأرشيف",
  [AuditAction.JudgeInvited]: "أرسل دعوة تفعيل لمحكّم",
  [AuditAction.JudgeDisabled]: "عطّل حساب محكّم",
  [AuditAction.JudgeEnabled]: "فعّل حساب محكّم",
};

/**
 * English default audit summaries — used only for NEW audit_logs.summary
 * values written while English is the active locale. Existing/historical
 * Arabic summaries already stored in audit_logs are never rewritten or
 * retranslated (they are historical records of what actually happened,
 * not live system UI — see Phase F6 requirement "do not translate
 * database/user-generated content destructively").
 */
export const AUDIT_ACTION_LABELS_EN: Record<AuditAction, string> = {
  [AuditAction.EvaluationSubmitted]: "Submitted an evaluation",
  [AuditAction.EvaluationReopened]: "Reopened an evaluation",
  [AuditAction.JudgeCreated]: "Added a new judge",
  [AuditAction.JudgeUpdated]: "Updated judge details",
  [AuditAction.ProjectCreated]: "Added a new project",
  [AuditAction.ProjectUpdated]: "Updated project details",
  [AuditAction.AssignmentCreated]: "Assigned a judge to a project",
  [AuditAction.AssignmentRemoved]: "Removed a judge's project assignment",
  [AuditAction.CriterionCreated]: "Added a new evaluation criterion",
  [AuditAction.CriterionUpdated]: "Updated an evaluation criterion",
  [AuditAction.HackathonCreated]: "Created a new hackathon",
  [AuditAction.HackathonUpdated]: "Updated hackathon details",
  [AuditAction.ApplicationStatusChanged]: "Changed an application's status",
  [AuditAction.EligibilityRuleChanged]: "Updated an eligibility rule",
  [AuditAction.AiCriterionChanged]: "Updated an AI screening criterion",
  [AuditAction.GroupCreated]: "Created a new group",
  [AuditAction.ApplicantAssignedToGroup]: "Assigned an applicant to a group",
  [AuditAction.ApplicantMovedBetweenGroups]: "Moved an applicant between groups",
  [AuditAction.ApplicantRemovedFromGroup]: "Removed an applicant from a group",
  [AuditAction.HackathonArchived]: "Archived a hackathon",
  [AuditAction.HackathonRestored]: "Restored a hackathon from the archive",
  [AuditAction.JudgeInvited]: "Sent a judge an activation invitation",
  [AuditAction.JudgeDisabled]: "Disabled a judge's account",
  [AuditAction.JudgeEnabled]: "Enabled a judge's account",
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
    AuditAction.ApplicationStatusChanged,
    AuditAction.EligibilityRuleChanged,
    AuditAction.AiCriterionChanged,
    AuditAction.GroupCreated,
    AuditAction.ApplicantAssignedToGroup,
    AuditAction.ApplicantMovedBetweenGroups,
    AuditAction.ApplicantRemovedFromGroup,
    AuditAction.HackathonArchived,
    AuditAction.HackathonRestored,
    AuditAction.JudgeInvited,
    AuditAction.JudgeDisabled,
    AuditAction.JudgeEnabled,
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
