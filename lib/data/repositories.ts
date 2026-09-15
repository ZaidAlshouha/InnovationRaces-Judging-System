/**
 * Repository interfaces — the seam between the UI/service layer and the
 * underlying data store.
 *
 * The UI must never import from `lib/data/mock` or `lib/data/supabase`
 * directly; it calls these interfaces via `lib/data/index.ts`, which wires
 * up whichever implementation is active. Swapping mock data for Supabase
 * later means implementing these same interfaces — no UI changes.
 */
import type {
  Hackathon,
  CreateHackathonInput,
  UpdateHackathonInput,
} from "@/lib/domain/hackathon";
import type {
  Project,
  CreateProjectInput,
  UpdateProjectInput,
} from "@/lib/domain/project";
import type { Judge, CreateJudgeInput, UpdateJudgeInput } from "@/lib/domain/judge";
import type {
  Criterion,
  CreateCriterionInput,
  UpdateCriterionInput,
} from "@/lib/domain/criterion";
import type { Assignment, CreateAssignmentInput } from "@/lib/domain/assignment";
import type {
  Evaluation,
  SubmitEvaluationInput,
} from "@/lib/domain/evaluation";
import type { AuditLog, CreateAuditLogInput } from "@/lib/domain/audit-log";
import type { ProjectResult } from "@/lib/domain/result";
import type { User } from "@/lib/domain/user";

export interface HackathonRepository {
  list(): Promise<Hackathon[]>;
  getById(id: string): Promise<Hackathon | null>;
  create(input: CreateHackathonInput): Promise<Hackathon>;
  update(input: UpdateHackathonInput): Promise<Hackathon>;
}

export interface ProjectRepository {
  listByHackathon(hackathonId: string): Promise<Project[]>;
  getById(id: string): Promise<Project | null>;
  create(input: CreateProjectInput): Promise<Project>;
  update(input: UpdateProjectInput): Promise<Project>;
  delete(id: string): Promise<void>;
}

export interface JudgeRepository {
  listByHackathon(hackathonId: string): Promise<Judge[]>;
  getById(id: string): Promise<Judge | null>;
  getByEmail(email: string): Promise<Judge | null>;
  create(input: CreateJudgeInput): Promise<Judge>;
  update(input: UpdateJudgeInput): Promise<Judge>;
  delete(id: string): Promise<void>;
}

export interface CriterionRepository {
  listByHackathon(hackathonId: string): Promise<Criterion[]>;
  create(input: CreateCriterionInput): Promise<Criterion>;
  update(input: UpdateCriterionInput): Promise<Criterion>;
  delete(id: string): Promise<void>;
}

export interface AssignmentRepository {
  listByHackathon(hackathonId: string): Promise<Assignment[]>;
  listByJudge(judgeId: string): Promise<Assignment[]>;
  listByProject(projectId: string): Promise<Assignment[]>;
  getById(id: string): Promise<Assignment | null>;
  create(input: CreateAssignmentInput): Promise<Assignment>;
  createMany(inputs: CreateAssignmentInput[]): Promise<Assignment[]>;
  delete(id: string): Promise<void>;
}

export interface EvaluationRepository {
  listByHackathon(hackathonId: string): Promise<Evaluation[]>;
  listByJudge(judgeId: string): Promise<Evaluation[]>;
  listByProject(projectId: string): Promise<Evaluation[]>;
  getByAssignmentId(assignmentId: string): Promise<Evaluation | null>;
  submit(
    judgeId: string,
    input: SubmitEvaluationInput
  ): Promise<Evaluation>;
  /** Admin-only: unlocks a submitted evaluation so the judge can resubmit. */
  reopen(evaluationId: string, actorUserId: string): Promise<Evaluation>;
}

export interface ResultsRepository {
  getProjectResults(hackathonId: string): Promise<ProjectResult[]>;
  getProjectResult(projectId: string): Promise<ProjectResult | null>;
}

export interface AuditLogRepository {
  listByHackathon(hackathonId: string): Promise<AuditLog[]>;
  create(input: CreateAuditLogInput): Promise<AuditLog>;
}

/**
 * Auth is intentionally minimal for the mock phase: given credentials,
 * resolve to a domain User (or null). The Supabase implementation will
 * back this with real session/JWT handling behind the same interface.
 */
export interface AuthRepository {
  signIn(email: string, password: string): Promise<User | null>;
  getCurrentUser(): Promise<User | null>;
  signOut(): Promise<void>;
}
