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
  /**
   * Present only for judge-role users — the Judge record for their "primary"
   * (first) hackathon membership. Kept for backward compatibility with
   * single-hackathon judges and existing callers; prefer `judgeIds` for any
   * new code, since a single auth identity can hold one Judge record per
   * hackathon (see docs/supabase-schema.md "Auth linkage").
   */
  judgeId: z.string().optional(),
  /**
   * Every Judge record linked to this auth identity, keyed by hackathonId.
   * Empty/absent for admins. Has exactly one entry for the common
   * single-hackathon case, mirroring `judgeId`; more than one entry means
   * this person judges multiple hackathons.
   */
  judgeIdsByHackathon: z.record(z.string(), z.string()).optional(),
});

export type User = z.infer<typeof userSchema>;
