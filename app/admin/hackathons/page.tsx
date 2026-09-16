"use client";

import * as React from "react";
import Link from "next/link";
import { Plus, Trophy } from "lucide-react";
import { useHackathons } from "@/lib/queries/use-hackathons";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/layout/empty-state";
import { ErrorState } from "@/components/layout/error-state";
import { HackathonStatusBadge } from "@/components/hackathons/hackathon-status-badge";
import { HackathonFormDialog } from "@/components/hackathons/hackathon-form-dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatDateRangeAr } from "@/lib/format/dates";

export default function HackathonsPage() {
  const hackathonsQuery = useHackathons();
  const [createOpen, setCreateOpen] = React.useState(false);

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title="الهاكاثونات"
        description="إدارة الهاكاثونات وحالاتها."
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus />
            هاكاثون جديد
          </Button>
        }
      />

      {hackathonsQuery.isLoading && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
      )}

      {hackathonsQuery.isError && (
        <ErrorState
          description="تعذّر تحميل قائمة الهاكاثونات."
          onRetry={() => hackathonsQuery.refetch()}
        />
      )}

      {hackathonsQuery.isSuccess && hackathonsQuery.data.length === 0 && (
        <EmptyState
          icon={Trophy}
          title="لا توجد هاكاثونات حاليًا"
          description="ابدأ بإنشاء أول هاكاثون لإدارة مشاريعه ومحكميه."
          action={
            <Button onClick={() => setCreateOpen(true)}>
              <Plus />
              إنشاء هاكاثون
            </Button>
          }
        />
      )}

      {hackathonsQuery.isSuccess && hackathonsQuery.data.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {hackathonsQuery.data.map((hackathon) => (
            <Link key={hackathon.id} href={`/admin/hackathons/${hackathon.id}`}>
              <Card className="h-full transition-colors hover:bg-muted/40">
                <CardHeader className="flex-row items-start justify-between">
                  <CardTitle>{hackathon.name}</CardTitle>
                  <HackathonStatusBadge status={hackathon.status} />
                </CardHeader>
                <CardContent className="space-y-2">
                  {hackathon.description && (
                    <p className="line-clamp-2 text-sm text-muted-foreground">
                      {hackathon.description}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    {formatDateRangeAr(hackathon.startDate, hackathon.endDate)}
                  </p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}

      <HackathonFormDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}
