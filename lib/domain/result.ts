import { z } from "zod";

/** Per-judge weighted total for a single project, plus its criterion breakdown. */
export const judgeScoreBreakdownSchema = z.object({
  judgeId: z.string(),
  judgeName: z.string(),
  weightedTotal: z.number(),
  criterionScores: z.array(
    z.object({
      criterionId: z.string(),
      criterionName: z.string(),
      rawScore: z.number(),
      weightedScore: z.number(),
      comment: z.string().optional(),
    })
  ),
});

export type JudgeScoreBreakdown = z.infer<typeof judgeScoreBreakdownSchema>;

/**
 * Computed result for a single project — derived from evaluations, never
 * stored as ground truth. Recomputed on demand from the scoring engine.
 */
export const projectResultSchema = z.object({
  projectId: z.string(),
  projectName: z.string(),
  teamName: z.string(),
  projectNumber: z.number(),
  requiredEvaluations: z.number(),
  completedEvaluations: z.number(),
  isComplete: z.boolean(),
  finalScore: z.number().nullable(),
  rank: z.number().nullable(),
  judgeScores: z.array(judgeScoreBreakdownSchema),
});

export type ProjectResult = z.infer<typeof projectResultSchema>;
