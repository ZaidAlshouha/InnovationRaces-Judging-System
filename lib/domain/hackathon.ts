import { z } from "zod";

export const HackathonStatus = {
  Draft: "draft",
  OpenForEvaluation: "open_for_evaluation",
  Completed: "completed",
  Archived: "archived",
} as const;

export type HackathonStatus =
  (typeof HackathonStatus)[keyof typeof HackathonStatus];

/** Arabic labels for each hackathon status — single source of truth for UI display. */
export const HACKATHON_STATUS_LABELS_AR: Record<HackathonStatus, string> = {
  [HackathonStatus.Draft]: "مسودة",
  [HackathonStatus.OpenForEvaluation]: "مفتوح للتقييم",
  [HackathonStatus.Completed]: "مكتمل",
  [HackathonStatus.Archived]: "مؤرشف",
};

export const hackathonSchema = z.object({
  id: z.string(),
  name: z.string().min(1, "اسم الهاكاثون مطلوب"),
  description: z.string().optional(),
  startDate: z.string(), // ISO date
  endDate: z.string(), // ISO date
  status: z.enum([
    HackathonStatus.Draft,
    HackathonStatus.OpenForEvaluation,
    HackathonStatus.Completed,
    HackathonStatus.Archived,
  ]),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type Hackathon = z.infer<typeof hackathonSchema>;

export const createHackathonInputSchema = hackathonSchema
  .omit({ id: true, createdAt: true, updatedAt: true, status: true })
  .extend({
    status: hackathonSchema.shape.status.default(HackathonStatus.Draft),
  })
  .refine((data) => new Date(data.endDate) >= new Date(data.startDate), {
    message: "يجب أن يكون تاريخ النهاية بعد تاريخ البداية",
    path: ["endDate"],
  });

export type CreateHackathonInput = z.infer<typeof createHackathonInputSchema>;

export const updateHackathonInputSchema = hackathonSchema
  .omit({ createdAt: true, updatedAt: true })
  .partial()
  .required({ id: true });

export type UpdateHackathonInput = z.infer<typeof updateHackathonInputSchema>;
