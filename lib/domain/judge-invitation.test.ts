import { describe, it, expect } from "vitest";
import {
  inviteJudgeInputSchema,
  deriveJudgeAccountState,
  JudgeAccountState,
  InviteJudgeOutcome,
} from "./judge-invitation";

describe("inviteJudgeInputSchema", () => {
  it("accepts a minimal valid invite (name + email + hackathonId only)", () => {
    const result = inviteJudgeInputSchema.safeParse({
      hackathonId: "hack-1",
      name: "أحمد المطيري",
      email: "ahmad@example.com",
    });
    expect(result.success).toBe(true);
  });

  it("accepts phone and notes when provided", () => {
    const result = inviteJudgeInputSchema.safeParse({
      hackathonId: "hack-1",
      name: "أحمد المطيري",
      email: "ahmad@example.com",
      phone: "0501234567",
      notes: "خبير في الذكاء الاصطناعي",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a missing name", () => {
    const result = inviteJudgeInputSchema.safeParse({
      hackathonId: "hack-1",
      name: "",
      email: "ahmad@example.com",
    });
    expect(result.success).toBe(false);
  });

  it("rejects an invalid email", () => {
    const result = inviteJudgeInputSchema.safeParse({
      hackathonId: "hack-1",
      name: "أحمد المطيري",
      email: "not-an-email",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a missing hackathonId", () => {
    const result = inviteJudgeInputSchema.safeParse({
      hackathonId: "",
      name: "أحمد المطيري",
      email: "ahmad@example.com",
    });
    expect(result.success).toBe(false);
  });

  it("never requires or accepts a password field", () => {
    // The schema simply has no `password` key at all — parsing an object
    // that includes one must not fail (extra keys are stripped, not
    // rejected, by default Zod object behavior) and the parsed result must
    // never carry it through.
    const result = inviteJudgeInputSchema.safeParse({
      hackathonId: "hack-1",
      name: "أحمد المطيري",
      email: "ahmad@example.com",
      password: "should-be-ignored",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect("password" in result.data).toBe(false);
    }
  });
});

describe("deriveJudgeAccountState", () => {
  it("returns PendingActivation when userId is not set, regardless of status or activated", () => {
    expect(
      deriveJudgeAccountState({ userId: undefined, status: "active" }, true)
    ).toBe(JudgeAccountState.PendingActivation);
    expect(
      deriveJudgeAccountState({ userId: undefined, status: "inactive" }, true)
    ).toBe(JudgeAccountState.PendingActivation);
  });

  it("returns PendingActivation when userId is set but the Auth account has not been confirmed yet (the exact bug found in live E2E testing: userId is set at invite time, not at activation time)", () => {
    expect(
      deriveJudgeAccountState({ userId: "auth-user-1", status: "active" }, false)
    ).toBe(JudgeAccountState.PendingActivation);
  });

  it("returns PendingActivation when activated has not been fetched yet (undefined) — the conservative default, never assumes Active without confirmation", () => {
    expect(
      deriveJudgeAccountState({ userId: "auth-user-1", status: "active" })
    ).toBe(JudgeAccountState.PendingActivation);
  });

  it("returns Active when userId is set, activated is true, and status is active", () => {
    expect(
      deriveJudgeAccountState({ userId: "auth-user-1", status: "active" }, true)
    ).toBe(JudgeAccountState.Active);
  });

  it("returns Disabled when userId is set, activated is true, and status is inactive", () => {
    expect(
      deriveJudgeAccountState({ userId: "auth-user-1", status: "inactive" }, true)
    ).toBe(JudgeAccountState.Disabled);
  });
});

describe("InviteJudgeOutcome", () => {
  it("has exactly the three outcomes the invite route can return", () => {
    expect(Object.values(InviteJudgeOutcome).sort()).toEqual(
      ["already_assigned", "created", "linked_to_existing_account"].sort()
    );
  });
});
