import type { ProjectRepository } from "@/lib/data/repositories";
import type {
  Project,
  CreateProjectInput,
  UpdateProjectInput,
} from "@/lib/domain/project";
import { getMockStore, generateId, mockDelay } from "./store";

export class MockProjectRepository implements ProjectRepository {
  async listByHackathon(hackathonId: string): Promise<Project[]> {
    await mockDelay();
    return getMockStore().projects.filter((p) => p.hackathonId === hackathonId);
  }

  async getById(id: string): Promise<Project | null> {
    await mockDelay();
    return getMockStore().projects.find((p) => p.id === id) ?? null;
  }

  async create(input: CreateProjectInput): Promise<Project> {
    await mockDelay();
    const now = new Date().toISOString();
    const project: Project = {
      ...input,
      id: generateId("project"),
      createdAt: now,
      updatedAt: now,
    };
    getMockStore().projects.push(project);
    return project;
  }

  async update(input: UpdateProjectInput): Promise<Project> {
    await mockDelay();
    const store = getMockStore();
    const index = store.projects.findIndex((p) => p.id === input.id);
    if (index === -1) {
      throw new Error("المشروع غير موجود");
    }
    const updated: Project = {
      ...store.projects[index],
      ...input,
      updatedAt: new Date().toISOString(),
    };
    store.projects[index] = updated;
    return updated;
  }

  async delete(id: string): Promise<void> {
    await mockDelay();
    const store = getMockStore();
    store.projects = store.projects.filter((p) => p.id !== id);
  }
}
