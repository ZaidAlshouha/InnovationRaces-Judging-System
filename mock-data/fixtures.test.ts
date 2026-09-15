import { describe, expect, it } from "vitest";
import { hackathonSchema } from "@/lib/domain/hackathon";
import { projectSchema } from "@/lib/domain/project";
import { judgeSchema } from "@/lib/domain/judge";
import { criterionSchema, validateCriteriaWeights } from "@/lib/domain/criterion";
import { assignmentSchema, isDuplicateAssignment } from "@/lib/domain/assignment";
import { evaluationSchema } from "@/lib/domain/evaluation";
import {
  mockHackathons,
  mockProjects,
  mockJudges,
  mockCriteria,
  mockAssignments,
  mockEvaluations,
} from "./index";

describe("mock fixtures conform to domain schemas", () => {
  it("hackathons are valid", () => {
    mockHackathons.forEach((h) => expect(() => hackathonSchema.parse(h)).not.toThrow());
  });

  it("projects are valid and project numbers are unique", () => {
    mockProjects.forEach((p) => expect(() => projectSchema.parse(p)).not.toThrow());
    const numbers = mockProjects.map((p) => p.projectNumber);
    expect(new Set(numbers).size).toBe(numbers.length);
  });

  it("judges are valid with unique emails", () => {
    mockJudges.forEach((j) => expect(() => judgeSchema.parse(j)).not.toThrow());
    const emails = mockJudges.map((j) => j.email);
    expect(new Set(emails).size).toBe(emails.length);
  });

  it("criteria are valid and weights sum to 100%", () => {
    mockCriteria.forEach((c) => expect(() => criterionSchema.parse(c)).not.toThrow());
    expect(validateCriteriaWeights(mockCriteria).isValid).toBe(true);
  });

  it("assignments are valid with no duplicate (judge, project) pairs", () => {
    mockAssignments.forEach((a) => expect(() => assignmentSchema.parse(a)).not.toThrow());

    const seen: { judgeId: string; projectId: string }[] = [];
    for (const a of mockAssignments) {
      expect(isDuplicateAssignment(seen, a)).toBe(false);
      seen.push(a);
    }
  });

  it("evaluations are valid and reference real assignments/criteria", () => {
    mockEvaluations.forEach((e) => expect(() => evaluationSchema.parse(e)).not.toThrow());

    const assignmentIds = new Set(mockAssignments.map((a) => a.id));
    const criterionIds = new Set(mockCriteria.map((c) => c.id));

    mockEvaluations.forEach((e) => {
      expect(assignmentIds.has(e.assignmentId)).toBe(true);
      e.scores.forEach((s) => {
        expect(criterionIds.has(s.criterionId)).toBe(true);
      });
      expect(e.scores).toHaveLength(mockCriteria.length);
    });
  });

  it("every submitted evaluation's assignment is marked completed", () => {
    const completedAssignmentIds = new Set(
      mockAssignments
        .filter((a) => a.status === "completed")
        .map((a) => a.id)
    );
    mockEvaluations.forEach((e) => {
      expect(completedAssignmentIds.has(e.assignmentId)).toBe(true);
    });
  });

  it("produces a realistic, non-trivial completion rate", () => {
    const completionRate = mockEvaluations.length / mockAssignments.length;
    expect(completionRate).toBeGreaterThan(0.5);
    expect(completionRate).toBeLessThan(1);
  });
});
