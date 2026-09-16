"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { judgeRepository } from "@/lib/data";
import type { CreateJudgeInput, UpdateJudgeInput } from "@/lib/domain/judge";
import { queryKeys } from "./keys";

export function useJudges(hackathonId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.judges.byHackathon(hackathonId ?? ""),
    queryFn: () => judgeRepository.listByHackathon(hackathonId as string),
    enabled: Boolean(hackathonId),
  });
}

export function useJudge(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.judges.detail(id ?? ""),
    queryFn: () => judgeRepository.getById(id as string),
    enabled: Boolean(id),
  });
}

export function useCreateJudge() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateJudgeInput) => judgeRepository.create(input),
    onSuccess: (created) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.judges.byHackathon(created.hackathonId),
      });
    },
  });
}

export function useUpdateJudge() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateJudgeInput) => judgeRepository.update(input),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.judges.byHackathon(updated.hackathonId),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.judges.detail(updated.id),
      });
    },
  });
}
