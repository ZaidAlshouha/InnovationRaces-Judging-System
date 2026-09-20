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

export const JUDGE_STATUS_LABELS_EN: Record<JudgeStatus, string> = {
  [JudgeStatus.Active]: "Active",
  [JudgeStatus.Inactive]: "Inactive",
};

/** #rgb/#rrggbb-free, loose phone format — deliberately permissive (see submit_application()'s own phone rule: format varies too widely across locales to validate with a single regex without rejecting legitimate numbers). Only checked when non-empty; the field itself stays optional. */
export const judgePhoneSchema = z
  .string()
  .min(1, "رقم الهاتف مطلوب")
  .optional();

export const judgeSchema = z.object({
  id: z.string(),
  hackathonId: z.string(),
  /** public.judges.user_id (added in 001, exposed on the domain type starting with 017_judge_invitation.sql) — undefined until the judge accepts their invitation and the handle_new_auth_user()/link_judge_to_existing_auth_user() triggers link this row to a real auth.users row. Never set directly by any repository write; only ever read. */
  userId: z.string().optional(),
  name: z.string().min(1, "اسم المحكّم مطلوب"),
  email: z.string().email("بريد إلكتروني غير صالح"),
  /** Optional contact phone (public.judges.phone, added in 017_judge_invitation.sql). Never used for sign-in — email + the judge's own Supabase Auth password remain the only credential. */
  phone: judgePhoneSchema,
  /** Optional admin-only free-text note (public.judges.notes, added in 017_judge_invitation.sql). Never shown to the judge. */
  notes: z.string().optional(),
  status: z.enum([JudgeStatus.Active, JudgeStatus.Inactive]),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type Judge = z.infer<typeof judgeSchema>;

/**
 * Used by the plain "add a judge row" path (JudgeFormDialog's edit mode,
 * and the mock/mock-parity tests) — NOT by the invitation flow, which goes
 * through /api/admin/judges/invite instead (see
 * lib/domain/judge-invitation.ts) since that flow also creates the Auth
 * account and must run server-side with its own, stricter validation.
 * `userId` is omitted here for the same reason `archivedAt` is omitted from
 * hackathon's create-input schema: it is never client-supplied, only ever
 * derived server-side (by the Auth-linkage triggers) or read back.
 */
export const createJudgeInputSchema = judgeSchema
  .omit({ id: true, createdAt: true, updatedAt: true, status: true, userId: true })
  .extend({
    status: judgeSchema.shape.status.default(JudgeStatus.Active),
  });

export type CreateJudgeInput = z.infer<typeof createJudgeInputSchema>;

/** `userId` is deliberately excluded — Auth linkage is never set through this generic update path, only by the DB triggers themselves (see judgeSchema.shape.userId's own comment) or read back from a fetch. */
export const updateJudgeInputSchema = judgeSchema
  .omit({ createdAt: true, updatedAt: true, userId: true })
  .partial()
  .required({ id: true });

export type UpdateJudgeInput = z.infer<typeof updateJudgeInputSchema>;
