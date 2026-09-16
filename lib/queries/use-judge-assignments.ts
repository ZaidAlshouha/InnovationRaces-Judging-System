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
