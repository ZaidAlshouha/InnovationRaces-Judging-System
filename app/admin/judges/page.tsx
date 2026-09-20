"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Plus, Search, Users } from "lucide-react";
import { useHackathons } from "@/lib/queries/use-hackathons";
import {
  useJudges,
  useUpdateJudge,
  useJudgeActivationStatus,
} from "@/lib/queries/use-judges";
import { useAssignments } from "@/lib/queries/use-assignments";
import { useRecordAuditAction } from "@/lib/queries/use-audit-log";
import {
  calculateJudgeCompletionStats,
  type EntityCompletionStats,
} from "@/lib/scoring/completion-stats";
import { JudgeStatus, type Judge } from "@/lib/domain/judge";
import { AuditAction } from "@/lib/domain/audit-log";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/layout/empty-state";
import { ErrorState } from "@/components/layout/error-state";
import { ConfirmDialog } from "@/components/layout/confirm-dialog";
import { InviteJudgeDialog } from "@/components/judges/invite-judge-dialog";
import { JudgeStatusBadge } from "@/components/judges/judge-status-badge";
import { JudgeAccountStateBadge } from "@/components/judges/judge-account-state-badge";
import { JudgeProgress } from "@/components/judges/judge-progress";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDateTimeAr } from "@/lib/format/dates";
import { useLocale, useTranslations } from "@/lib/i18n/locale-context";

type StatusFilter = "all" | typeof JudgeStatus.Active | typeof JudgeStatus.Inactive;

