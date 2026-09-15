/**
 * In-memory mutable store seeded from the static mock-data fixtures.
 *
 * Using a module-level singleton (not re-reading the fixture arrays on every
 * call) lets create/update/delete operations behave like a real database
 * within a single server process — closer to how the Supabase-backed
 * repositories will behave once connected.
 */
import { mockHackathons } from "@/mock-data/hackathons";
import { mockProjects } from "@/mock-data/projects";
import { mockJudges } from "@/mock-data/judges";
import { mockCriteria } from "@/mock-data/criteria";
import { mockAssignments } from "@/mock-data/assignments";
import { mockEvaluations } from "@/mock-data/evaluations";
import type { Hackathon } from "@/lib/domain/hackathon";
import type { Project } from "@/lib/domain/project";
import type { Judge } from "@/lib/domain/judge";
import type { Criterion } from "@/lib/domain/criterion";
import type { Assignment } from "@/lib/domain/assignment";
import type { Evaluation } from "@/lib/domain/evaluation";
import type { AuditLog } from "@/lib/domain/audit-log";

interface MockStoreState {
  hackathons: Hackathon[];
  projects: Project[];
  judges: Judge[];
  criteria: Criterion[];
  assignments: Assignment[];
  evaluations: Evaluation[];
  auditLogs: AuditLog[];
}

function cloneFixtures(): MockStoreState {
  return {
    hackathons: structuredClone(mockHackathons),
    projects: structuredClone(mockProjects),
    judges: structuredClone(mockJudges),
    criteria: structuredClone(mockCriteria),
    assignments: structuredClone(mockAssignments),
    evaluations: structuredClone(mockEvaluations),
    auditLogs: [],
  };
}

const globalForStore = globalThis as unknown as {
  __mockStore?: MockStoreState;
};

export function getMockStore(): MockStoreState {
  if (!globalForStore.__mockStore) {
    globalForStore.__mockStore = cloneFixtures();
  }
  return globalForStore.__mockStore;
}

/** Resets the in-memory store back to the original fixtures — used by tests. */
export function resetMockStore(): void {
  globalForStore.__mockStore = cloneFixtures();
}

let idCounter = 1000;
export function generateId(prefix: string): string {
  idCounter += 1;
  return `${prefix}-${idCounter}`;
}

/** Simulates real network latency so loading states are visible/testable in the UI. */
export function mockDelay(ms = 250): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
