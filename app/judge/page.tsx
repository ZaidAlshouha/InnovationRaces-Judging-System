"use client";

import * as React from "react";
import Link from "next/link";
import { ClipboardList, ExternalLink } from "lucide-react";
import { useAuth } from "@/lib/auth/auth-context";
import { useJudgeAssignmentsWithProjects } from "@/lib/queries/use-judge-assignments";
import { AssignmentStatus, ASSIGNMENT_STATUS_LABELS_AR } from "@/lib/domain/assignment";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/layout/empty-state";
import { ErrorState } from "@/components/layout/error-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const STATUS_VARIANT: Record<
  (typeof AssignmentStatus)[keyof typeof AssignmentStatus],
  "default" | "secondary" | "outline"
> = {
  [AssignmentStatus.Pending]: "outline",
  [AssignmentStatus.InProgress]: "secondary",
  [AssignmentStatus.Completed]: "default",
};

export default function JudgeAssignmentsPage() {
  const { user } = useAuth();
  const assignmentsQuery = useJudgeAssignmentsWithProjects(user?.judgeId);

  const rows = React.useMemo(
    () => assignmentsQuery.data ?? [],
    [assignmentsQuery.data]
  );

  const completedCount = rows.filter(
    (r) => r.assignment.status === AssignmentStatus.Completed
  ).length;

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="مشاريعي المُسندة"
        description={
          rows.length > 0
            ? `أكملت ${completedCount} من ${rows.length} تقييمًا.`
            : undefined
        }
      />

      {assignmentsQuery.isError && (
        <ErrorState
          description="تعذّر تحميل قائمة المشاريع المُسندة إليك."
          onRetry={() => assignmentsQuery.refetch()}
        />
      )}

      {assignmentsQuery.isLoading && (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      )}

      {assignmentsQuery.isSuccess && rows.length === 0 && (
        <EmptyState
          icon={ClipboardList}
          title="لا توجد مشاريع مُسندة إليك بعد"
          description="سيقوم المسؤول بتوزيع المشاريع عليك قريبًا."
        />
      )}

      {assignmentsQuery.isSuccess && rows.length > 0 && (
        <div className="space-y-3">
          {rows.map(({ assignment, project }) => (
            <Card key={assignment.id}>
              <CardHeader className="flex-row items-start justify-between">
                <div>
                  <CardTitle>
                    {project ? project.projectName : "مشروع غير معروف"}
                  </CardTitle>
                  {project && (
                    <p className="mt-1 text-sm text-muted-foreground">
                      فريق {project.teamName} — مشروع رقم {project.projectNumber}
                    </p>
                  )}
                </div>
                <Badge variant={STATUS_VARIANT[assignment.status]}>
                  {ASSIGNMENT_STATUS_LABELS_AR[assignment.status]}
                </Badge>
              </CardHeader>
              <CardContent className="flex flex-wrap items-center justify-between gap-3">
                {project?.projectUrl && (
                  <a
                    href={project.projectUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
                  >
                    <ExternalLink className="size-4" />
                    رابط المشروع
                  </a>
                )}
                <Button
                  render={<Link href={`/judge/evaluate/${assignment.id}`} />}
                  variant={
                    assignment.status === AssignmentStatus.Completed
                      ? "outline"
                      : "default"
                  }
                  className="ms-auto"
                >
                  {assignment.status === AssignmentStatus.Completed
                    ? "عرض التقييم"
                    : "بدء التقييم"}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
