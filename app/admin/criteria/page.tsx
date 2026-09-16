"use client";

import * as React from "react";
import { Plus, Pencil, Trash2, ListChecks, AlertTriangle } from "lucide-react";
import { useHackathons } from "@/lib/queries/use-hackathons";
import { useCriteria, useDeleteCriterion } from "@/lib/queries/use-criteria";
import { validateCriteriaWeights, type Criterion } from "@/lib/domain/criterion";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/layout/empty-state";
import { ErrorState } from "@/components/layout/error-state";
import { ConfirmDialog } from "@/components/layout/confirm-dialog";
import { CriterionFormDialog } from "@/components/criteria/criterion-form-dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";

export default function CriteriaPage() {
  const hackathonsQuery = useHackathons();
  const activeHackathon = hackathonsQuery.data?.[0];

  const criteriaQuery = useCriteria(activeHackathon?.id);
  const deleteMutation = useDeleteCriterion();

  const [formOpen, setFormOpen] = React.useState(false);
  const [editingCriterion, setEditingCriterion] = React.useState<Criterion | undefined>();
  const [deletingCriterion, setDeletingCriterion] = React.useState<Criterion | undefined>();

  const criteria = React.useMemo(
    () => (criteriaQuery.data ?? []).slice().sort((a, b) => a.order - b.order),
    [criteriaQuery.data]
  );

  const weightValidation = React.useMemo(
    () => validateCriteriaWeights(criteria),
    [criteria]
  );

  const isLoading = hackathonsQuery.isLoading || criteriaQuery.isLoading;
  const isError = hackathonsQuery.isError || criteriaQuery.isError;

  function openCreate() {
    setEditingCriterion(undefined);
    setFormOpen(true);
  }

  function openEdit(criterion: Criterion) {
    setEditingCriterion(criterion);
    setFormOpen(true);
  }

  async function handleDelete() {
    if (!deletingCriterion || !activeHackathon) return;
    try {
      await deleteMutation.mutateAsync({
        id: deletingCriterion.id,
        hackathonId: activeHackathon.id,
      });
      toast.success("تم حذف المعيار بنجاح");
      setDeletingCriterion(undefined);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "حدث خطأ أثناء الحذف"
      );
    }
  }

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="معايير التقييم"
        description="عرّف معايير التقييم وأوزانها؛ يجب أن يساوي مجموع الأوزان 100%."
        actions={
          activeHackathon && (
            <Button onClick={openCreate}>
              <Plus />
              معيار جديد
            </Button>
          )
        }
      />

      {isError && (
        <ErrorState
          description="تعذّر تحميل معايير التقييم."
          onRetry={() => {
            hackathonsQuery.refetch();
            criteriaQuery.refetch();
          }}
        />
      )}

      {isLoading && (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      )}

      {!isLoading && !isError && !activeHackathon && (
        <EmptyState
          icon={ListChecks}
          title="لا توجد هاكاثونات بعد"
          description="أنشئ هاكاثونًا أولًا لتتمكن من تعريف معايير التقييم."
        />
      )}

      {!isLoading && !isError && activeHackathon && (
        <>
          {criteria.length > 0 && !weightValidation.isValid && (
            <Alert variant="destructive" className="mb-4">
              <AlertTriangle />
              <AlertTitle>مجموع الأوزان غير صحيح</AlertTitle>
              <AlertDescription>{weightValidation.message}</AlertDescription>
            </Alert>
          )}

          {criteria.length === 0 ? (
            <EmptyState
              icon={ListChecks}
              title="لا توجد معايير تقييم بعد"
              description="أضف أول معيار لتبدأ بتوزيع أوزان التقييم."
              action={
                <Button onClick={openCreate}>
                  <Plus />
                  إضافة معيار
                </Button>
              }
            />
          ) : (
            <div className="overflow-hidden rounded-lg border border-border bg-card">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>المعيار</TableHead>
                    <TableHead>الوصف</TableHead>
                    <TableHead>الوزن</TableHead>
                    <TableHead>الدرجة القصوى</TableHead>
                    <TableHead className="w-24 text-end">إجراءات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {criteria.map((criterion) => (
                    <TableRow key={criterion.id}>
                      <TableCell className="font-medium text-foreground">
                        {criterion.name}
                      </TableCell>
                      <TableCell className="max-w-xs truncate text-muted-foreground">
                        {criterion.description || "—"}
                      </TableCell>
                      <TableCell className="tabular-nums">
                        {criterion.weight}%
                      </TableCell>
                      <TableCell className="tabular-nums">
                        {criterion.maxScore}
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label="تعديل"
                            onClick={() => openEdit(criterion)}
                          >
                            <Pencil className="size-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label="حذف"
                            onClick={() => setDeletingCriterion(criterion)}
                          >
                            <Trash2 className="size-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          <CriterionFormDialog
            open={formOpen}
            onOpenChange={setFormOpen}
            hackathonId={activeHackathon.id}
            nextOrder={criteria.length}
            criterion={editingCriterion}
          />

          <ConfirmDialog
            open={Boolean(deletingCriterion)}
            onOpenChange={(open) => !open && setDeletingCriterion(undefined)}
            title="حذف المعيار"
            description={
              deletingCriterion
                ? `هل أنت متأكد من حذف معيار "${deletingCriterion.name}"؟ لا يمكن التراجع عن هذا الإجراء.`
                : undefined
            }
            variant="destructive"
            confirmLabel="حذف"
            isLoading={deleteMutation.isPending}
            onConfirm={handleDelete}
          />
        </>
      )}
    </div>
  );
}
