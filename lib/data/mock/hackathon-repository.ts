import type { HackathonRepository } from "@/lib/data/repositories";
import type {
  Hackathon,
  CreateHackathonInput,
  UpdateHackathonInput,
} from "@/lib/domain/hackathon";
import { getMockStore, generateId, mockDelay } from "./store";

export class MockHackathonRepository implements HackathonRepository {
  async list(): Promise<Hackathon[]> {
    await mockDelay();
    return [...getMockStore().hackathons];
  }

  async getById(id: string): Promise<Hackathon | null> {
    await mockDelay();
    return getMockStore().hackathons.find((h) => h.id === id) ?? null;
  }

  async create(input: CreateHackathonInput): Promise<Hackathon> {
    await mockDelay();
    const now = new Date().toISOString();
    const hackathon: Hackathon = {
      ...input,
      id: generateId("hack"),
      createdAt: now,
      updatedAt: now,
    };
    getMockStore().hackathons.push(hackathon);
    return hackathon;
  }

  async update(input: UpdateHackathonInput): Promise<Hackathon> {
    await mockDelay();
    const store = getMockStore();
    const index = store.hackathons.findIndex((h) => h.id === input.id);
    if (index === -1) {
      throw new Error("الهاكاثون غير موجود");
    }
    const updated: Hackathon = {
      ...store.hackathons[index],
      ...input,
      updatedAt: new Date().toISOString(),
    };
    store.hackathons[index] = updated;
    return updated;
  }
}
