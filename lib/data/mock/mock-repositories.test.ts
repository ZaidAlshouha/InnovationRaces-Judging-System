import { beforeEach, describe, expect, it } from "vitest";
import { resetMockStore } from "./store";
import { MockAssignmentRepository } from "./assignment-repository";
import { MockEvaluationRepository } from "./evaluation-repository";
import { MockResultsRepository } from "./results-repository";
import { MockAuthRepository } from "./auth-repository";
import { MockJudgeRepository } from "./judge-repository";
import { AssignmentStatus } from "@/lib/domain/assignment";
import { JudgeStatus } from "@/lib/domain/judge";
import { HACKATHON_ID } from "@/mock-data/hackathons";

beforeEach(() => {
  resetMockStore();
});

describe("MockAssignmentRepository", () => {
  it("rejects a duplicate (judge, project) assignment", async () => {
    const repo = new MockAssignmentRepository();
    await expect(
      repo.create({
        hackathonId: HACKATHON_ID,
        judgeId: "judge-ahmad",
        projectId: "project-001",
      })
    ).rejects.toThrow();
  });

  it("allows a new (judge, project) pair not already assigned", async () => {
    const repo = new MockAssignmentRepository();
    const created = await repo.create({
      hackathonId: HACKATHON_ID,
      judgeId: "judge-faisal",
      projectId: "project-001",
    });
    expect(created.status).toBe(AssignmentStatus.Pending);
  });
});

describe("MockEvaluationRepository", () => {
  it("submitting an evaluation marks the assignment completed", async () => {
    const assignmentRepo = new MockAssignmentRepository();
    const evaluationRepo = new MockEvaluationRepository();

    const assignment = await assignmentRepo.create({
      hackathonId: HACKATHON_ID,
      judgeId: "judge-faisal",
      projectId: "project-002",
    });

    await evaluationRepo.submit("judge-faisal", {
      assignmentId: assignment.id,
      scores: [
        { criterionId: "criterion-innovation", score: 8 },
        { criterionId: "criterion-impact", score: 9 },
        { criterionId: "criterion-feasibility", score: 7 },
        { criterionId: "criterion-presentation", score: 8 },
      ],
    });

    const updated = await assignmentRepo.getById(assignment.id);
    expect(updated?.status).toBe(AssignmentStatus.Completed);
  });

  it("rejects a second submission on an already-submitted evaluation", async () => {
    const evaluationRepo = new MockEvaluationRepository();

    // assign-001 (judge-ahmad, project-001) is already submitted in fixtures.
    await expect(
      evaluationRepo.submit("judge-ahmad", {
        assignmentId: "assign-001",
        scores: [
          { criterionId: "criterion-innovation", score: 5 },
          { criterionId: "criterion-impact", score: 5 },
          { criterionId: "criterion-feasibility", score: 5 },
          { criterionId: "criterion-presentation", score: 5 },
        ],
      })
    ).rejects.toThrow();
  });

  it("rejects submission by a judge who does not own the assignment", async () => {
    const evaluationRepo = new MockEvaluationRepository();
    await expect(
      evaluationRepo.submit("judge-mohammed", {
        assignmentId: "assign-001", // belongs to judge-ahmad
        scores: [
          { criterionId: "criterion-innovation", score: 5 },
          { criterionId: "criterion-impact", score: 5 },
          { criterionId: "criterion-feasibility", score: 5 },
          { criterionId: "criterion-presentation", score: 5 },
        ],
      })
    ).rejects.toThrow();
  });

  it("reopen unlocks a submitted evaluation and reverts assignment to in_progress", async () => {
    const evaluationRepo = new MockEvaluationRepository();
    const assignmentRepo = new MockAssignmentRepository();

    const evaluation = await evaluationRepo.getByAssignmentId("assign-001");
    expect(evaluation).not.toBeNull();

    const reopened = await evaluationRepo.reopen(evaluation!.id, "user-admin-demo");
    expect(reopened.status).toBe("draft");

    const assignment = await assignmentRepo.getById("assign-001");
    expect(assignment?.status).toBe(AssignmentStatus.InProgress);

    // Now resubmission should succeed since it is no longer locked.
    const resubmitted = await evaluationRepo.submit("judge-ahmad", {
      assignmentId: "assign-001",
      scores: [
        { criterionId: "criterion-innovation", score: 10 },
        { criterionId: "criterion-impact", score: 10 },
        { criterionId: "criterion-feasibility", score: 10 },
        { criterionId: "criterion-presentation", score: 10 },
      ],
    });
    expect(resubmitted.status).toBe("submitted");
  });
});

