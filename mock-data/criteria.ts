import type { Criterion } from "@/lib/domain/criterion";
import { HACKATHON_ID } from "./hackathons";

export const mockCriteria: Criterion[] = [
  {
    id: "criterion-innovation",
    hackathonId: HACKATHON_ID,
    name: "الابتكار",
    description: "مدى تميّز الفكرة وحداثتها مقارنة بالحلول الحالية في السوق.",
    weight: 30,
    maxScore: 10,
    order: 0,
    createdAt: "2026-07-10T08:00:00.000Z",
    updatedAt: "2026-07-10T08:00:00.000Z",
  },
  {
    id: "criterion-impact",
    hackathonId: HACKATHON_ID,
    name: "الأثر",
    description: "حجم الأثر المتوقع للمشروع على المستفيدين والمجتمع.",
    weight: 30,
    maxScore: 10,
    order: 1,
    createdAt: "2026-07-10T08:00:00.000Z",
    updatedAt: "2026-07-10T08:00:00.000Z",
  },
  {
    id: "criterion-feasibility",
    hackathonId: HACKATHON_ID,
    name: "القابلية للتنفيذ",
    description: "مدى واقعية تنفيذ المشروع تقنيًا وتشغيليًا خلال فترة معقولة.",
    weight: 25,
    maxScore: 10,
    order: 2,
    createdAt: "2026-07-10T08:00:00.000Z",
    updatedAt: "2026-07-10T08:00:00.000Z",
  },
  {
    id: "criterion-presentation",
    hackathonId: HACKATHON_ID,
    name: "العرض والتقديم",
    description: "وضوح العرض التقديمي وقدرة الفريق على إيصال الفكرة.",
    weight: 15,
    maxScore: 10,
    order: 3,
    createdAt: "2026-07-10T08:00:00.000Z",
    updatedAt: "2026-07-10T08:00:00.000Z",
  },
];
