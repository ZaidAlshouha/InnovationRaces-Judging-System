"use client";

import * as React from "react";
import { toast } from "sonner";
import { ClipboardCheck, RotateCcw } from "lucide-react";
import { useHackathons } from "@/lib/queries/use-hackathons";
import { useJudges } from "@/lib/queries/use-judges";
import { useProjects } from "@/lib/queries/use-projects";
import { useAssignments } from "@/lib/queries/use-assignments";
import { useEvaluations, useReopenEvaluation } from "@/lib/queries/use-evaluations";
import { useAuth } from "@/lib/auth/auth-context";
import { useRecordAuditAction } from "@/lib/queries/use-audit-log";
import {
  calculateJudgeCompletionStats,
  calculateProjectCompletionStats,
} from "@/lib/scoring/completion-stats";
import { AuditAction } from "@/lib/domain/audit-log";
import { EvaluationStatus } from "@/lib/domain/evaluation";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/layout/empty-state";
import { ErrorState } from "@/components/layout/error-state";
import { ConfirmDialog } from "@/components/layout/confirm-dialog";
import { JudgeProgress } from "@/components/judges/judge-progress";
import { ProjectCompletionBadge } from "@/components/projects/project-completion-badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Evaluation } from "@/lib/domain/evaluation";

export default function MonitoringPage() {
  const { user } = useAuth();
  const hackathonsQuery = useHackathons();
  const activeHackathon = hackathonsQuery.data?.[0];

  const judgesQuery = useJudges(activeHackathon?.id);
  const projectsQuery = useProjects(activeHackathon?.id);
  const assignmentsQuery = useAssignments(activeHackathon?.id);
  const evaluationsQuery = useEvaluations(activeHackathon?.id);

  const reopenMutation = useReopenEvaluation();
  const recordAudit = useRecordAuditAction();
  const [reopenTarget, setReopenTarget] = React.useState<Evaluation | undefined>();

  const judges = React.useMemo(
    () => (judgesQuery.data ?? []).slice().sort((a, b) => a.name.localeCompare(b.name, "ar")),
    [judgesQuery.data]
  );
  const projects = React.useMemo(
    () => (projectsQuery.data ?? []).slice().sort((a, b) => a.projectNumber - b.projectNumber),
    [projectsQuery.data]
  );
  const assignments = React.useMemo(
    () => assignmentsQuery.data ?? [],
    [assignmentsQuery.data]
  );
  const evaluations = React.useMemo(
    () => evaluationsQuery.data ?? [],
    [evaluationsQuery.data]
  );

  const judgeStats = React.useMemo(
    () => calculateJudgeCompletionStats(assignments),
    [assignments]
  );
  const projectStats = React.useMemo(
    () => calculateProjectCompletionStats(assignments),
    [assignments]
  );

  const submittedEvaluationsByJudge = React.useMemo(() => {
    const map = new Map<string, Evaluation[]>();
    for (const evaluation of evaluations) {
      if (evaluation.status !== EvaluationStatus.Submitted) continue;
      const list = map.get(evaluation.judgeId) ?? [];
      list.push(evaluation);
      map.set(evaluation.judgeId, list);
    }
    return map;
  }, [evaluations]);

  const projectNameById = React.useMemo(
    () => new Map(projects.map((p) => [p.id, p.projectName])),
    [projects]
  );

  const isLoading =
    hackathonsQuery.isLoading ||
    judgesQuery.isLoading ||
    projectsQuery.isLoading ||
    assignmentsQuery.isLoading ||
    evaluationsQuery.isLoading;
  const isError =
    hackathonsQuery.isError ||
    judgesQuery.isError ||
    projectsQuery.isError ||
    assignmentsQuery.isError ||
    evaluationsQuery.isError;

  async function handleReopen() {
    if (!reopenTarget || !activeHackathon || !user) return;
    try {
      await reopenMutation.mutateAsync({
        evaluationId: reopenTarget.id,
        actorUserId: user.id,
      });
      await recordAudit.mutateAsync({
        hackathonId: activeHackathon.id,
        action: AuditAction.EvaluationReopened,
        entityType: "evaluation",
        entityId: reopenTarget.id,
        summary: `${user.name} أعاد فتح تقييم مشروع ${
          projectNameById.get(reopenTarget.projectId) ?? ""
        }`,
      });
      toast.success("تم إعادة فتح التقييم");
      setReopenTarget(undefined);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "حدث خطأ أثناء إعادة الفتح"
      );
    }
  }

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title="متابعة التقييم"
        description="تابع تقدّم المحكمين والمشاريع، وأعد فتح التقييمات عند الحاجة."
      />

      {isError && (
        <ErrorState
          description="تعذّر تحميل بيانات المتابعة."
          onRetry={() => {
            hackathonsQuery.refetch();
            judgesQuery.refetch();
            projectsQuery.refetch();
            assignmentsQuery.refetch();
            evaluationsQuery.refetch();
          }}
        />
      )}

      {isLoading && (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      )}

      {!isLoading && !isError && !activeHackathon && (
        <EmptyState
          icon={ClipboardCheck}
          title="لا توجد هاكاثونات بعد"
          description="أنشئ هاكاثونًا أولًا لمتابعة تقدّم التقييم."
        />
      )}

      {!isLoading && !isError && activeHackathon && (
        <Tabs defaultValue="judges">
          <TabsList>
            <TabsTrigger value="judges">حسب المحكّم</TabsTrigger>
            <TabsTrigger value="projects">حسب المشروع</TabsTrigger>
          </TabsList>

          <TabsContent value="judges">
            {judges.length === 0 ? (
              <EmptyState icon={ClipboardCheck} title="لا يوجد محكّمون بعد" />
            ) : (
              <div className="overflow-hidden rounded-lg border border-border bg-card">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>المحكّم</TableHead>
                      <TableHead>التقدّم</TableHead>
                      <TableHead className="w-40 text-end">إجراءات</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {judges.map((judge) => {
                      const submitted = submittedEvaluationsByJudge.get(judge.id) ?? [];
                      return (
                        <TableRow key={judge.id}>
                          <TableCell className="font-medium text-foreground">
                            {judge.name}
                          </TableCell>
                          <TableCell>
                            <JudgeProgress stats={judgeStats.get(judge.id)} />
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap justify-end gap-1">
                              {submitted.length === 0 ? (
                                <span className="text-sm text-muted-foreground">
                                  لا توجد تقييمات مُرسلة
                                </span>
                              ) : (
                                submitted.map((evaluation) => (
                                  <Button
                                    key={evaluation.id}
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setReopenTarget(evaluation)}
                                    title={`إعادة فتح تقييم ${
                                      projectNameById.get(evaluation.projectId) ?? ""
                                    }`}
                                  >
                                    <RotateCcw className="size-3.5" />
                                    {projectNameById.get(evaluation.projectId) ?? "مشروع"}
                                  </Button>
                                ))
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>

          <TabsContent value="projects">
            {projects.length === 0 ? (
              <EmptyState icon={ClipboardCheck} title="لا توجد مشاريع بعد" />
            ) : (
              <div className="overflow-hidden rounded-lg border border-border bg-card">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-16">الرقم</TableHead>
                      <TableHead>المشروع</TableHead>
                      <TableHead>حالة التقييم</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {projects.map((project) => (
                      <TableRow key={project.id}>
                        <TableCell className="tabular-nums">
                          {project.projectNumber}
                        </TableCell>
                        <TableCell className="font-medium text-foreground">
                          {project.projectName}
                        </TableCell>
                        <TableCell>
                          <ProjectCompletionBadge stats={projectStats.get(project.id)} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>
        </Tabs>
      )}

      <ConfirmDialog
        open={Boolean(reopenTarget)}
        onOpenChange={(open) => !open && setReopenTarget(undefined)}
        title="إعادة فتح التقييم"
        description={
          reopenTarget
            ? `سيتمكن المحكّم من تعديل تقييم مشروع "${
                projectNameById.get(reopenTarget.projectId) ?? ""
              }" وإعادة إرساله.`
            : undefined
        }
        confirmLabel="إعادة الفتح"
        isLoading={reopenMutation.isPending}
        onConfirm={handleReopen}
      />
    </div>
  );
}
