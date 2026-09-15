import type { AssignmentRepository } from "@/lib/data/repositories";
import type { Assignment, CreateAssignmentInput } from "@/lib/domain/assignment";
import { AssignmentStatus, isDuplicateAssignment } from "@/lib/domain/assignment";
import { getMockStore, generateId, mockDelay } from "./store";

export class MockAssignmentRepository implements AssignmentRepository {
  async listByHackathon(hackathonId: string): Promise<Assignment[]> {
    await mockDelay();
    return getMockStore().assignments.filter(
      (a) => a.hackathonId === hackathonId
    );
  }

  async listByJudge(judgeId: string): Promise<Assignment[]> {
    await mockDelay();
    return getMockStore().assignments.filter((a) => a.judgeId === judgeId);
  }

  async listByProject(projectId: string): Promise<Assignment[]> {
    await mockDelay();
    return getMockStore().assignments.filter((a) => a.projectId === projectId);
  }

  async getById(id: string): Promise<Assignment | null> {
    await mockDelay();
    return getMockStore().assignments.find((a) => a.id === id) ?? null;
  }

  async create(input: CreateAssignmentInput): Promise<Assignment> {
    await mockDelay();
    const store = getMockStore();
    if (isDuplicateAssignment(store.assignments, input)) {
      throw new Error("هذا المحكّم مُعيّن بالفعل لهذا المشروع");
    }
    const now = new Date().toISOString();
    const assignment: Assignment = {
      ...input,
      id: generateId("assign"),
      status: AssignmentStatus.Pending,
      assignedAt: now,
      updatedAt: now,
    };
    store.assignments.push(assignment);
    return assignment;
  }

  async createMany(inputs: CreateAssignmentInput[]): Promise<Assignment[]> {
    await mockDelay();
    const store = getMockStore();
    const now = new Date().toISOString();
    const created: Assignment[] = [];

    for (const input of inputs) {
      if (
        isDuplicateAssignment(store.assignments, input) ||
        isDuplicateAssignment(created, input)
      ) {
        continue; // skip silently — bulk assignment is idempotent by design
      }
      const assignment: Assignment = {
        ...input,
        id: generateId("assign"),
        status: AssignmentStatus.Pending,
        assignedAt: now,
        updatedAt: now,
      };
      created.push(assignment);
    }

    store.assignments.push(...created);
    return created;
  }

  async delete(id: string): Promise<void> {
    await mockDelay();
    const store = getMockStore();
    store.assignments = store.assignments.filter((a) => a.id !== id);
  }
}
