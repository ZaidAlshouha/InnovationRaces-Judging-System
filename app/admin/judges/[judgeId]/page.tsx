"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowRight, Pencil } from "lucide-react";
import { useJudge, useJudgeActivationStatus } from "@/lib/queries/use-judges";
import { useJudgeAssignmentsWithProjects } from "@/lib/queries/use-judge-assignments";
import { AssignmentStatus, ASSIGNMENT_STATUS_LABELS_AR, ASSIGNMENT_STATUS_LABELS_EN } from "@/lib/domain/assignment";
import { PageHeader } from "@/components/layout/page-header";
import { ErrorState } from "@/components/layout/error-state";
import { EmptyState } from "@/components/layout/empty-state";
import { JudgeFormDialog } from "@/components/judges/judge-form-dialog";
import { JudgeStatusBadge } from "@/components/judges/judge-status-badge";
import { JudgeAccountStateBadge } from "@/components/judges/judge-account-state-badge";
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
import { useLocale, useTranslations } from "@/lib/i18n/locale-context";
import { pickLabel } from "@/lib/i18n/enum-labels";

export default function JudgeDetailPage() {
  const t = useTranslations();
  const { locale } = useLocale();
  const params = useParams<{ judgeId: string }>();
  const judgeQuery = useJudge(params.judgeId);
  const assignmentsQuery = useJudgeAssignmentsWithProjects(params.judgeId);
  const [editOpen, setEditOpen] = React.useState(false);

  // Called unconditionally (before the loading/error early returns below)
  // per React's rules of hooks — the userId array is simply empty until
  // judgeQuery resolves and has a linked account, which
  // useJudgeActivationStatus already handles (enabled: sortedKey.length > 0).
  const activationUserIds = React.useMemo(
    () => (judgeQuery.data?.userId ? [judgeQuery.data.userId] : []),
    [judgeQuery.data]
  );
  const activationStatusQuery = useJudgeActivationStatus(activationUserIds);

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
          description={t("judging.loadJudgeError")}
          onRetry={() => judgeQuery.refetch()}
        />
      </div>
    );
  }

  const judge = judgeQuery.data;

  if (!judge) {
    return (
      <div className="mx-auto max-w-3xl">
        <ErrorState title={t("judging.judgeNotFound")} />
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
        {t("judging.backToJudges")}
      </Link>

      <PageHeader
        title={judge.name}
        description={judge.email}
        actions={
          <Button variant="outline" onClick={() => setEditOpen(true)}>
            <Pencil />
            {t("judging.editAction")}
          </Button>
        }
      />

      <Card className="mb-6">
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <JudgeStatusBadge status={judge.status} />
              <JudgeAccountStateBadge
                judge={judge}
                activated={judge.userId ? activationStatusQuery.data?.[judge.userId] : undefined}
              />
            </div>
            <JudgeProgress stats={judgeStats} />
          </div>
          {(judge.phone || judge.notes) && (
            <div className="grid grid-cols-1 gap-3 border-t border-border pt-4 sm:grid-cols-2">
              {judge.phone && (
                <div>
                  <p className="text-xs text-muted-foreground">{t("judging.phoneLabel")}</p>
                  <p dir="ltr" className="text-start text-sm text-foreground">
                    {judge.phone}
                  </p>
                </div>
              )}
              {judge.notes && (
                <div>
                  <p className="text-xs text-muted-foreground">{t("judging.notesLabel")}</p>
                  <p className="text-sm text-foreground">{judge.notes}</p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <h2 className="mb-3 text-sm font-medium text-foreground">
        {t("judging.assignedProjectsTitle")}
      </h2>

      {assignmentsQuery.isLoading && <Skeleton className="h-40 w-full" />}

      {assignmentsQuery.isSuccess && rows.length === 0 && (
        <EmptyState
          icon={ClipboardList}
          title={t("judging.noAssignedProjectsTitle")}
          description={t("judging.noAssignedProjectsDescription")}
        />
      )}

      {assignmentsQuery.isSuccess && rows.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">{t("judging.columnNumber")}</TableHead>
                <TableHead>{t("judging.columnTeam")}</TableHead>
                <TableHead>{t("judging.columnProject")}</TableHead>
                <TableHead>{t("judging.columnStatus")}</TableHead>
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
                      {pickLabel(
                        locale,
                        ASSIGNMENT_STATUS_LABELS_AR,
                        ASSIGNMENT_STATUS_LABELS_EN,
                        assignment.status
                      )}
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
