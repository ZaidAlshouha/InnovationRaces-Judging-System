/** Centralized TanStack Query key factory — keeps invalidation consistent across hooks. */
export const queryKeys = {
  hackathons: {
    all: ["hackathons"] as const,
    detail: (id: string) => ["hackathons", id] as const,
  },
  projects: {
    byHackathon: (hackathonId: string) => ["projects", hackathonId] as const,
    detail: (id: string) => ["projects", "detail", id] as const,
  },
  judges: {
    byHackathon: (hackathonId: string) => ["judges", hackathonId] as const,
    detail: (id: string) => ["judges", "detail", id] as const,
  },
  criteria: {
    byHackathon: (hackathonId: string) => ["criteria", hackathonId] as const,
  },
  assignments: {
    byHackathon: (hackathonId: string) => ["assignments", hackathonId] as const,
    byJudge: (judgeId: string) => ["assignments", "judge", judgeId] as const,
    byProject: (projectId: string) =>
      ["assignments", "project", projectId] as const,
  },
  evaluations: {
    byHackathon: (hackathonId: string) => ["evaluations", hackathonId] as const,
    byAssignment: (assignmentId: string) =>
      ["evaluations", "assignment", assignmentId] as const,
  },
  results: {
    byHackathon: (hackathonId: string) => ["results", hackathonId] as const,
  },
  auditLogs: {
    byHackathon: (hackathonId: string) => ["auditLogs", hackathonId] as const,
  },
};
