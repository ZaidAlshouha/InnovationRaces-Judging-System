import { z } from "zod";
import { DEFAULT_MAX_SCORE } from "./criterion";

export const EvaluationStatus = {
  Draft: "draft",
  Submitted: "submitted",
} as const;

export type EvaluationStatus =
  (typeof EvaluationStatus)[keyof typeof EvaluationStatus];

export const evaluationScoreSchema = z.object({
  id: z.string(),
  evaluationId: z.string(),
  criterionId: z.string(),
  /** Raw score on the 0..criterion.maxScore scale (0..10 by default). */
  score: z
    .number()
    .min(0, "الدرجة يجب أن تكون بين 0 و 10")
    .max(DEFAULT_MAX_SCORE, "الدرجة يجب أن تكون بين 0 و 10"),
  comment: z.string().optional(),
});

export type EvaluationScore = z.infer<typeof evaluationScoreSchema>;

export const evaluationSchema = z.object({
  id: z.string(),
  hackathonId: z.string(),
  assignmentId: z.string(),
  judgeId: z.string(),
  projectId: z.string(),
  status: z.enum([EvaluationStatus.Draft, EvaluationStatus.Submitted]),
  scores: z.array(evaluationScoreSchema),
  submittedAt: z.string().optional(),
  reopenedAt: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type Evaluation = z.infer<typeof evaluationSchema>;

export const submitEvaluationInputSchema = z.object({
  assignmentId: z.string(),
  scores: z
    .array(
      z.object({
        criterionId: z.string(),
        score: z
          .number({ message: "الرجاء اختيار درجة لكل معيار" })
          .min(0, "الدرجة يجب أن تكون بين 0 و 10")
          .max(DEFAULT_MAX_SCORE, "الدرجة يجب أن تكون بين 0 و 10"),
        comment: z.string().optional(),
      })
    )
    .min(1, "يجب تقييم معيار واحد على الأقل"),
});

export type SubmitEvaluationInput = z.infer<
  typeof submitEvaluationInputSchema
>;

/**
 * Every required criterion must have a score before submission is allowed.
 * Comments are always optional.
 */
export function validateAllCriteriaScored(
  requiredCriterionIds: string[],
  scores: Pick<EvaluationScore, "criterionId" | "score">[]
): { isValid: boolean; missingCriterionIds: string[] } {
  const scoredIds = new Set(scores.map((s) => s.criterionId));
  const missingCriterionIds = requiredCriterionIds.filter(
    (id) => !scoredIds.has(id)
  );
  return { isValid: missingCriterionIds.length === 0, missingCriterionIds };
}
