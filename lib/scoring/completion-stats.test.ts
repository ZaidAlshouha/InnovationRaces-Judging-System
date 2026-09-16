import { describe, expect, it } from "vitest";
import {
  calculateJudgeCompletionStats,
  calculateProjectCompletionStats,
  calculateHackathonCompletionSummary,
} from "./completion-stats";
import { AssignmentStatus } from "@/lib/domain/assignment";

const assignments = [
  { judgeId: "ahmad", projectId: "p1", status: AssignmentStatus.Completed },
  { judgeId: "ahmad", projectId: "p2", status: AssignmentStatus.Completed },
  { judgeId: "ahmad", projectId: "p3", status: AssignmentStatus.Pending },
  { judgeId: "mohammed", projectId: "p1", status: AssignmentStatus.Completed },
  { judgeId: "mohammed", projectId: "p2", status: AssignmentStatus.InProgress },
];

describe("calculateJudgeCompletionStats", () => {
  it("computes required/completed/percentage per judge", () => {
    const stats = calculateJudgeCompletionStats(assignments);
    expect(stats.get("ahmad")).toEqual({
      required: 3,
      completed: 2,
      percentage: 67,
    });
    expect(stats.get("mohammed")).toEqual({
      required: 2,
      completed: 1,
      percentage: 50,
    });
  });

  it("returns an empty map for an empty assignment list", () => {
    expect(calculateJudgeCompletionStats([]).size).toBe(0);
  });
});

describe("calculateProjectCompletionStats", () => {
  it("computes required/completed/percentage per project", () => {
    const stats = calculateProjectCompletionStats(assignments);
    expect(stats.get("p1")).toEqual({
      required: 2,
      completed: 2,
      percentage: 100,
    });
    expect(stats.get("p2")).toEqual({
      required: 2,
      completed: 1,
      percentage: 50,
    });
    expect(stats.get("p3")).toEqual({
      required: 1,
      completed: 0,
      percentage: 0,
    });
  });
});

describe("calculateHackathonCompletionSummary", () => {
  it("matches the spec's worked dashboard example proportionally", () => {
    const summary = calculateHackathonCompletionSummary(
      Array.from({ length: 400 }, (_, i) => ({
        status:
          i < 337 ? AssignmentStatus.Completed : AssignmentStatus.Pending,
      }))
    );
    expect(summary).toEqual({
      requiredEvaluations: 400,
      completedEvaluations: 337,
      remainingEvaluations: 63,
      completionPercentage: 84,
    });
  });

  it("returns all zeros for an empty hackathon", () => {
    expect(calculateHackathonCompletionSummary([])).toEqual({
      requiredEvaluations: 0,
      completedEvaluations: 0,
      remainingEvaluations: 0,
      completionPercentage: 0,
    });
  });
});
