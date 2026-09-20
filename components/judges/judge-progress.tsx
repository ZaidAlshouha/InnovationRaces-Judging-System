"use client";

import { Progress, ProgressIndicator, ProgressTrack } from "@/components/ui/progress";
import type { EntityCompletionStats } from "@/lib/scoring/completion-stats";
import { useTranslations } from "@/lib/i18n/locale-context";

export function JudgeProgress({
  stats,
}: {
  stats: EntityCompletionStats | undefined;
}) {
  const t = useTranslations();

  if (!stats || stats.required === 0) {
    return <span className="text-sm text-muted-foreground">{t("judging.noDistribution")}</span>;
  }

  return (
    <div className="flex items-center gap-3">
      <Progress value={stats.percentage} className="w-28">
        <ProgressTrack>
          <ProgressIndicator />
        </ProgressTrack>
      </Progress>
      <span className="text-sm tabular-nums text-muted-foreground">
        {stats.completed} / {stats.required} {t("judging.completed")}
      </span>
    </div>
  );
}
