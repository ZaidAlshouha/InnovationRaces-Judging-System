"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { criterionRepository } from "@/lib/data";
import type {
  CreateCriterionInput,
  UpdateCriterionInput,
} from "@/lib/domain/criterion";
import { queryKeys } from "./keys";

export function useCriteria(hackathonId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.criteria.byHackathon(hackathonId ?? ""),
    queryFn: () => criterionRepository.listByHackathon(hackathonId as string),
    enabled: Boolean(hackathonId),
  });
}

export function useCreateCriterion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateCriterionInput) => criterionRepository.create(input),
    onSuccess: (created) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.criteria.byHackathon(created.hackathonId),
      });
    },
  });
}

export function useUpdateCriterion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateCriterionInput) => criterionRepository.update(input),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.criteria.byHackathon(updated.hackathonId),
      });
    },
  });
}

export function useDeleteCriterion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id }: { id: string; hackathonId: string }) =>
      criterionRepository.delete(id),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.criteria.byHackathon(variables.hackathonId),
      });
    },
  });
}
