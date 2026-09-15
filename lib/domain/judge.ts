import { z } from "zod";

export const JudgeStatus = {
  Active: "active",
  Inactive: "inactive",
} as const;

export type JudgeStatus = (typeof JudgeStatus)[keyof typeof JudgeStatus];

export const JUDGE_STATUS_LABELS_AR: Record<JudgeStatus, string> = {
  [JudgeStatus.Active]: "نشط",
  [JudgeStatus.Inactive]: "غير نشط",
};

export const judgeSchema = z.object({
  id: z.string(),
  hackathonId: z.string(),
  name: z.string().min(1, "اسم المحكّم مطلوب"),
  email: z.string().email("بريد إلكتروني غير صالح"),
  status: z.enum([JudgeStatus.Active, JudgeStatus.Inactive]),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type Judge = z.infer<typeof judgeSchema>;

export const createJudgeInputSchema = judgeSchema
  .omit({ id: true, createdAt: true, updatedAt: true, status: true })
  .extend({
    status: judgeSchema.shape.status.default(JudgeStatus.Active),
  });

export type CreateJudgeInput = z.infer<typeof createJudgeInputSchema>;

export const updateJudgeInputSchema = judgeSchema
  .omit({ createdAt: true, updatedAt: true })
  .partial()
  .required({ id: true });

export type UpdateJudgeInput = z.infer<typeof updateJudgeInputSchema>;
