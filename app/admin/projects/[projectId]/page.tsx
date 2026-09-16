"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowRight, Pencil, ExternalLink } from "lucide-react";
import { useProject } from "@/lib/queries/use-projects";
import { useAssignments } from "@/lib/queries/use-assignments";
import { calculateProjectCompletionStats } from "@/lib/scoring/completion-stats";
import { PageHeader } from "@/components/layout/page-header";
import { ErrorState } from "@/components/layout/error-state";
import { ProjectFormDialog } from "@/components/projects/project-form-dialog";
import { ProjectCompletionBadge } from "@/components/projects/project-completion-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

export default function ProjectDetailPage() {
  const params = useParams<{ projectId: string }>();
  const projectQuery = useProject(params.projectId);
  const project = projectQuery.data;
  const assignmentsQuery = useAssignments(project?.hackathonId);
  const [editOpen, setEditOpen] = React.useState(false);

  const completionStats = React.useMemo(
    () => calculateProjectCompletionStats(assignmentsQuery.data ?? []),
    [assignmentsQuery.data]
  );

  if (projectQuery.isLoading) {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (projectQuery.isError) {
    return (
      <div className="mx-auto max-w-2xl">
        <ErrorState
          description="تعذّر تحميل بيانات المشروع."
          onRetry={() => projectQuery.refetch()}
        />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="mx-auto max-w-2xl">
        <ErrorState title="المشروع غير موجود" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <Link
        href="/admin/projects"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowRight className="size-4 rtl:rotate-180" />
        العودة إلى المشاريع
      </Link>

      <PageHeader
        title={project.projectName}
        description={`فريق ${project.teamName} — مشروع رقم ${project.projectNumber}`}
        actions={
          <Button variant="outline" onClick={() => setEditOpen(true)}>
            <Pencil />
            تعديل
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {project.category && <Badge variant="outline">{project.category}</Badge>}
        <ProjectCompletionBadge stats={completionStats.get(project.id)} />
      </div>

      <Card className="mb-4">
        <CardContent className="space-y-4">
          {project.description && (
            <div>
              <h2 className="mb-1 text-sm font-medium text-foreground">
                الوصف
              </h2>
              <p className="text-sm leading-7 text-muted-foreground">
                {project.description}
              </p>
            </div>
          )}

          {project.additionalInfo && (
            <div>
              <h2 className="mb-1 text-sm font-medium text-foreground">
                معلومات إضافية
              </h2>
              <p className="text-sm leading-7 text-muted-foreground">
                {project.additionalInfo}
              </p>
            </div>
          )}

          <div className="flex flex-wrap gap-3">
            {project.projectUrl && (
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
            {project.demoUrl && (
              <a
                href={project.demoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
              >
                <ExternalLink className="size-4" />
                رابط العرض التوضيحي
              </a>
            )}
          </div>
        </CardContent>
      </Card>

      <ProjectFormDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        hackathonId={project.hackathonId}
        nextProjectNumber={project.projectNumber}
        project={project}
      />
    </div>
  );
}
