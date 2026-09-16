"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { hackathonRepository } from "@/lib/data";
import type {
  CreateHackathonInput,
  UpdateHackathonInput,
} from "@/lib/domain/hackathon";
import { queryKeys } from "./keys";

export function useHackathons() {
  return useQuery({
    queryKey: queryKeys.hackathons.all,
    queryFn: () => hackathonRepository.list(),
  });
}

export function useHackathon(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.hackathons.detail(id ?? ""),
    queryFn: () => hackathonRepository.getById(id as string),
    enabled: Boolean(id),
  });
}

export function useCreateHackathon() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateHackathonInput) =>
      hackathonRepository.create(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.hackathons.all });
    },
  });
}

export function useUpdateHackathon() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateHackathonInput) =>
      hackathonRepository.update(input),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.hackathons.all });
      queryClient.invalidateQueries({
        queryKey: queryKeys.hackathons.detail(updated.id),
      });
    },
  });
}
