"use client";

import * as React from "react";
import { UsersRound, Check } from "lucide-react";
import { toast } from "sonner";
import { useHackathons } from "@/lib/queries/use-hackathons";
import { useJudges } from "@/lib/queries/use-judges";
import { useProjects } from "@/lib/queries/use-projects";
import {
  useAssignments,
  useCreateAssignment,
  useDeleteAssignment,
} from "@/lib/queries/use-assignments";
import type { Assignment } from "@/lib/domain/assignment";
import { AuditAction } from "@/lib/domain/audit-log";
import { useRecordAuditAction } from "@/lib/queries/use-audit-log";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/layout/empty-state";
import { ErrorState } from "@/components/layout/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "cn";

export default function AssignmentsPage() {
  const hackathonsQuery = useHackathons();
  const activeHackathon = hackathonsQuery.data?.[0];

  const judgesQuery = useJudges(activeHackathon?.id);
  const projectsQuery = useProjects(activeHackathon?.id);
  const assignmentsQuery = useAssignments(activeHackathon?.id);

  const createMutation = useCreateAssignment();
  const deleteMutation = useDeleteAssignment();
  const recordAudit = useRecordAuditAction();
  const [pendingKey, setPendingKey] = React.useState<string | null>(null);

  const judges = React.useMemo(
    () => (judgesQuery.data ?? []).slice().sort((a, b) => a.name.localeCompare(b.name, "ar")),
    [judgesQuery.data]
  );
  const projects = React.useMemo(
    () => (projectsQuery.data ?? []).slice().sort((a, b) => a.projectNumber - b.projectNumber),
    [projectsQuery.data]
  );

  const assignmentByPair = React.useMemo(() => {
    const map = new Map<string, Assignment>();
    for (const a of assignmentsQuery.data ?? []) {
      map.set(`${a.judgeId}:${a.projectId}`, a);
    }
    return map;
  }, [assignmentsQuery.data]);

  const isLoading =
    hackathonsQuery.isLoading || judgesQuery.isLoading || projectsQuery.isLoading;
  const isError =
    hackathonsQuery.isError || judgesQuery.isError || projectsQuery.isError;

  async function toggleAssignment(judgeId: string, projectId: string) {
    if (!activeHackathon) return;
    const key = `${judgeId}:${projectId}`;
    const existing = assignmentByPair.get(key);
    const judgeName = judges.find((j) => j.id === judgeId)?.name ?? "";
    const projectName = projects.find((p) => p.id === projectId)?.projectName ?? "";
    setPendingKey(key);
    try {
      if (existing) {
        await deleteMutation.mutateAsync({
          id: existing.id,
          hackathonId: activeHackathon.id,
        });
        await recordAudit.mutateAsync({
          hackathonId: activeHackathon.id,
          action: AuditAction.AssignmentRemoved,
          entityType: "assignment",
          entityId: existing.id,
          summary: `تم إلغاء توزيع ${judgeName} عن مشروع ${projectName}`,
        });
      } else {
        const created = await createMutation.mutateAsync({
          hackathonId: activeHackathon.id,
          judgeId,
          projectId,
        });
        await recordAudit.mutateAsync({
          hackathonId: activeHackathon.id,
          action: AuditAction.AssignmentCreated,
          entityType: "assignment",
          entityId: created.id,
          summary: `تم توزيع ${judgeName} على مشروع ${projectName}`,
        });
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "حدث خطأ أثناء تحديث التوزيع"
      );
    } finally {
      setPendingKey(null);
    }
  }

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="توزيع المحكمين"
        description="اضغط على الخلية لتوزيع محكّم على مشروع أو إلغاء توزيعه."
      />

      {isError && (
        <ErrorState
          description="تعذّر تحميل بيانات التوزيع."
          onRetry={() => {
            hackathonsQuery.refetch();
            judgesQuery.refetch();
            projectsQuery.refetch();
          }}
        />
      )}

      {isLoading && (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      )}

      {!isLoading && !isError && !activeHackathon && (
        <EmptyState
          icon={UsersRound}
          title="لا توجد هاكاثونات بعد"
          description="أنشئ هاكاثونًا أولًا لتتمكن من توزيع المحكمين."
        />
      )}

      {!isLoading && !isError && activeHackathon && (judges.length === 0 || projects.length === 0) && (
        <EmptyState
          icon={UsersRound}
          title="لا يمكن التوزيع بعد"
          description="أضف محكّمين ومشاريع أولًا قبل إنشاء التوزيع."
        />
      )}

      {!isLoading &&
        !isError &&
        activeHackathon &&
        judges.length > 0 &&
        projects.length > 0 && (
          <div className="overflow-auto rounded-lg border border-border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="sticky start-0 z-10 bg-card">
                    المحكّم \ المشروع
                  </TableHead>
                  {projects.map((project) => (
                    <TableHead key={project.id} className="text-center">
                      #{project.projectNumber}
                      <div className="font-normal text-muted-foreground">
                        {project.teamName}
                      </div>
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {judges.map((judge) => (
                  <TableRow key={judge.id}>
                    <TableCell className="sticky start-0 z-10 bg-card font-medium text-foreground">
                      {judge.name}
                    </TableCell>
                    {projects.map((project) => {
                      const key = `${judge.id}:${project.id}`;
                      const assignment = assignmentByPair.get(key);
                      const isPending = pendingKey === key;
                      return (
                        <TableCell key={project.id} className="text-center">
                          <button
                            type="button"
                            aria-label={
                              assignment
                                ? `إلغاء توزيع ${judge.name} عن مشروع ${project.projectName}`
                                : `توزيع ${judge.name} على مشروع ${project.projectName}`
                            }
                            aria-pressed={Boolean(assignment)}
                            disabled={isPending}
                            onClick={() => toggleAssignment(judge.id, project.id)}
                            className={cn(
                              "inline-flex size-7 items-center justify-center rounded-md border transition-colors disabled:opacity-50",
                              assignment
                                ? "border-primary bg-primary text-primary-foreground"
                                : "border-border bg-transparent hover:bg-muted"
                            )}
                          >
                            {assignment && <Check className="size-4" />}
                          </button>
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
    </div>
  );
}
