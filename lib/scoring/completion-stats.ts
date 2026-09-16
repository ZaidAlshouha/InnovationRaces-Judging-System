import type { Assignment } from "@/lib/domain/assignment";
import { AssignmentStatus } from "@/lib/domain/assignment";

export interface EntityCompletionStats {
  required: number;
  completed: number;
  percentage: number;
}

function toStats(required: number, completed: number): EntityCompletionStats {
  return {
    required,
    completed,
    percentage: required === 0 ? 0 : Math.round((completed / required) * 100),
  };
}

/** Aggregate completion stats per judge from a hackathon's full assignment list. */
export function calculateJudgeCompletionStats(
  assignments: Pick<Assignment, "judgeId" | "status">[]
): Map<string, EntityCompletionStats> {
  const byJudge = new Map<string, { required: number; completed: number }>();

  for (const a of assignments) {
    const entry = byJudge.get(a.judgeId) ?? { required: 0, completed: 0 };
    entry.required += 1;
    if (a.status === AssignmentStatus.Completed) entry.completed += 1;
    byJudge.set(a.judgeId, entry);
  }

  return new Map(
    [...byJudge.entries()].map(([judgeId, { required, completed }]) => [
      judgeId,
      toStats(required, completed),
    ])
  );
}

/** Aggregate completion stats per project from a hackathon's full assignment list. */
export function calculateProjectCompletionStats(
  assignments: Pick<Assignment, "projectId" | "status">[]
): Map<string, EntityCompletionStats> {
  const byProject = new Map<string, { required: number; completed: number }>();

  for (const a of assignments) {
    const entry = byProject.get(a.projectId) ?? { required: 0, completed: 0 };
    entry.required += 1;
    if (a.status === AssignmentStatus.Completed) entry.completed += 1;
    byProject.set(a.projectId, entry);
  }

  return new Map(
    [...byProject.entries()].map(([projectId, { required, completed }]) => [
      projectId,
      toStats(required, completed),
    ])
  );
}

/** Hackathon-wide totals for the admin dashboard summary cards. */
export interface HackathonCompletionSummary {
  requiredEvaluations: number;
  completedEvaluations: number;
  remainingEvaluations: number;
  completionPercentage: number;
}

export function calculateHackathonCompletionSummary(
  assignments: Pick<Assignment, "status">[]
): HackathonCompletionSummary {
  const requiredEvaluations = assignments.length;
  const completedEvaluations = assignments.filter(
    (a) => a.status === AssignmentStatus.Completed
  ).length;

  return {
    requiredEvaluations,
    completedEvaluations,
    remainingEvaluations: requiredEvaluations - completedEvaluations,
    completionPercentage:
      requiredEvaluations === 0
        ? 0
        : Math.round((completedEvaluations / requiredEvaluations) * 100),
  };
}