export default function JudgesPage() {
  const t = useTranslations();
  const { locale } = useLocale();
  const hackathonsQuery = useHackathons();

  // `undefined` until explicitly chosen — the Select below is only ever
  // rendered once hackathons.length > 0 (see the JSX gate further down),
  // and defaults its OWN displayed value to the first hackathon via the
  // `value={selectedHackathonId ?? hackathons[0]?.id}` fallback rather than
  // an effect-driven setState, so the Select's `value` prop is never
  // `undefined` at first render once it actually mounts — avoiding the
  // uncontrolled-to-controlled flip Base UI's Select warns about (a real
  // console error caught during manual verification of this page: the
  // previous effect-based "set the default after mount" approach set state
  // one render late, after the Select had already mounted uncontrolled).
  const [selectedHackathonId, setSelectedHackathonId] = React.useState<
    string | undefined
  >(undefined);

  const hackathons = hackathonsQuery.data ?? [];
  // The id the rest of this page actually uses — the user's explicit
  // choice once they've made one, otherwise the first hackathon in the
  // list (matches the page's previous single-hackathon default behavior).
  // Computed directly from render-time data rather than via an effect, so
  // it is never `undefined` once `hackathons` is non-empty — see
  // `selectedHackathonId`'s own comment above for why this matters.
  const effectiveHackathonId = selectedHackathonId ?? hackathons[0]?.id;

  const judgesQuery = useJudges(effectiveHackathonId);
  const assignmentsQuery = useAssignments(effectiveHackathonId);

  const [search, setSearch] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<StatusFilter>("all");
  const [inviteOpen, setInviteOpen] = React.useState(false);

  const judges = React.useMemo(() => judgesQuery.data ?? [], [judgesQuery.data]);
  const completionStats = React.useMemo(
    () => calculateJudgeCompletionStats(assignmentsQuery.data ?? []),
    [assignmentsQuery.data]
  );

  const filteredJudges = React.useMemo(() => {
    const query = search.trim().toLowerCase();
    return judges
      .filter((j) => {
        const matchesSearch =
          !query ||
          j.name.toLowerCase().includes(query) ||
          j.email.toLowerCase().includes(query);
        const matchesStatus = statusFilter === "all" || j.status === statusFilter;
        return matchesSearch && matchesStatus;
      })
      .sort((a, b) => a.name.localeCompare(b.name, locale));
  }, [judges, search, statusFilter, locale]);

  // Only ever asks about judges actually linked to an Auth account (userId
  // set) — a judge with no userId at all is already unambiguously pending,
  // no lookup needed (see deriveJudgeAccountState's own short-circuit).
  const linkedUserIds = React.useMemo(
    () =>
      filteredJudges
        .map((j) => j.userId)
        .filter((id): id is string => Boolean(id)),
    [filteredJudges]
  );
  const activationStatusQuery = useJudgeActivationStatus(linkedUserIds);

  const isError = hackathonsQuery.isError || judgesQuery.isError;
  const selectedHackathon = hackathons.find((h) => h.id === effectiveHackathonId);

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title={t("judging.judgesPageTitle")}
        description={t("judging.judgesPageDescription")}
        actions={
          effectiveHackathonId && (
            <Button onClick={() => setInviteOpen(true)}>
              <Plus />
              {t("judging.newJudge")}
            </Button>
          )
        }
      />

      {isError && (
        <ErrorState
          description={t("judging.loadJudgesError")}
          onRetry={() => {
            hackathonsQuery.refetch();
            judgesQuery.refetch();
          }}
        />
      )}

      {hackathonsQuery.isLoading && (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      )}

      {!hackathonsQuery.isLoading && !isError && hackathons.length === 0 && (
        <EmptyState
          icon={Users}
          title={t("judging.noHackathonsTitle")}
          description={t("judging.noHackathonsForJudgesDescription")}
        />
      )}

      {!hackathonsQuery.isLoading && !isError && hackathons.length > 0 && (
        <>
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Select
              value={effectiveHackathonId}
              onValueChange={(v) => setSelectedHackathonId(v ?? undefined)}
            >
              <SelectTrigger className="w-full sm:w-56" aria-label={t("judging.hackathonFilterLabel")}>
                {/* Explicit render-prop label lookup, not the default
                    auto-lookup-from-SelectItem behavior — the value here is
                    set programmatically (defaults to the first hackathon
                    before the user ever opens the menu), which the default
                    lookup does not reliably resolve to a label on first
                    render (shows the raw id instead); see
                    node_modules/@base-ui/react/select/value/SelectValue.d.ts's
                    own documented `children` function prop for this exact
                    case. */}
                <SelectValue placeholder={t("judging.hackathonFilterPlaceholder")}>
                  {(value: string | null) =>
                    hackathons.find((h) => h.id === value)?.name ??
                    t("judging.hackathonFilterPlaceholder")
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {hackathons.map((h) => (
                  <SelectItem key={h.id} value={h.id}>
                    {h.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="relative flex-1">
              <Search className="pointer-events-none absolute top-1/2 start-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t("judging.searchJudgesPlaceholder")}
                className="ps-8"
                aria-label={t("judging.searchJudgesAriaLabel")}
              />
            </div>
            <Select
              value={statusFilter}
              onValueChange={(v) => setStatusFilter((v as StatusFilter) ?? "all")}
            >
              <SelectTrigger className="w-full sm:w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("judging.allStatuses")}</SelectItem>
                <SelectItem value={JudgeStatus.Active}>{t("judging.active")}</SelectItem>
                <SelectItem value={JudgeStatus.Inactive}>{t("judging.inactive")}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {judgesQuery.isLoading && (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          )}

          {judgesQuery.isSuccess && filteredJudges.length === 0 && (
            <EmptyState
              icon={Users}
              title={t("judging.noMatchingJudgesTitle")}
              description={t("judging.noMatchingJudgesDescription")}
            />
          )}

          {judgesQuery.isSuccess && filteredJudges.length > 0 && (
            <div className="overflow-x-auto rounded-lg border border-border bg-card">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("judging.columnName")}</TableHead>
                    <TableHead>{t("judging.columnEmail")}</TableHead>
                    <TableHead>{t("judging.columnHackathon")}</TableHead>
                    <TableHead>{t("judging.columnStatus")}</TableHead>
                    <TableHead>{t("judging.columnInvitation")}</TableHead>
                    <TableHead>{t("judging.columnProgress")}</TableHead>
                    <TableHead>{t("judging.columnCreatedAt")}</TableHead>
                    <TableHead className="text-end">{t("judging.columnActions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredJudges.map((judge) => (
                    <JudgeRow
                      key={judge.id}
                      judge={judge}
                      hackathonName={selectedHackathon?.name ?? "—"}
                      stats={completionStats.get(judge.id)}
                      activated={
                        judge.userId
                          ? activationStatusQuery.data?.[judge.userId]
                          : undefined
                      }
                    />
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {effectiveHackathonId && (
            <InviteJudgeDialog
              open={inviteOpen}
              onOpenChange={setInviteOpen}
              hackathonId={effectiveHackathonId}
            />
          )}
        </>
      )}
    </div>
  );
}

function JudgeRow({
  judge,
  hackathonName,
  stats,
  activated,
}: {
  judge: Judge;
  hackathonName: string;
  stats: EntityCompletionStats | undefined;
  activated?: boolean;
}) {
  const t = useTranslations();
  const updateMutation = useUpdateJudge();
  const recordAudit = useRecordAuditAction();
  const [confirmAction, setConfirmAction] = React.useState<"disable" | "enable" | null>(
    null
  );

  const isActive = judge.status === JudgeStatus.Active;

  async function handleToggleStatus() {
    const nextStatus = isActive ? JudgeStatus.Inactive : JudgeStatus.Active;
    try {
      await updateMutation.mutateAsync({ id: judge.id, status: nextStatus });
      await recordAudit.mutateAsync({
        hackathonId: judge.hackathonId,
        action: isActive ? AuditAction.JudgeDisabled : AuditAction.JudgeEnabled,
        entityType: "judge",
        entityId: judge.id,
        summary: isActive
          ? `تم تعطيل حساب المحكّم ${judge.name}`
          : `تم تفعيل حساب المحكّم ${judge.name}`,
      });
      toast.success(
        isActive ? t("judging.judgeDisabledToast") : t("judging.judgeEnabledToast")
      );
      setConfirmAction(null);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t("judging.genericSaveError")
      );
    }
  }

  return (
    <>
      <TableRow>
        <TableCell>
          <Link
            href={`/admin/judges/${judge.id}`}
            className="font-medium text-foreground hover:text-primary hover:underline"
          >
            {judge.name}
          </Link>
        </TableCell>
        <TableCell dir="ltr" className="text-start text-muted-foreground">
          {judge.email}
        </TableCell>
        <TableCell className="text-muted-foreground">{hackathonName}</TableCell>
        <TableCell>
          <JudgeStatusBadge status={judge.status} />
        </TableCell>
        <TableCell>
          <JudgeAccountStateBadge judge={judge} activated={activated} />
        </TableCell>
        <TableCell>
          <JudgeProgress stats={stats} />
        </TableCell>
        <TableCell className="text-muted-foreground">
          {formatDateTimeAr(judge.createdAt)}
        </TableCell>
        <TableCell className="text-end">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setConfirmAction(isActive ? "disable" : "enable")}
          >
            {isActive ? t("judging.disableAction") : t("judging.enableAction")}
          </Button>
        </TableCell>
      </TableRow>

      <ConfirmDialog
        open={confirmAction !== null}
        onOpenChange={(open) => !open && setConfirmAction(null)}
        title={
          confirmAction === "disable"
            ? t("judging.disableJudgeDialogTitle")
            : t("judging.enableJudgeDialogTitle")
        }
        description={
          confirmAction === "disable"
            ? t("judging.disableJudgeDialogDescription")
            : t("judging.enableJudgeDialogDescription")
        }
        confirmLabel={
          confirmAction === "disable"
            ? t("judging.disableAction")
            : t("judging.enableAction")
        }
        variant={confirmAction === "disable" ? "destructive" : "default"}
        isLoading={updateMutation.isPending}
        onConfirm={handleToggleStatus}
      />
    </>
  );
}
