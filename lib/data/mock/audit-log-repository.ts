import type { AuditLogRepository } from "@/lib/data/repositories";
import type { AuditLog, CreateAuditLogInput } from "@/lib/domain/audit-log";
import { getMockStore, generateId, mockDelay } from "./store";

export class MockAuditLogRepository implements AuditLogRepository {
  async listByHackathon(hackathonId: string): Promise<AuditLog[]> {
    await mockDelay();
    return getMockStore()
      .auditLogs.filter((log) => log.hackathonId === hackathonId)
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  }

  async create(input: CreateAuditLogInput): Promise<AuditLog> {
    await mockDelay(50);
    const log: AuditLog = {
      ...input,
      id: generateId("audit"),
      createdAt: new Date().toISOString(),
    };
    getMockStore().auditLogs.push(log);
    return log;
  }
}
