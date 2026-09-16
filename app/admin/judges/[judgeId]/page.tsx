"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowRight, Pencil } from "lucide-react";
import { useJudge } from "@/lib/queries/use-judges";
import { useJudgeAssignmentsWithProjects } from "@/lib/queries/use-judge-assignments";
import { AssignmentStatus, ASSIGNMENT_STATUS_LABELS_AR } from "@/lib/domain/assignment";
import { PageHeader } from "@/components/layout/page-header";
import { ErrorState } from "@/components/layout/error-state";
import { EmptyState } from "@/components/layout/empty-state";
import { JudgeFormDialog } from "@/components/judges/judge-form-dialog";
import { JudgeStatusBadge } from "@/components/judges/judge-status-badge";
import { JudgeProgress } from "@/components/judges/judge-progress";
import { calculateJudgeCompletionStats } from "@/lib/scoring/completion-stats";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { ClipboardList } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default function JudgeDetailPage() {
  const params = useParams<{ judgeId: string }>();
  const judgeQuery = useJudge(params.judgeId);
  const assignmentsQuery = useJudgeAssignmentsWithProjects(params.judgeId);
  const [editOpen, setEditOpen] = React.useState(false);

  const stats = React.useMemo(
    () =>
      calculateJudgeCompletionStats(
        (assignmentsQuery.data ?? []).map((a) => a.assignment)
      ),
    [assignmentsQuery.data]
  );

  if (judgeQuery.isLoading) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (judgeQuery.isError) {
    return (
      <div className="mx-auto max-w-3xl">
        <ErrorState
          description="تعذّر تحميل بيانات المحكّم."
          onRetry={() => judgeQuery.refetch()}
        />
      </div>
    );
  }

  const judge = judgeQuery.data;

  if (!judge) {
    return (
      <div className="mx-auto max-w-3xl">
        <ErrorState title="المحكّم غير موجود" />
      </div>
    );
  }

  const rows = assignmentsQuery.data ?? [];
  const judgeStats = stats.get(judge.id);

  return (
    <div className="mx-auto max-w-3xl">
      <Link
        href="/admin/judges"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowRight className="size-4 rtl:rotate-180" />
        العودة إلى المحكمين
      </Link>

      <PageHeader
        title={judge.name}
        description={judge.email}
        actions={
          <Button variant="outline" onClick={() => setEditOpen(true)}>
            <Pencil />
            تعديل
          </Button>
        }
      />

      <Card className="mb-6">
        <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <JudgeStatusBadge status={judge.status} />
          <JudgeProgress stats={judgeStats} />
        </CardContent>
      </Card>

      <h2 className="mb-3 text-sm font-medium text-foreground">
        المشاريع المُسندة
      </h2>

      {assignmentsQuery.isLoading && <Skeleton className="h-40 w-full" />}

      {assignmentsQuery.isSuccess && rows.length === 0 && (
        <EmptyState
          icon={ClipboardList}
          title="لم يتم تعيين مشاريع لهذا المحكّم"
          description="استخدم صفحة توزيع المحكمين لإسناد مشاريع له."
        />
      )}

      {assignmentsQuery.isSuccess && rows.length > 0 && (
        <div className="overflow-hidden rounded-lg border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">الرقم</TableHead>
                <TableHead>الفريق</TableHead>
                <TableHead>المشروع</TableHead>
                <TableHead>الحالة</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map(({ assignment, project }) => (
                <TableRow key={assignment.id}>
                  <TableCell className="tabular-nums">
                    {project?.projectNumber ?? "—"}
                  </TableCell>
                  <TableCell>{project?.teamName ?? "—"}</TableCell>
                  <TableCell>
                    {project ? (
                      <Link
                        href={`/admin/projects/${project.id}`}
                        className="text-foreground hover:text-primary hover:underline"
                      >
                        {project.projectName}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        assignment.status === AssignmentStatus.Completed
                          ? "default"
                          : "secondary"
                      }
                    >
                      {ASSIGNMENT_STATUS_LABELS_AR[assignment.status]}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <JudgeFormDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        hackathonId={judge.hackathonId}
        judge={judge}
      />
    </div>
  );
}
