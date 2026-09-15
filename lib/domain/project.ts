import { z } from "zod";

export const projectSchema = z.object({
  id: z.string(),
  hackathonId: z.string(),
  projectNumber: z.number().int().positive(),
  teamName: z.string().min(1, "اسم الفريق مطلوب"),
  projectName: z.string().min(1, "اسم المشروع مطلوب"),
  description: z.string().optional(),
  category: z.string().optional(),
  projectUrl: z.string().url("رابط غير صالح").optional().or(z.literal("")),
  demoUrl: z.string().url("رابط غير صالح").optional().or(z.literal("")),
  additionalInfo: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type Project = z.infer<typeof projectSchema>;

export const createProjectInputSchema = projectSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type CreateProjectInput = z.infer<typeof createProjectInputSchema>;

export const updateProjectInputSchema = projectSchema
  .omit({ createdAt: true, updatedAt: true })
  .partial()
  .required({ id: true });

export type UpdateProjectInput = z.infer<typeof updateProjectInputSchema>;
