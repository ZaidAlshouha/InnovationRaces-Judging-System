import { Progress, ProgressIndicator, ProgressTrack } from "@/components/ui/progress";
import type { EntityCompletionStats } from "@/lib/scoring/completion-stats";

export function JudgeProgress({
  stats,
}: {
  stats: EntityCompletionStats | undefined;
}) {
  if (!stats || stats.required === 0) {
    return <span className="text-sm text-muted-foreground">لا يوجد توزيع</span>;
  }

  return (
    <div className="flex items-center gap-3">
      <Progress value={stats.percentage} className="w-28">
        <ProgressTrack>
          <ProgressIndicator />
        </ProgressTrack>
      </Progress>
      <span className="text-sm tabular-nums text-muted-foreground">
        {stats.completed} / {stats.required} مكتمل
      </span>
    </div>
  );
}
