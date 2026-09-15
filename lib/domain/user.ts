import { z } from "zod";

export const UserRole = {
  Admin: "admin",
  Judge: "judge",
} as const;

export type UserRole = (typeof UserRole)[keyof typeof UserRole];

export const userSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  name: z.string(),
  role: z.enum([UserRole.Admin, UserRole.Judge]),
  /** Present only for judge-role users — links the auth identity to a Judge record. */
  judgeId: z.string().optional(),
});

export type User = z.infer<typeof userSchema>;
