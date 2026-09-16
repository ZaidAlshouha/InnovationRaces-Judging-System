"use client";

import * as React from "react";
import Link from "next/link";
import { Settings as SettingsIcon, Info } from "lucide-react";
import { useHackathons } from "@/lib/queries/use-hackathons";
import { useAuth } from "@/lib/auth/auth-context";
import { HackathonStatusBadge } from "@/components/hackathons/hackathon-status-badge";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/layout/empty-state";
import { ErrorState } from "@/components/layout/error-state";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { formatDateRangeAr } from "@/lib/format/dates";

export default function SettingsPage() {
  const { user } = useAuth();
  const hackathonsQuery = useHackathons();
  const activeHackathon = hackathonsQuery.data?.[0];

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader
        title="الإعدادات"
        description="معلومات الحساب والهاكاثون الحالي."
      />

      <Alert>
        <Info />
        <AlertTitle>وضع البيانات التجريبية</AlertTitle>
        <AlertDescription>
          يعمل النظام حاليًا على بيانات وهمية محلية لأغراض العرض التوضيحي؛
          لا توجد إعدادات عامة قابلة للتخصيص بعد لأنها ستُدار من خلال Supabase
          بعد الربط (راجع docs/migration-plan.md).
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle>الحساب</CardTitle>
          <CardDescription>معلومات المستخدم الحالي</CardDescription>
        </CardHeader>
        <CardContent className="space-y-1 text-sm">
          <p className="text-foreground">{user?.name}</p>
          <p dir="ltr" className="text-start text-muted-foreground">
            {user?.email}
          </p>
        </CardContent>
      </Card>

      {hackathonsQuery.isError && (
        <ErrorState
          description="تعذّر تحميل بيانات الهاكاثون."
          onRetry={() => hackathonsQuery.refetch()}
        />
      )}

      {hackathonsQuery.isLoading && <Skeleton className="h-32 w-full" />}

      {hackathonsQuery.isSuccess && !activeHackathon && (
        <EmptyState
          icon={SettingsIcon}
          title="لا توجد هاكاثونات بعد"
          description="أنشئ هاكاثونًا من صفحة الهاكاثونات لعرض إعداداته هنا."
        />
      )}

      {activeHackathon && (
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <div>
              <CardTitle>{activeHackathon.name}</CardTitle>
              <CardDescription>
                {formatDateRangeAr(activeHackathon.startDate, activeHackathon.endDate)}
              </CardDescription>
            </div>
            <HackathonStatusBadge status={activeHackathon.status} />
          </CardHeader>
          <CardContent>
            <Button
              variant="outline"
              render={<Link href={`/admin/hackathons/${activeHackathon.id}`} />}
            >
              إدارة تفاصيل الهاكاثون
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
