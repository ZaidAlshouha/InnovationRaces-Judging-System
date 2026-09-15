import type { ResultsRepository } from "@/lib/data/repositories";
import type { ProjectResult, JudgeScoreBreakdown } from "@/lib/domain/result";
import { EvaluationStatus } from "@/lib/domain/evaluation";
import {
  calculateJudgeWeightedTotal,
  calculateFinalProjectScore,
  calculateProjectCompletion,
  calculateRankings,
} from "@/lib/scoring/engine";
import { getMockStore, mockDelay } from "./store";

function buildProjectResult(
  projectId: string,
  hackathonId: string
): ProjectResult | null {
  const store = getMockStore();
  const project = store.projects.find((p) => p.id === projectId);
  if (!project) return null;

  const criteria = store.criteria.filter((c) => c.hackathonId === hackathonId);
  const assignments = store.assignments.filter((a) => a.hackathonId === hackathonId);
  const evaluations = store.evaluations.filter(
    (e) => e.projectId === projectId && e.status === EvaluationStatus.Submitted
  );
  const judgesById = new Map(store.judges.map((j) => [j.id, j]));
  const criteriaById = new Map(criteria.map((c) => [c.id, c]));

  const completion = calculateProjectCompletion(assignments, projectId);

  const judgeScores: JudgeScoreBreakdown[] = evaluations.map((evaluation) => {
    const { total, breakdown } = calculateJudgeWeightedTotal(
      evaluation.scores,
      criteria
    );
    const judge = judgesById.get(evaluation.judgeId);
    const scoreByEval = new Map(evaluation.scores.map((s) => [s.criterionId, s]));

    return {
      judgeId: evaluation.judgeId,
      judgeName: judge?.name ?? "محكّم غير معروف",
      weightedTotal: total,
      criterionScores: breakdown.map((b) => ({
        criterionId: b.criterionId,
        criterionName: criteriaById.get(b.criterionId)?.name ?? "",
        rawScore: b.rawScore,
        weightedScore: b.weightedScore,
        comment: scoreByEval.get(b.criterionId)?.comment,
      })),
    };
  });

  const finalScore = completion.isComplete
    ? calculateFinalProjectScore(judgeScores.map((j) => j.weightedTotal))
    : null;

  return {
    projectId: project.id,
    projectName: project.projectName,
    teamName: project.teamName,
    projectNumber: project.projectNumber,
    requiredEvaluations: completion.required,
    completedEvaluations: completion.completed,
    isComplete: completion.isComplete,
    finalScore,
    rank: null, // assigned by getProjectResults across the full set
    judgeScores,
  };
}

export class MockResultsRepository implements ResultsRepository {
  async getProjectResults(hackathonId: string): Promise<ProjectResult[]> {
    await mockDelay();
    const store = getMockStore();
    const projects = store.projects.filter((p) => p.hackathonId === hackathonId);

    const results = projects
      .map((p) => buildProjectResult(p.id, hackathonId))
      .filter((r): r is ProjectResult => r !== null);

    const rankings = calculateRankings(
      results
        .filter((r) => r.isComplete && r.finalScore !== null)
        .map((r) => ({
          projectId: r.projectId,
          finalScore: r.finalScore as number,
          isComplete: r.isComplete,
        }))
    );
    const rankByProjectId = new Map(rankings.map((r) => [r.projectId, r.rank]));

    return results
      .map((r) => ({ ...r, rank: rankByProjectId.get(r.projectId) ?? null }))
      .sort((a, b) => {
        if (a.rank !== null && b.rank !== null) return a.rank - b.rank;
        if (a.rank !== null) return -1;
        if (b.rank !== null) return 1;
        return a.projectNumber - b.projectNumber;
      });
  }

  async getProjectResult(projectId: string): Promise<ProjectResult | null> {
    await mockDelay();
    const store = getMockStore();
    const project = store.projects.find((p) => p.id === projectId);
    if (!project) return null;

    const allResults = await this.getProjectResults(project.hackathonId);
    return allResults.find((r) => r.projectId === projectId) ?? null;
  }
}