describe("MockResultsRepository", () => {
  it("computes complete projects with a final score and rank", async () => {
    const repo = new MockResultsRepository();
    const results = await repo.getProjectResults(HACKATHON_ID);

    const complete = results.filter((r) => r.isComplete);
    expect(complete.length).toBeGreaterThan(0);
    complete.forEach((r) => {
      expect(r.finalScore).not.toBeNull();
      expect(r.rank).not.toBeNull();
    });
  });

  it("never assigns a rank or final score to an incomplete project", async () => {
    const repo = new MockResultsRepository();
    const results = await repo.getProjectResults(HACKATHON_ID);

    const incomplete = results.filter((r) => !r.isComplete);
    expect(incomplete.length).toBeGreaterThan(0);
    incomplete.forEach((r) => {
      expect(r.finalScore).toBeNull();
      expect(r.rank).toBeNull();
    });
  });

  it("orders complete projects by descending final score", async () => {
    const repo = new MockResultsRepository();
    const results = await repo.getProjectResults(HACKATHON_ID);
    const completeScores = results
      .filter((r) => r.isComplete && r.finalScore !== null)
      .map((r) => r.finalScore as number);

    for (let i = 1; i < completeScores.length; i++) {
      expect(completeScores[i]).toBeLessThanOrEqual(completeScores[i - 1]);
    }
  });
});

describe("MockJudgeRepository — invitation/account-management fields", () => {
  it("create() persists phone and notes alongside the existing fields", async () => {
    const repo = new MockJudgeRepository();
    const created = await repo.create({
      hackathonId: HACKATHON_ID,
      name: "طارق العمري",
      email: "tariq.alomari@example.com",
      phone: "0501112222",
      notes: "خبير في أمن المعلومات",
      status: JudgeStatus.Active,
    });
    expect(created.phone).toBe("0501112222");
    expect(created.notes).toBe("خبير في أمن المعلومات");
    expect(created.status).toBe("active");
  });

  it("update() can change status independently (activate/deactivate)", async () => {
    const repo = new MockJudgeRepository();
    const created = await repo.create({
      hackathonId: HACKATHON_ID,
      name: "لمى الغامدي",
      email: "lama.alghamdi@example.com",
      status: JudgeStatus.Active,
    });
    expect(created.status).toBe("active");

    const disabled = await repo.update({ id: created.id, status: JudgeStatus.Inactive });
    expect(disabled.status).toBe("inactive");
    // Disabling never touches name/email — matches the "never delete
    // evaluation history when disabling a judge" requirement structurally:
    // nothing about this call removes or reassigns the judges row itself.
    expect(disabled.name).toBe("لمى الغامدي");
    expect(disabled.email).toBe("lama.alghamdi@example.com");

    const reEnabled = await repo.update({ id: created.id, status: JudgeStatus.Active });
    expect(reEnabled.status).toBe("active");
  });

  it("getByEmail() finds a judge case-insensitively", async () => {
    const repo = new MockJudgeRepository();
    await repo.create({
      hackathonId: HACKATHON_ID,
      name: "بدر السبيعي",
      email: "Badr.Alsubaie@example.com",
      status: JudgeStatus.Active,
    });
    const found = await repo.getByEmail("badr.alsubaie@example.com");
    expect(found?.name).toBe("بدر السبيعي");
  });
});

describe("MockAuthRepository (prototype auth)", () => {
  it("signs in the demo admin account", async () => {
    const repo = new MockAuthRepository();
    const user = await repo.signIn("admin@innovationraces.demo", "any-password");
    expect(user?.role).toBe("admin");
  });

  it("signs in a seeded judge by real email", async () => {
    const repo = new MockAuthRepository();
    const user = await repo.signIn(
      "ahmad.almutairi@innovationraces.demo",
      "any-password"
    );
    expect(user?.role).toBe("judge");
    expect(user?.judgeId).toBe("judge-ahmad");
  });

  it("returns null for an unknown email", async () => {
    const repo = new MockAuthRepository();
    const user = await repo.signIn("unknown@example.com", "x");
    expect(user).toBeNull();
  });

  it("a disabled (inactive) judge cannot sign in — account disabling is enforced, not just cosmetic", async () => {
    // judge-faisal (faisal.alharbi@innovationraces.demo) is seeded as
    // JudgeStatus.Inactive in mock-data/judges.ts — mirrors
    // buildDomainUser()'s own `.eq("status", "active")` filter
    // (lib/data/supabase/shared.ts) for the real backend.
    const repo = new MockAuthRepository();
    const user = await repo.signIn("faisal.alharbi@innovationraces.demo", "any-password");
    expect(user).toBeNull();
  });

  it("re-activating a disabled judge restores sign-in", async () => {
    const judgeRepo = new MockJudgeRepository();
    const authRepo = new MockAuthRepository();

    const created = await judgeRepo.create({
      hackathonId: HACKATHON_ID,
      name: "منى الزهراني",
      email: "mona.alzahrani@example.com",
      status: JudgeStatus.Inactive,
    });
    expect(await authRepo.signIn(created.email, "any-password")).toBeNull();

    await judgeRepo.update({ id: created.id, status: JudgeStatus.Active });
    const reActivatedUser = await authRepo.signIn(created.email, "any-password");
    expect(reActivatedUser?.role).toBe("judge");
    expect(reActivatedUser?.judgeId).toBe(created.id);
  });
});
