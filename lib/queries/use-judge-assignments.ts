"use client";

import { useQuery } from "@tanstack/react-query";
import { assignmentRepository, projectRepository } from "@/lib/data";
import type { Assignment } from "@/lib/domain/assignment";
import type { Project } from "@/lib/domain/project";
import { queryKeys } from "./keys";

export interface JudgeAssignmentRow {
  assignment: Assignment;
  project: Project | null;
}

/** A judge's assignments joined with their project details (by ID, never by name). */
export function useJudgeAssignmentsWithProjects(judgeId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.assignments.byJudge(judgeId ?? ""),
    queryFn: async (): Promise<JudgeAssignmentRow[]> => {
      const assignments = await assignmentRepository.listByJudge(
        judgeId as string
      );
      const projects = await Promise.all(
        assignments.map((a) => projectRepository.getById(a.projectId))
      );
      return assignments.map((assignment, index) => ({
        assignment,
        project: projects[index],
      }));
    },
    enabled: Boolean(judgeId),
  });
}

/**
 * A judge's assignments across every hackathon they judge, grouped by
 * hackathonId. `judgeIdsByHackathon` comes from `User.judgeIdsByHackathon` —
 * one Judge record per hackathon for the same signed-in auth identity (see
 * docs/supabase-schema.md "Auth linkage"). For the common single-hackathon
 * case this returns exactly one group, same rows as
 * `useJudgeAssignmentsWithProjects` would for that one judgeId.
 */
export function useJudgeAssignmentsAcrossHackathons(
  judgeIdsByHackathon: Record<string, string> | undefined
) {
  const entries = Object.entries(judgeIdsByHackathon ?? {});

  return useQuery({
    queryKey: [
      "assignments",
      "judge-multi",
      ...entries.flat().sort(),
    ] as const,
    queryFn: async (): Promise<
      { hackathonId: string; judgeId: string; rows: JudgeAssignmentRow[] }[]
    > => {
      return Promise.all(
        entries.map(async ([hackathonId, judgeId]) => {
          const assignments = await assignmentRepository.listByJudge(judgeId);
          const projects = await Promise.all(
            assignments.map((a) => projectRepository.getById(a.projectId))
          );
          return {
            hackathonId,
            judgeId,
            rows: assignments.map((assignment, index) => ({
              assignment,
              project: projects[index],
            })),
          };
        })
      );
    },
    enabled: entries.length > 0,
  });
}
