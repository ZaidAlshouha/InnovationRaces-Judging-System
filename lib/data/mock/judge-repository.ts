import type { JudgeRepository } from "@/lib/data/repositories";
import type { Judge, CreateJudgeInput, UpdateJudgeInput } from "@/lib/domain/judge";
import { JudgeStatus } from "@/lib/domain/judge";
import { getMockStore, generateId, mockDelay } from "./store";

export class MockJudgeRepository implements JudgeRepository {
  async listByHackathon(hackathonId: string): Promise<Judge[]> {
    await mockDelay();
    return getMockStore().judges.filter((j) => j.hackathonId === hackathonId);
  }

  async getById(id: string): Promise<Judge | null> {
    await mockDelay();
    return getMockStore().judges.find((j) => j.id === id) ?? null;
  }

  async getByEmail(email: string): Promise<Judge | null> {
    await mockDelay();
    return (
      getMockStore().judges.find(
        (j) => j.email.toLowerCase() === email.toLowerCase()
      ) ?? null
    );
  }

  async create(input: CreateJudgeInput): Promise<Judge> {
    await mockDelay();
    const now = new Date().toISOString();
    const judge: Judge = {
      ...input,
      status: input.status ?? JudgeStatus.Active,
      id: generateId("judge"),
      createdAt: now,
      updatedAt: now,
    };
    getMockStore().judges.push(judge);
    return judge;
  }

  async update(input: UpdateJudgeInput): Promise<Judge> {
    await mockDelay();
    const store = getMockStore();
    const index = store.judges.findIndex((j) => j.id === input.id);
    if (index === -1) {
      throw new Error("المحكّم غير موجود");
    }
    const updated: Judge = {
      ...store.judges[index],
      ...input,
      updatedAt: new Date().toISOString(),
    };
    store.judges[index] = updated;
    return updated;
  }

  async delete(id: string): Promise<void> {
    await mockDelay();
    const store = getMockStore();
    store.judges = store.judges.filter((j) => j.id !== id);
  }
}
