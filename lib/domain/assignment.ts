import { z } from "zod";

export const AssignmentStatus = {
  Pending: "pending",
  InProgress: "in_progress",
  Completed: "completed",
} as const;

export type AssignmentStatus =
  (typeof AssignmentStatus)[keyof typeof AssignmentStatus];

export const ASSIGNMENT_STATUS_LABELS_AR: Record<AssignmentStatus, string> = {
  [AssignmentStatus.Pending]: "بانتظار التقييم",
  [AssignmentStatus.InProgress]: "قيد التقييم",
  [AssignmentStatus.Completed]: "مكتمل",
};

export const ASSIGNMENT_STATUS_LABELS_EN: Record<AssignmentStatus, string> = {
  [AssignmentStatus.Pending]: "Pending",
  [AssignmentStatus.InProgress]: "In Progress",
  [AssignmentStatus.Completed]: "Completed",
};

export const assignmentSchema = z.object({
  id: z.string(),
  hackathonId: z.string(),
  judgeId: z.string(),
  projectId: z.string(),
  status: z.enum([
    AssignmentStatus.Pending,
    AssignmentStatus.InProgress,
    AssignmentStatus.Completed,
  ]),
  assignedAt: z.string(),
  updatedAt: z.string(),
});

export type Assignment = z.infer<typeof assignmentSchema>;

export const createAssignmentInputSchema = assignmentSchema.omit({
  id: true,
  status: true,
  assignedAt: true,
  updatedAt: true,
});

export type CreateAssignmentInput = z.infer<
  typeof createAssignmentInputSchema
>;

/**
 * A (judgeId, projectId) pair must be unique per hackathon — this is what
 * guarantees the admin never has to manually match an evaluation to a
 * project/judge after the fact.
 */
export function isDuplicateAssignment(
  existing: Pick<Assignment, "judgeId" | "projectId">[],
  candidate: Pick<Assignment, "judgeId" | "projectId">
): boolean {
  return existing.some(
    (a) => a.judgeId === candidate.judgeId && a.projectId === candidate.projectId
  );
}
