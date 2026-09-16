import type { ResultsRepository } from "@/lib/data/repositories";
import type { ProjectResult, JudgeScoreBreakdown } from "@/lib/domain/result";
import { EvaluationStatus } from "@/lib/domain/evaluation";
import {
  calculateJudgeWeightedTotal,
  calculateFinalProjectScore,
  calculateProjectCompletion,
  calculateRankings,
} from "@/lib/scoring/engine";
import {
  supabase,
  assignmentToDomain,
  criterionToDomain,
  evaluationToDomain,
  judgeToDomain,
  projectToDomain,
} from "./shared";

/**
 * Loads every row needed to compute results for a hackathon, then feeds
 * them through the unmodified lib/scoring/engine.ts — identical math to
 * lib/data/mock/results-repository.ts, just sourced from Postgres instead
 * of the in-memory store. Results are never stored; they are always
 * recomputed on demand (see docs/supabase-schema.md).
 */
async function loadHackathonData(hackathonId: string) {
  const client = supabase();

  const [
    { data: projectRows, error: projectsError },
    { data: criterionRows, error: criteriaError },
    { data: assignmentRows, error: assignmentsError },
    { data: judgeRows, error: judgesError },
    { data: evaluationRows, error: evaluationsError },
  ] = await Promise.all([
    client.from("projects").select("*").eq("hackathon_id", hackathonId),
    client.from("criteria").select("*").eq("hackathon_id", hackathonId),
    client.from("assignments").select("*").eq("hackathon_id", hackathonId),
    client.from("judges").select("*").eq("hackathon_id", hackathonId),
    client
      .from("evaluations")
      .select("*")
      .eq("hackathon_id", hackathonId)
      .eq("status", EvaluationStatus.Submitted),
  ]);

  const firstError =
    projectsError ??
    criteriaError ??
    assignmentsError ??
    judgesError ??
    evaluationsError;
  if (firstError) throw new Error(firstError.message);

  const evaluationIds = (evaluationRows ?? []).map((e) => e.id);
  const { data: scoreRows, error: scoresError } =
    evaluationIds.length > 0
      ? await client
          .from("evaluation_scores")
          .select("*")
          .in("evaluation_id", evaluationIds)
      : { data: [], error: null };
  if (scoresError) throw new Error(scoresError.message);

  const scoresByEvaluationId = new Map<string, typeof scoreRows>();
  for (const row of scoreRows ?? []) {
    const list = scoresByEvaluationId.get(row.evaluation_id) ?? [];
    list.push(row);
    scoresByEvaluationId.set(row.evaluation_id, list);
  }

  return {
    projects: (projectRows ?? []).map(projectToDomain),
    criteria: (criterionRows ?? []).map(criterionToDomain),
    assignments: (assignmentRows ?? []).map(assignmentToDomain),
    judges: (judgeRows ?? []).map(judgeToDomain),
    evaluations: (evaluationRows ?? []).map((row) =>
      evaluationToDomain(row, scoresByEvaluationId.get(row.id) ?? [])
    ),
  };
}

function buildProjectResult(
  data: Awaited<ReturnType<typeof loadHackathonData>>,
  projectId: string
): ProjectResult | null {
  const project = data.projects.find((p) => p.id === projectId);
  if (!project) return null;

  const criteriaById = new Map(data.criteria.map((c) => [c.id, c]));
  const judgesById = new Map(data.judges.map((j) => [j.id, j]));
  const evaluations = data.evaluations.filter((e) => e.projectId === projectId);

  const completion = calculateProjectCompletion(data.assignments, projectId);

  const judgeScores: JudgeScoreBreakdown[] = evaluations.map((evaluation) => {
    const { total, breakdown } = calculateJudgeWeightedTotal(
      evaluation.scores,
      data.criteria
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
    rank: null,
    judgeScores,
  };
}

export class SupabaseResultsRepository implements ResultsRepository {
  async getProjectResults(hackathonId: string): Promise<ProjectResult[]> {
    const data = await loadHackathonData(hackathonId);

    const results = data.projects
      .map((p) => buildProjectResult(data, p.id))
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
    const { data: project, error } = await supabase()
      .from("projects")
      .select("hackathon_id")
      .eq("id", projectId)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!project) return null;

    const allResults = await this.getProjectResults(project.hackathon_id);
    return allResults.find((r) => r.projectId === projectId) ?? null;
  }
}
