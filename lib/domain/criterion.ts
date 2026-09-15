import { z } from "zod";

export const DEFAULT_MAX_SCORE = 10;

export const criterionSchema = z.object({
  id: z.string(),
  hackathonId: z.string(),
  name: z.string().min(1, "اسم المعيار مطلوب"),
  description: z.string().optional(),
  /** Weight as a whole-number percentage (e.g. 30 for 30%). */
  weight: z
    .number()
    .positive("يجب أن يكون الوزن أكبر من صفر")
    .max(100, "لا يمكن أن يتجاوز الوزن 100%"),
  maxScore: z.number().int().positive().default(DEFAULT_MAX_SCORE),
  order: z.number().int().nonnegative().default(0),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type Criterion = z.infer<typeof criterionSchema>;

export const createCriterionInputSchema = criterionSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type CreateCriterionInput = z.infer<typeof createCriterionInputSchema>;

export const updateCriterionInputSchema = criterionSchema
  .omit({ createdAt: true, updatedAt: true })
  .partial()
  .required({ id: true });

export type UpdateCriterionInput = z.infer<typeof updateCriterionInputSchema>;

/** Floating point weight sums (e.g. 33.33 x 3) must tolerate rounding error. */
const WEIGHT_SUM_TOLERANCE = 0.01;

export interface WeightValidationResult {
  isValid: boolean;
  totalWeight: number;
  message?: string;
}

/**
 * A hackathon's criteria weights must sum to exactly 100% — the scoring
 * engine assumes this invariant and does not re-normalize at calculation
 * time. Enforce it wherever criteria are created/edited, not just here.
 */
export function validateCriteriaWeights(
  criteria: Pick<Criterion, "weight">[]
): WeightValidationResult {
  const totalWeight = criteria.reduce((sum, c) => sum + c.weight, 0);
  const isValid = Math.abs(totalWeight - 100) <= WEIGHT_SUM_TOLERANCE;

  return {
    isValid,
    totalWeight,
    message: isValid
      ? undefined
      : `مجموع أوزان المعايير يجب أن يساوي 100%، المجموع الحالي هو ${totalWeight}%`,
  };
}
