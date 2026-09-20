import { describe, it, expect } from "vitest";
import {
  judgeSchema,
  createJudgeInputSchema,
  updateJudgeInputSchema,
  JudgeStatus,
} from "./judge";

const validJudge = {
  id: "judge-1",
  hackathonId: "hack-1",
  name: "أحمد المطيري",
  email: "ahmad@example.com",
  status: JudgeStatus.Active,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

describe("judgeSchema", () => {
  it("accepts a judge with no userId/phone/notes set (the common case before invitation)", () => {
    expect(() => judgeSchema.parse(validJudge)).not.toThrow();
  });

  it("accepts a judge with userId/phone/notes all set", () => {
    expect(() =>
      judgeSchema.parse({
        ...validJudge,
        userId: "auth-user-1",
        phone: "0501234567",
        notes: "خبير في تطبيقات الجوال",
      })
    ).not.toThrow();
  });
});

describe("createJudgeInputSchema", () => {
  it("never accepts/exposes userId — it is server/trigger-derived only", () => {
    const parsed = createJudgeInputSchema.parse({
      hackathonId: "hack-1",
      name: "أحمد المطيري",
      email: "ahmad@example.com",
    });
    expect("userId" in parsed).toBe(false);
  });
});

describe("updateJudgeInputSchema", () => {
  it("allows a partial update touching only phone/notes", () => {
    const result = updateJudgeInputSchema.safeParse({
      id: "judge-1",
      phone: "0501234567",
      notes: "ملاحظة",
    });
    expect(result.success).toBe(true);
  });

  it("never accepts/exposes userId through the generic update path", () => {
    const parsed = updateJudgeInputSchema.parse({
      id: "judge-1",
      name: "اسم جديد",
    });
    expect("userId" in parsed).toBe(false);
  });

  it("requires an id", () => {
    const result = updateJudgeInputSchema.safeParse({ name: "اسم جديد" });
    expect(result.success).toBe(false);
  });
});
