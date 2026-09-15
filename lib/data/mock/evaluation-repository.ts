import type { EvaluationRepository } from "@/lib/data/repositories";
import type { Evaluation, SubmitEvaluationInput } from "@/lib/domain/evaluation";
import { EvaluationStatus } from "@/lib/domain/evaluation";
import { AssignmentStatus } from "@/lib/domain/assignment";
import { getMockStore, generateId, mockDelay } from "./store";

export class MockEvaluationRepository implements EvaluationRepository {
  async listByHackathon(hackathonId: string): Promise<Evaluation[]> {
    await mockDelay();
    return getMockStore().evaluations.filter(
      (e) => e.hackathonId === hackathonId
    );
  }

  async listByJudge(judgeId: string): Promise<Evaluation[]> {
    await mockDelay();
    return getMockStore().evaluations.filter((e) => e.judgeId === judgeId);
  }

  async listByProject(projectId: string): Promise<Evaluation[]> {
    await mockDelay();
    return getMockStore().evaluations.filter((e) => e.projectId === projectId);
  }

  async getByAssignmentId(assignmentId: string): Promise<Evaluation | null> {
    await mockDelay();
    return (
      getMockStore().evaluations.find((e) => e.assignmentId === assignmentId) ??
      null
    );
  }

  async submit(
    judgeId: string,
    input: SubmitEvaluationInput
  ): Promise<Evaluation> {
    await mockDelay();
    const store = getMockStore();

    const assignment = store.assignments.find((a) => a.id === input.assignmentId);
    if (!assignment) {
      throw new Error("التوزيع غير موجود");
    }
    if (assignment.judgeId !== judgeId) {
      throw new Error("لا يمكنك إرسال تقييم لتوزيع لا يخصك");
    }

    const existing = store.evaluations.find(
      (e) => e.assignmentId === input.assignmentId
    );
    if (existing && existing.status === EvaluationStatus.Submitted) {
      throw new Error(
        "تم إرسال هذا التقييم مسبقًا، يرجى مراجعة المسؤول لإعادة فتحه"
      );
    }

    const now = new Date().toISOString();
    const evaluation: Evaluation = {
      id: existing?.id ?? generateId("eval"),
      hackathonId: assignment.hackathonId,
      assignmentId: assignment.id,
      judgeId: assignment.judgeId,
      projectId: assignment.projectId,
      status: EvaluationStatus.Submitted,
      scores: input.scores.map((s, index) => ({
        id: existing?.scores[index]?.id ?? generateId("score"),
        evaluationId: existing?.id ?? generateId("eval"),
        criterionId: s.criterionId,
        score: s.score,
        comment: s.comment,
      })),
      submittedAt: now,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };

    if (existing) {
      const index = store.evaluations.findIndex((e) => e.id === existing.id);
      store.evaluations[index] = evaluation;
    } else {
      store.evaluations.push(evaluation);
    }

    const assignmentIndex = store.assignments.findIndex(
      (a) => a.id === assignment.id
    );
    store.assignments[assignmentIndex] = {
      ...assignment,
      status: AssignmentStatus.Completed,
      updatedAt: now,
    };

    return evaluation;
  }

  async reopen(evaluationId: string, actorUserId: string): Promise<Evaluation> {
    await mockDelay();
    const store = getMockStore();
    const index = store.evaluations.findIndex((e) => e.id === evaluationId);
    if (index === -1) {
      throw new Error("التقييم غير موجود");
    }

    const now = new Date().toISOString();
    const updated: Evaluation = {
      ...store.evaluations[index],
      status: EvaluationStatus.Draft,
      reopenedAt: now,
      updatedAt: now,
    };
    store.evaluations[index] = updated;

    const assignmentIndex = store.assignments.findIndex(
      (a) => a.id === updated.assignmentId
    );
    if (assignmentIndex !== -1) {
      store.assignments[assignmentIndex] = {
        ...store.assignments[assignmentIndex],
        status: AssignmentStatus.InProgress,
        updatedAt: now,
      };
    }

    void actorUserId; // recorded via the audit log repository by the calling service, not here

    return updated;
  }
}
