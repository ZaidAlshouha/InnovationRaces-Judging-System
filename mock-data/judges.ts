import type { Judge } from "@/lib/domain/judge";
import { JudgeStatus } from "@/lib/domain/judge";
import { HACKATHON_ID } from "./hackathons";

export const mockJudges: Judge[] = [
  {
    id: "judge-ahmad",
    hackathonId: HACKATHON_ID,
    name: "أحمد المطيري",
    email: "ahmad.almutairi@innovationraces.demo",
    status: JudgeStatus.Active,
    createdAt: "2026-07-15T08:00:00.000Z",
    updatedAt: "2026-07-15T08:00:00.000Z",
  },
  {
    id: "judge-mohammed",
    hackathonId: HACKATHON_ID,
    name: "محمد العتيبي",
    email: "mohammed.alotaibi@innovationraces.demo",
    status: JudgeStatus.Active,
    createdAt: "2026-07-15T08:00:00.000Z",
    updatedAt: "2026-07-15T08:00:00.000Z",
  },
  {
    id: "judge-khalid",
    hackathonId: HACKATHON_ID,
    name: "خالد الشمري",
    email: "khalid.alshamri@innovationraces.demo",
    status: JudgeStatus.Active,
    createdAt: "2026-07-15T08:00:00.000Z",
    updatedAt: "2026-07-15T08:00:00.000Z",
  },
  {
    id: "judge-sarah",
    hackathonId: HACKATHON_ID,
    name: "سارة القحطاني",
    email: "sarah.alqahtani@innovationraces.demo",
    status: JudgeStatus.Active,
    createdAt: "2026-07-15T08:00:00.000Z",
    updatedAt: "2026-07-15T08:00:00.000Z",
  },
  {
    id: "judge-nora",
    hackathonId: HACKATHON_ID,
    name: "نورة الدوسري",
    email: "nora.aldosari@innovationraces.demo",
    status: JudgeStatus.Active,
    createdAt: "2026-07-15T08:00:00.000Z",
    updatedAt: "2026-07-15T08:00:00.000Z",
  },
  {
    id: "judge-faisal",
    hackathonId: HACKATHON_ID,
    name: "فيصل الحربي",
    email: "faisal.alharbi@innovationraces.demo",
    status: JudgeStatus.Inactive,
    createdAt: "2026-07-15T08:00:00.000Z",
    updatedAt: "2026-08-25T10:00:00.000Z",
  },
];
