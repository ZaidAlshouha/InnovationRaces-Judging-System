"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { evaluationRepository } from "@/lib/data";
import type { SubmitEvaluationInput } from "@/lib/domain/evaluation";
import { queryKeys } from "./keys";

export function useEvaluationByAssignment(assignmentId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.evaluations.byAssignment(assignmentId ?? ""),
    queryFn: () => evaluationRepository.getByAssignmentId(assignmentId as string),
    enabled: Boolean(assignmentId),
  });
}

export function useEvaluations(hackathonId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.evaluations.byHackathon(hackathonId ?? ""),
    queryFn: () => evaluationRepository.listByHackathon(hackathonId as string),
    enabled: Boolean(hackathonId),
  });
}

export function useSubmitEvaluation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      judgeId,
      input,
    }: {
      judgeId: string;
      input: SubmitEvaluationInput;
    }) => evaluationRepository.submit(judgeId, input),
    onSuccess: (evaluation) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.evaluations.byAssignment(evaluation.assignmentId),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.evaluations.byHackathon(evaluation.hackathonId),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.assignments.byJudge(evaluation.judgeId),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.assignments.byHackathon(evaluation.hackathonId),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.results.byHackathon(evaluation.hackathonId),
      });
    },
  });
}

export function useReopenEvaluation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      evaluationId,
      actorUserId,
    }: {
      evaluationId: string;
      actorUserId: string;
    }) => evaluationRepository.reopen(evaluationId, actorUserId),
    onSuccess: (evaluation) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.evaluations.byAssignment(evaluation.assignmentId),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.evaluations.byHackathon(evaluation.hackathonId),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.assignments.byJudge(evaluation.judgeId),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.assignments.byHackathon(evaluation.hackathonId),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.results.byHackathon(evaluation.hackathonId),
      });
    },
  });
}
