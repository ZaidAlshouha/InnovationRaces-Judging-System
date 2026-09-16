"use client";

import { Trophy, FolderKanban, Users, ClipboardCheck, CircleCheck, Clock } from "lucide-react";
import { useHackathons } from "@/lib/queries/use-hackathons";
import { useProjects } from "@/lib/queries/use-projects";
import { useJudges } from "@/lib/queries/use-judges";
import { useAssignments } from "@/lib/queries/use-assignments";
import { calculateHackathonCompletionSummary } from "@/lib/scoring/completion-stats";
import { JudgeStatus } from "@/lib/domain/judge";
import { HACKATHON_STATUS_LABELS_AR } from "@/lib/domain/hackathon";
import { PageHeader } from "@/components/layout/page-header";
import { ErrorState } from "@/components/layout/error-state";
import { EmptyState } from "@/components/layout/empty-state";
import { StatCard } from "@/components/dashboard/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Progress,
  ProgressLabel,
  ProgressTrack,
  ProgressIndicator,
  ProgressValue,
} from "@/components/ui/progress";

export default function DashboardPage() {
  const hackathonsQuery = useHackathons();
  const activeHackathon = hackathonsQuery.data?.[0];

  const projectsQuery = useProjects(activeHackathon?.id);
  const judgesQuery = useJudges(activeHackathon?.id);
  const assignmentsQuery = useAssignments(activeHackathon?.id);

  const isLoading =
    hackathonsQuery.isLoading ||
    projectsQuery.isLoading ||
    judgesQuery.isLoading ||
    assignmentsQuery.isLoading;

  const isError =
    hackathonsQuery.isError ||
    projectsQuery.isError ||
    judgesQuery.isError ||
    assignmentsQuery.isError;

  if (isError) {
    return (
      <div className="mx-auto max-w-5xl">
        <PageHeader title="لوحة التحكم" />
        <ErrorState
          description="تعذّر تحميل بيانات لوحة التحكم، يرجى إعادة المحاولة."
          onRetry={() => {
            hackathonsQuery.refetch();
            projectsQuery.refetch();
            judgesQuery.refetch();
            assignmentsQuery.refetch();
          }}
        />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="mx-auto max-w-5xl">
        <PageHeader title="لوحة التحكم" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      </div>
    );
  }

  if (!activeHackathon) {
    return (
      <div className="mx-auto max-w-5xl">
        <PageHeader title="لوحة التحكم" />
        <EmptyState
          icon={Trophy}
          title="لا توجد هاكاثونات حاليًا"
          description="أنشئ هاكاثونًا جديدًا للبدء في إدارة المشاريع والمحكمين."
        />
      </div>
    );
  }

  const projects = projectsQuery.data ?? [];
  const judges = judgesQuery.data ?? [];
  const activeJudges = judges.filter((j) => j.status === JudgeStatus.Active);
  const assignments = assignmentsQuery.data ?? [];
  const summary = calculateHackathonCompletionSummary(assignments);

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title="لوحة التحكم"
        description="نظرة عامة على حالة التحكيم الحالية."
      />

      <Card className="mb-6">
        <CardHeader className="flex-row items-center justify-between">
          <div>
            <CardTitle>{activeHackathon.name}</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              {activeHackathon.description}
            </p>
          </div>
          <Badge variant="secondary">
            {HACKATHON_STATUS_LABELS_AR[activeHackathon.status]}
          </Badge>
        </CardHeader>
        <CardContent>
          <Progress value={summary.completionPercentage}>
            <div className="mb-2 flex w-full items-center justify-between">
              <ProgressLabel>نسبة الإنجاز الإجمالية</ProgressLabel>
              <ProgressValue />
            </div>
            <ProgressTrack>
              <ProgressIndicator />
            </ProgressTrack>
          </Progress>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard label="المشاريع" value={projects.length} icon={FolderKanban} />
        <StatCard label="المحكمون النشطون" value={activeJudges.length} icon={Users} />
        <StatCard
          label="التقييمات المطلوبة"
          value={summary.requiredEvaluations}
          icon={ClipboardCheck}
        />
        <StatCard
          label="التقييمات المكتملة"
          value={summary.completedEvaluations}
          icon={CircleCheck}
          tone="success"
        />
        <StatCard
          label="التقييمات المتبقية"
          value={summary.remainingEvaluations}
          icon={Clock}
          tone="warning"
        />
        <StatCard
          label="نسبة الإنجاز"
          value={`${summary.completionPercentage}%`}
          icon={Trophy}
        />
      </div>
    </div>
  );
}
