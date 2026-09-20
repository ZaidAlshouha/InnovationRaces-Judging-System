"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { judgeRepository } from "@/lib/data";
import type { CreateJudgeInput, UpdateJudgeInput } from "@/lib/domain/judge";
import type { InviteJudgeInput, InviteJudgeResult } from "@/lib/domain/judge-invitation";
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

/**
 * Drives POST /api/admin/judges/activation-status
 * (app/api/admin/judges/activation-status/route.ts) — batched, read-only
 * lookup of whether each given judges.user_id has actually confirmed their
 * Supabase Auth account. See that route and deriveJudgeAccountState's own
 * header comments for why judges.user_id alone cannot answer this.
 * Returns `{}` (nothing fetched, nothing marked activated) while userIds
 * is empty, so callers can pass an always-defined array.
 */
export function useJudgeActivationStatus(userIds: string[]) {
  const sortedKey = React.useMemo(() => [...userIds].sort(), [userIds]);
  return useQuery({
    queryKey: ["judges", "activation-status", sortedKey] as const,
    queryFn: async (): Promise<Record<string, boolean>> => {
      if (sortedKey.length === 0) return {};
      const response = await fetch("/api/admin/judges/activation-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userIds: sortedKey }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? "تعذّر التحقق من حالة التفعيل");
      }
      return payload.activated as Record<string, boolean>;
    },
    enabled: sortedKey.length > 0,
  });
}

/**
 * Drives POST /api/admin/judges/invite (app/api/admin/judges/invite/route.ts)
 * — the only client-side entry point for the invitation flow. Never talks
 * to Supabase directly (no repository involved): this is a server-only
 * operation (creates/invites a Supabase Auth account via service_role),
 * unlike every other judges-table mutation in this file, which goes
 * through judgeRepository under ordinary RLS.
 */
export function useInviteJudge() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: InviteJudgeInput): Promise<InviteJudgeResult> => {
      const response = await fetch("/api/admin/judges/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? "تعذّر إرسال دعوة المحكّم");
      }
      return payload as InviteJudgeResult;
    },
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.judges.byHackathon(variables.hackathonId),
      });
    },
  });
}
