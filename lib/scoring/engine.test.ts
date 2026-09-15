import { describe, expect, it } from "vitest";
import {
  calculateWeightedCriterionScore,
  calculateJudgeWeightedTotal,
  calculateFinalProjectScore,
  calculateProjectCompletion,
  calculateRankings,
} from "./engine";
import { AssignmentStatus } from "@/lib/domain/assignment";

const criteria = [
  { id: "innovation", weight: 30, maxScore: 10 },
  { id: "impact", weight: 30, maxScore: 10 },
  { id: "feasibility", weight: 25, maxScore: 10 },
  { id: "presentation", weight: 15, maxScore: 10 },
];

describe("calculateWeightedCriterionScore", () => {
  it("matches the spec worked example for each criterion", () => {
    expect(calculateWeightedCriterionScore(8, criteria[0])).toBe(24);
    expect(calculateWeightedCriterionScore(9, criteria[1])).toBe(27);
    expect(calculateWeightedCriterionScore(7, criteria[2])).toBe(17.5);
    expect(calculateWeightedCriterionScore(8, criteria[3])).toBe(12);
  });

  it("returns 0 for a score of 0 regardless of weight", () => {
    expect(calculateWeightedCriterionScore(0, criteria[0])).toBe(0);
  });

  it("returns the full weight for a perfect score", () => {
    expect(calculateWeightedCriterionScore(10, criteria[0])).toBe(30);
  });
});

describe("calculateJudgeWeightedTotal", () => {
  it("matches the spec worked example total of 80.5", () => {
    const scores = [
      { criterionId: "innovation", score: 8 },
      { criterionId: "impact", score: 9 },
      { criterionId: "feasibility", score: 7 },
      { criterionId: "presentation", score: 8 },
    ];
    const { total, breakdown } = calculateJudgeWeightedTotal(scores, criteria);
    expect(total).toBe(80.5);
    expect(breakdown).toHaveLength(4);
  });

  it("throws when a score references an unknown criterion", () => {
    expect(() =>
      calculateJudgeWeightedTotal(
        [{ criterionId: "unknown", score: 5 }],
        criteria
      )
    ).toThrow();
  });
});

describe("calculateFinalProjectScore", () => {
  it("averages multiple judges' weighted totals", () => {
    expect(calculateFinalProjectScore([92.1, 90.4, 91.8, 91.4])).toBe(91.43);
  });

  it("returns null when there are no completed evaluations", () => {
    expect(calculateFinalProjectScore([])).toBeNull();
  });

  it("returns the single value when only one judge completed", () => {
    expect(calculateFinalProjectScore([80.5])).toBe(80.5);
  });
});

describe("calculateProjectCompletion", () => {
  const assignments = [
    { projectId: "p1", status: AssignmentStatus.Completed },
    { projectId: "p1", status: AssignmentStatus.Completed },
    { projectId: "p1", status: AssignmentStatus.Pending },
    { projectId: "p2", status: AssignmentStatus.Completed },
  ];

  it("flags a project as incomplete when fewer submissions than required", () => {
    const status = calculateProjectCompletion(assignments, "p1");
    expect(status).toEqual({ required: 3, completed: 2, isComplete: false });
  });

  it("flags a project as complete when all assignments are done", () => {
    const status = calculateProjectCompletion(assignments, "p2");
    expect(status).toEqual({ required: 1, completed: 1, isComplete: true });
  });

  it("treats a project with zero assignments as incomplete, not complete", () => {
    const status = calculateProjectCompletion(assignments, "p3");
    expect(status).toEqual({ required: 0, completed: 0, isComplete: false });
  });
});

describe("calculateRankings", () => {
  it("ranks only complete projects, descending by score", () => {
    const ranked = calculateRankings([
      { projectId: "phoenix", finalScore: 91.42, isComplete: true },
      { projectId: "alpha", finalScore: 88.76, isComplete: true },
      { projectId: "vision", finalScore: 86.31, isComplete: true },
      { projectId: "incomplete-project", finalScore: 99, isComplete: false },
    ]);

    expect(ranked).toEqual([
      { projectId: "phoenix", finalScore: 91.42, rank: 1 },
      { projectId: "alpha", finalScore: 88.76, rank: 2 },
      { projectId: "vision", finalScore: 86.31, rank: 3 },
    ]);
  });

  it("assigns equal ranks to tied scores and skips the next rank", () => {
    const ranked = calculateRankings([
      { projectId: "a", finalScore: 90, isComplete: true },
      { projectId: "b", finalScore: 90, isComplete: true },
      { projectId: "c", finalScore: 80, isComplete: true },
    ]);

    expect(ranked.map((r) => r.rank)).toEqual([1, 1, 3]);
  });
});
