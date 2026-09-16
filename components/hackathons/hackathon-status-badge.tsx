import { Badge } from "@/components/ui/badge";
import { HackathonStatus, HACKATHON_STATUS_LABELS_AR } from "@/lib/domain/hackathon";
import type { Hackathon } from "@/lib/domain/hackathon";

const STATUS_VARIANT: Record<
  Hackathon["status"],
  "default" | "secondary" | "outline"
> = {
  [HackathonStatus.Draft]: "outline",
  [HackathonStatus.OpenForEvaluation]: "default",
  [HackathonStatus.Completed]: "secondary",
  [HackathonStatus.Archived]: "outline",
};

export function HackathonStatusBadge({ status }: { status: Hackathon["status"] }) {
  return (
    <Badge variant={STATUS_VARIANT[status]}>
      {HACKATHON_STATUS_LABELS_AR[status]}
    </Badge>
  );
}
