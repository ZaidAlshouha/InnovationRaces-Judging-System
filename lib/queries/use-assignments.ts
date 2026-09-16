"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { assignmentRepository } from "@/lib/data";
import type { CreateAssignmentInput } from "@/lib/domain/assignment";
import { queryKeys } from "./keys";

export function useAssignments(hackathonId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.assignments.byHackathon(hackathonId ?? ""),
    queryFn: () => assignmentRepository.listByHackathon(hackathonId as string),
    enabled: Boolean(hackathonId),
  });
}

export function useAssignment(id: string | undefined) {
  return useQuery({
    queryKey: ["assignments", "detail", id ?? ""] as const,
    queryFn: () => assignmentRepository.getById(id as string),
    enabled: Boolean(id),
  });
}

export function useCreateAssignment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateAssignmentInput) => assignmentRepository.create(input),
    onSuccess: (created) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.assignments.byHackathon(created.hackathonId),
      });
    },
  });
}

export function useCreateAssignments() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (inputs: CreateAssignmentInput[]) =>
      assignmentRepository.createMany(inputs),
    onSuccess: (created, variables) => {
      const hackathonId = created[0]?.hackathonId ?? variables[0]?.hackathonId;
      if (hackathonId) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.assignments.byHackathon(hackathonId),
        });
      }
    },
  });
}

export function useDeleteAssignment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id }: { id: string; hackathonId: string }) =>
      assignmentRepository.delete(id),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.assignments.byHackathon(variables.hackathonId),
      });
    },
  });
}
