import { Badge } from "@/components/ui/badge";
import type { EntityCompletionStats } from "@/lib/scoring/completion-stats";

export function ProjectCompletionBadge({
  stats,
}: {
  stats: EntityCompletionStats | undefined;
}) {
  if (!stats || stats.required === 0) {
    return <Badge variant="outline">لا يوجد توزيع</Badge>;
  }

  const isComplete = stats.completed === stats.required;

  return (
    <Badge variant={isComplete ? "default" : "secondary"}>
      {stats.completed} / {stats.required} {isComplete ? "مكتمل" : "قيد التقييم"}
    </Badge>
  );
}
