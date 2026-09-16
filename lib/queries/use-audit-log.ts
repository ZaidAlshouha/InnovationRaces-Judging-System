"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { auditLogRepository } from "@/lib/data";
import type { AuditAction } from "@/lib/domain/audit-log";
import { AUDIT_ACTION_LABELS_AR } from "@/lib/domain/audit-log";
import { useAuth } from "@/lib/auth/auth-context";
import { queryKeys } from "./keys";

export function useAuditLog(hackathonId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.auditLogs.byHackathon(hackathonId ?? ""),
    queryFn: () => auditLogRepository.listByHackathon(hackathonId as string),
    enabled: Boolean(hackathonId),
  });
}

interface RecordAuditActionInput {
  hackathonId: string;
  action: AuditAction;
  entityType: string;
  entityId: string;
  /** Overrides the default Arabic label for this action, e.g. to include a name. */
  summary?: string;
  previousValue?: unknown;
  newValue?: unknown;
}

/**
 * Records an audit log entry attributed to the signed-in user. This is the
 * only place that should call `auditLogRepository.create` — mutation hooks
 * call this from their `onSuccess` so every write is traceable, since the
 * mock repositories themselves stay storage-only (see
 * `lib/data/mock/evaluation-repository.ts`'s `reopen`).
 */
export function useRecordAuditAction() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: RecordAuditActionInput) => {
      if (!user) throw new Error("لا يمكن تسجيل الإجراء بدون مستخدم مسجّل الدخول");
      return auditLogRepository.create({
        hackathonId: input.hackathonId,
        action: input.action,
        actorUserId: user.id,
        actorName: user.name,
        entityType: input.entityType,
        entityId: input.entityId,
        summary: input.summary ?? AUDIT_ACTION_LABELS_AR[input.action],
        previousValue: input.previousValue,
        newValue: input.newValue,
      });
    },
    onSuccess: (created) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.auditLogs.byHackathon(created.hackathonId),
      });
    },
  });
}
