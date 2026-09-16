"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Pencil, FolderKanban, Users, ArrowRight } from "lucide-react";
import { useHackathon } from "@/lib/queries/use-hackathons";
import { useProjects } from "@/lib/queries/use-projects";
import { useJudges } from "@/lib/queries/use-judges";
import { PageHeader } from "@/components/layout/page-header";
import { ErrorState } from "@/components/layout/error-state";
import { HackathonStatusBadge } from "@/components/hackathons/hackathon-status-badge";
import { HackathonFormDialog } from "@/components/hackathons/hackathon-form-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDateRangeAr } from "@/lib/format/dates";

export default function HackathonDetailPage() {
  const params = useParams<{ hackathonId: string }>();
  const hackathonQuery = useHackathon(params.hackathonId);
  const projectsQuery = useProjects(params.hackathonId);
  const judgesQuery = useJudges(params.hackathonId);
  const [editOpen, setEditOpen] = React.useState(false);

  if (hackathonQuery.isLoading) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (hackathonQuery.isError) {
    return (
      <div className="mx-auto max-w-3xl">
        <ErrorState
          description="تعذّر تحميل بيانات الهاكاثون."
          onRetry={() => hackathonQuery.refetch()}
        />
      </div>
    );
  }

  const hackathon = hackathonQuery.data;

  if (!hackathon) {
    return (
      <div className="mx-auto max-w-3xl">
        <ErrorState title="الهاكاثون غير موجود" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl">
      <Link
        href="/admin/hackathons"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowRight className="size-4 rtl:rotate-180" />
        العودة إلى الهاكاثونات
      </Link>

      <PageHeader
        title={hackathon.name}
        actions={
          <Button variant="outline" onClick={() => setEditOpen(true)}>
            <Pencil />
            تعديل
          </Button>
        }
      />

      <Card className="mb-6">
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="text-sm text-muted-foreground">
            {formatDateRangeAr(hackathon.startDate, hackathon.endDate)}
          </CardTitle>
          <HackathonStatusBadge status={hackathon.status} />
        </CardHeader>
        {hackathon.description && (
          <CardContent>
            <p className="text-sm leading-7 text-foreground">
              {hackathon.description}
            </p>
          </CardContent>
        )}
      </Card>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Link href="/admin/projects">
          <Card className="transition-colors hover:bg-muted/40">
            <CardContent className="flex items-center gap-4">
              <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <FolderKanban className="size-5" />
              </div>
              <div>
                <p className="text-2xl font-semibold text-foreground">
                  {projectsQuery.data?.length ?? "—"}
                </p>
                <p className="text-sm text-muted-foreground">المشاريع</p>
              </div>
            </CardContent>
          </Card>
        </Link>
        <Link href="/admin/judges">
          <Card className="transition-colors hover:bg-muted/40">
            <CardContent className="flex items-center gap-4">
              <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Users className="size-5" />
              </div>
              <div>
                <p className="text-2xl font-semibold text-foreground">
                  {judgesQuery.data?.length ?? "—"}
                </p>
                <p className="text-sm text-muted-foreground">المحكمون</p>
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>

      <HackathonFormDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        hackathon={hackathon}
      />
    </div>
  );
}
