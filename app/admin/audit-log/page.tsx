"use client";

import { History } from "lucide-react";
import { useHackathons } from "@/lib/queries/use-hackathons";
import { useAuditLog } from "@/lib/queries/use-audit-log";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/layout/empty-state";
import { ErrorState } from "@/components/layout/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDateTimeAr } from "@/lib/format/dates";

export default function AuditLogPage() {
  const hackathonsQuery = useHackathons();
  const activeHackathon = hackathonsQuery.data?.[0];
  const auditLogQuery = useAuditLog(activeHackathon?.id);

  const logs = auditLogQuery.data ?? [];
  const isLoading = hackathonsQuery.isLoading || auditLogQuery.isLoading;
  const isError = hackathonsQuery.isError || auditLogQuery.isError;

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="سجل الأحداث"
        description="سجل بجميع الإجراءات التي تمت على هذا الهاكاثون."
      />

      {isError && (
        <ErrorState
          description="تعذّر تحميل سجل الأحداث."
          onRetry={() => {
            hackathonsQuery.refetch();
            auditLogQuery.refetch();
          }}
        />
      )}

      {isLoading && (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      )}

      {!isLoading && !isError && !activeHackathon && (
        <EmptyState
          icon={History}
          title="لا توجد هاكاثونات بعد"
          description="أنشئ هاكاثونًا أولًا لعرض سجل الأحداث."
        />
      )}

      {!isLoading && !isError && activeHackathon && logs.length === 0 && (
        <EmptyState
          icon={History}
          title="لا توجد أحداث بعد"
          description="ستظهر هنا كل الإجراءات مثل إضافة المحكمين وإرسال التقييمات."
        />
      )}

      {!isLoading && !isError && activeHackathon && logs.length > 0 && (
        <ol className="space-y-3">
          {logs.map((log) => (
            <li
              key={log.id}
              className="rounded-lg border border-border bg-card p-3"
            >
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm text-foreground">{log.summary}</p>
                <span className="shrink-0 text-xs whitespace-nowrap text-muted-foreground">
                  {formatDateTimeAr(log.createdAt)}
                </span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                بواسطة {log.actorName}
              </p>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
