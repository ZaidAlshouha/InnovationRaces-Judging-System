"use client";

import { Badge } from "@/components/ui/badge";
import { JudgeStatus, JUDGE_STATUS_LABELS_AR, JUDGE_STATUS_LABELS_EN } from "@/lib/domain/judge";
import type { Judge } from "@/lib/domain/judge";
import { useLocale } from "@/lib/i18n/locale-context";
import { pickLabel } from "@/lib/i18n/enum-labels";

export function JudgeStatusBadge({ status }: { status: Judge["status"] }) {
  const { locale } = useLocale();
  return (
    <Badge variant={status === JudgeStatus.Active ? "default" : "outline"}>
      {pickLabel(locale, JUDGE_STATUS_LABELS_AR, JUDGE_STATUS_LABELS_EN, status)}
    </Badge>
  );
}
