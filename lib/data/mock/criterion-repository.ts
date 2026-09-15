import type { CriterionRepository } from "@/lib/data/repositories";
import type {
  Criterion,
  CreateCriterionInput,
  UpdateCriterionInput,
} from "@/lib/domain/criterion";
import { getMockStore, generateId, mockDelay } from "./store";

export class MockCriterionRepository implements CriterionRepository {
  async listByHackathon(hackathonId: string): Promise<Criterion[]> {
    await mockDelay();
    return getMockStore()
      .criteria.filter((c) => c.hackathonId === hackathonId)
      .sort((a, b) => a.order - b.order);
  }

  async create(input: CreateCriterionInput): Promise<Criterion> {
    await mockDelay();
    const now = new Date().toISOString();
    const criterion: Criterion = {
      ...input,
      id: generateId("criterion"),
      createdAt: now,
      updatedAt: now,
    };
    getMockStore().criteria.push(criterion);
    return criterion;
  }

  async update(input: UpdateCriterionInput): Promise<Criterion> {
    await mockDelay();
    const store = getMockStore();
    const index = store.criteria.findIndex((c) => c.id === input.id);
    if (index === -1) {
      throw new Error("المعيار غير موجود");
    }
    const updated: Criterion = {
      ...store.criteria[index],
      ...input,
      updatedAt: new Date().toISOString(),
    };
    store.criteria[index] = updated;
    return updated;
  }

  async delete(id: string): Promise<void> {
    await mockDelay();
    const store = getMockStore();
    store.criteria = store.criteria.filter((c) => c.id !== id);
  }
}
