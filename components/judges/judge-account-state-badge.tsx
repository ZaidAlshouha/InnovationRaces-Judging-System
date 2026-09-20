"use client";

import { Badge } from "@/components/ui/badge";
import {
  JudgeAccountState,
  JUDGE_ACCOUNT_STATE_LABELS_AR,
  JUDGE_ACCOUNT_STATE_LABELS_EN,
  deriveJudgeAccountState,
} from "@/lib/domain/judge-invitation";
import type { Judge } from "@/lib/domain/judge";
import { useLocale } from "@/lib/i18n/locale-context";
import { pickLabel } from "@/lib/i18n/enum-labels";

/**
 * Shows the derived account state (see deriveJudgeAccountState — no new
 * "invitation status" DB column, purely computed from judges.user_id/
 * status plus the real Auth-confirmation signal fetched via
 * useJudgeActivationStatus()) as a badge, matching JudgeStatusBadge's own
 * component shape. `activated` is undefined while that fetch is still
 * pending/not yet requested — deriveJudgeAccountState treats that the same
 * as "not activated" (the conservative default), so this badge never
 * flashes "Active" before the real signal has actually loaded.
 */
export function JudgeAccountStateBadge({
  judge,
  activated,
}: {
  judge: Pick<Judge, "userId" | "status">;
  activated?: boolean;
}) {
  const { locale } = useLocale();
  const state = deriveJudgeAccountState(judge, activated);
  const variant =
    state === JudgeAccountState.Active
      ? "default"
      : state === JudgeAccountState.PendingActivation
        ? "secondary"
        : "outline";

  return (
    <Badge variant={variant}>
      {pickLabel(locale, JUDGE_ACCOUNT_STATE_LABELS_AR, JUDGE_ACCOUNT_STATE_LABELS_EN, state)}
    </Badge>
  );
}
