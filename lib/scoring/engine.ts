import type { Criterion } from "@/lib/domain/criterion";
import type { Evaluation, EvaluationScore } from "@/lib/domain/evaluation";
import type { Assignment } from "@/lib/domain/assignment";
import { AssignmentStatus } from "@/lib/domain/assignment";
import { EvaluationStatus } from "@/lib/domain/evaluation";

/**
 * The single deterministic scoring formula for the whole application.
 * No AI, no heuristics — every number here must be traceable by hand.
 *
 *   Weighted Criterion Score = (score / criterion.maxScore) * criterion.weight
 *   Judge Weighted Score     = sum of all weighted criterion scores
 *   Final Project Score      = average of all completed judges' weighted scores
 */

export interface WeightedCriterionScore {
  criterionId: string;
  rawScore: number;
  weightedScore: number;
}

/** (score / maxScore) * weight — rounded to 2 decimals to avoid float noise in the UI. */
export function calculateWeightedCriterionScore(
  rawScore: number,
  criterion: Pick<Criterion, "weight" | "maxScore">
): number {
  const weighted = (rawScore / criterion.maxScore) * criterion.weight;
  return Math.round(weighted * 100) / 100;
}

/** Sum of every weighted criterion score for one judge's evaluation of one project. */
export function calculateJudgeWeightedTotal(
  scores: Pick<EvaluationScore, "criterionId" | "score">[],
  criteria: Pick<Criterion, "id" | "weight" | "maxScore">[]
): { total: number; breakdown: WeightedCriterionScore[] } {
  const criteriaById = new Map(criteria.map((c) => [c.id, c]));

  const breakdown: WeightedCriterionScore[] = scores.map((s) => {
    const criterion = criteriaById.get(s.criterionId);
    if (!criterion) {
      throw new Error(`معيار غير معروف: ${s.criterionId}`);
    }
    return {
      criterionId: s.criterionId,
      rawScore: s.score,
      weightedScore: calculateWeightedCriterionScore(s.score, criterion),
    };
  });

  const total = Math.round(
    breakdown.reduce((sum, b) => sum + b.weightedScore, 0) * 100
  ) / 100;

  return { total, breakdown };
}

/** Average of all completed (submitted) judge weighted totals for a project. */
export function calculateFinalProjectScore(
  judgeWeightedTotals: number[]
): number | null {
  if (judgeWeightedTotals.length === 0) return null;
  const sum = judgeWeightedTotals.reduce((a, b) => a + b, 0);
  return Math.round((sum / judgeWeightedTotals.length) * 100) / 100;
}

export interface CompletionStatus {
  required: number;
  completed: number;
  isComplete: boolean;
}

/**
 * A project is fully evaluated only when every required judge assignment
 * has a corresponding submitted evaluation — partial results must never be
 * presented as official rankings.
 */
export function calculateProjectCompletion(
  assignments: Pick<Assignment, "projectId" | "status">[],
  projectId: string
): CompletionStatus {
  const projectAssignments = assignments.filter(
    (a) => a.projectId === projectId
  );
  const required = projectAssignments.length;
  const completed = projectAssignments.filter(
    (a) => a.status === AssignmentStatus.Completed
  ).length;

  return { required, completed, isComplete: required > 0 && completed === required };
}

/** Ranks are computed only from projects whose evaluation is complete. */
export interface RankableProject {
  projectId: string;
  finalScore: number;
  isComplete: boolean;
}

export interface RankedProject {
  projectId: string;
  finalScore: number;
  rank: number;
}

/**
 * Sorts complete projects by final score descending and assigns dense ranks.
 * Ties share the same rank (standard competition ranking: 1, 2, 2, 4).
 * Incomplete projects are excluded — callers show them as "غير مكتمل" with no rank.
 */
export function calculateRankings(
  projects: RankableProject[]
): RankedProject[] {
  const complete = projects
    .filter((p) => p.isComplete)
    .sort((a, b) => b.finalScore - a.finalScore);

  const ranked: RankedProject[] = [];
  let previousScore: number | null = null;
  let previousRank = 0;

  complete.forEach((project, index) => {
    const rank =
      previousScore !== null && project.finalScore === previousScore
        ? previousRank
        : index + 1;
    ranked.push({ projectId: project.projectId, finalScore: project.finalScore, rank });
    previousScore = project.finalScore;
    previousRank = rank;
  });

  return ranked;
}

/** Convenience guard used by the judge portal to block edits to locked evaluations. */
export function isEvaluationLocked(evaluation: Pick<Evaluation, "status">): boolean {
  return evaluation.status === EvaluationStatus.Submitted;
}
