import type { Hackathon } from "@/lib/domain/hackathon";
import { HackathonStatus } from "@/lib/domain/hackathon";

export const HACKATHON_ID = "hack-innovation-2026";

export const mockHackathons: Hackathon[] = [
  {
    id: HACKATHON_ID,
    name: "تحدي الابتكار 2026",
    description:
      "هاكاثون InnovationRaces السنوي لتحفيز الحلول التقنية المبتكرة في قطاعات التعليم والصحة والاستدامة.",
    startDate: "2026-08-20",
    endDate: "2026-08-22",
    status: HackathonStatus.OpenForEvaluation,
    createdAt: "2026-07-01T09:00:00.000Z",
    updatedAt: "2026-09-10T12:00:00.000Z",
  },
];
