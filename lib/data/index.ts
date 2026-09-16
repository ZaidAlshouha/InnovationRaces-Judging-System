/**
 * Composition root for the data-access layer.
 *
 * The UI and services import repositories from here — never from
 * `lib/data/mock/*` or `lib/data/supabase/*` directly. Which implementation
 * is constructed is decided here, by NEXT_PUBLIC_DATA_BACKEND, and nowhere
 * else (see docs/migration-plan.md step 3 and step 6).
 *
 * Defaults to "mock" so local dev without Supabase credentials and the
 * Vitest suite (which asserts on deterministic seeded data) keep working
 * unchanged. Set NEXT_PUBLIC_DATA_BACKEND=supabase once
 * supabase/migrations/001_initial_schema.sql and 002_auth_linkage.sql have
 * been applied and NEXT_PUBLIC_SUPABASE_URL /
 * NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY are set (see .env.local.example).
 */
import { MockHackathonRepository } from "./mock/hackathon-repository";
import { MockProjectRepository } from "./mock/project-repository";
import { MockJudgeRepository } from "./mock/judge-repository";
import { MockCriterionRepository } from "./mock/criterion-repository";
import { MockAssignmentRepository } from "./mock/assignment-repository";
import { MockEvaluationRepository } from "./mock/evaluation-repository";
import { MockResultsRepository } from "./mock/results-repository";
import { MockAuditLogRepository } from "./mock/audit-log-repository";
import { MockAuthRepository } from "./mock/auth-repository";

import { SupabaseHackathonRepository } from "./supabase/hackathon-repository";
import { SupabaseProjectRepository } from "./supabase/project-repository";
import { SupabaseJudgeRepository } from "./supabase/judge-repository";
import { SupabaseCriterionRepository } from "./supabase/criterion-repository";
import { SupabaseAssignmentRepository } from "./supabase/assignment-repository";
import { SupabaseEvaluationRepository } from "./supabase/evaluation-repository";
import { SupabaseResultsRepository } from "./supabase/results-repository";
import { SupabaseAuditLogRepository } from "./supabase/audit-log-repository";
import { SupabaseAuthRepository } from "./supabase/auth-repository";

const useSupabase = process.env.NEXT_PUBLIC_DATA_BACKEND === "supabase";

export const hackathonRepository = useSupabase
  ? new SupabaseHackathonRepository()
  : new MockHackathonRepository();
export const projectRepository = useSupabase
  ? new SupabaseProjectRepository()
  : new MockProjectRepository();
export const judgeRepository = useSupabase
  ? new SupabaseJudgeRepository()
  : new MockJudgeRepository();
export const criterionRepository = useSupabase
  ? new SupabaseCriterionRepository()
  : new MockCriterionRepository();
export const assignmentRepository = useSupabase
  ? new SupabaseAssignmentRepository()
  : new MockAssignmentRepository();
export const evaluationRepository = useSupabase
  ? new SupabaseEvaluationRepository()
  : new MockEvaluationRepository();
export const resultsRepository = useSupabase
  ? new SupabaseResultsRepository()
  : new MockResultsRepository();
export const auditLogRepository = useSupabase
  ? new SupabaseAuditLogRepository()
  : new MockAuditLogRepository();
export const authRepository = useSupabase
  ? new SupabaseAuthRepository()
  : new MockAuthRepository();

export * from "./repositories";
