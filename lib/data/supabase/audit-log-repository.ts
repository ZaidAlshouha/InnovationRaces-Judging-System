import type { AuditLogRepository } from "@/lib/data/repositories";
import type { AuditLog, CreateAuditLogInput } from "@/lib/domain/audit-log";
import { supabase, auditLogToDomain } from "./shared";

export class SupabaseAuditLogRepository implements AuditLogRepository {
  async listByHackathon(hackathonId: string): Promise<AuditLog[]> {
    const { data, error } = await supabase()
      .from("audit_logs")
      .select("*")
      .eq("hackathon_id", hackathonId)
      .order("created_at", { ascending: false });

    if (error) throw new Error(error.message);
    return (data ?? []).map(auditLogToDomain);
  }

  async create(input: CreateAuditLogInput): Promise<AuditLog> {
    const { data, error } = await supabase()
      .from("audit_logs")
      .insert({
        hackathon_id: input.hackathonId,
        action: input.action,
        actor_user_id: input.actorUserId,
        actor_name: input.actorName,
        entity_type: input.entityType,
        entity_id: input.entityId,
        summary: input.summary,
        previous_value: input.previousValue ?? null,
        new_value: input.newValue ?? null,
      })
      .select("*")
      .single();

    if (error || !data) {
      throw new Error(error?.message ?? "تعذّر تسجيل الإجراء");
    }
    return auditLogToDomain(data);
  }
}
