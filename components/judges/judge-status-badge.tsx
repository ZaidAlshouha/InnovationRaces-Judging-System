import { Badge } from "@/components/ui/badge";
import { JudgeStatus, JUDGE_STATUS_LABELS_AR } from "@/lib/domain/judge";
import type { Judge } from "@/lib/domain/judge";

export function JudgeStatusBadge({ status }: { status: Judge["status"] }) {
  return (
    <Badge variant={status === JudgeStatus.Active ? "default" : "outline"}>
      {JUDGE_STATUS_LABELS_AR[status]}
    </Badge>
  );
}
