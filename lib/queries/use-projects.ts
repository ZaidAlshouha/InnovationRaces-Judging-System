"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { projectRepository } from "@/lib/data";
import type { CreateProjectInput, UpdateProjectInput } from "@/lib/domain/project";
import { queryKeys } from "./keys";

export function useProjects(hackathonId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.projects.byHackathon(hackathonId ?? ""),
    queryFn: () => projectRepository.listByHackathon(hackathonId as string),
    enabled: Boolean(hackathonId),
  });
}

export function useProject(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.projects.detail(id ?? ""),
    queryFn: () => projectRepository.getById(id as string),
    enabled: Boolean(id),
  });
}

export function useCreateProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateProjectInput) => projectRepository.create(input),
    onSuccess: (created) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.projects.byHackathon(created.hackathonId),
      });
    },
  });
}

export function useUpdateProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateProjectInput) => projectRepository.update(input),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.projects.byHackathon(updated.hackathonId),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.projects.detail(updated.id),
      });
    },
  });
}

export function useDeleteProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id }: { id: string; hackathonId: string }) =>
      projectRepository.delete(id),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.projects.byHackathon(variables.hackathonId),
      });
    },
  });
}
