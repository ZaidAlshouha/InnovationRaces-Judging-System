/**
 * Composition root for the data-access layer.
 *
 * The UI and services import repositories from here — never from
 * `lib/data/mock/*` or `lib/data/supabase/*` directly. Migrating to
 * Supabase later means adding implementations under `lib/data/supabase/`
 * and swapping the instances constructed below; no other file changes.
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

export const hackathonRepository = new MockHackathonRepository();
export const projectRepository = new MockProjectRepository();
export const judgeRepository = new MockJudgeRepository();
export const criterionRepository = new MockCriterionRepository();
export const assignmentRepository = new MockAssignmentRepository();
export const evaluationRepository = new MockEvaluationRepository();
export const resultsRepository = new MockResultsRepository();
export const auditLogRepository = new MockAuditLogRepository();
export const authRepository = new MockAuthRepository();

export * from "./repositories";
