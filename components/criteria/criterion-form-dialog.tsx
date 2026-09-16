"use client";

import * as React from "react";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  createCriterionInputSchema,
  updateCriterionInputSchema,
  DEFAULT_MAX_SCORE,
  type Criterion,
  type CreateCriterionInput,
} from "@/lib/domain/criterion";
import { AuditAction } from "@/lib/domain/audit-log";
import {
  useCreateCriterion,
  useUpdateCriterion,
} from "@/lib/queries/use-criteria";
import { useRecordAuditAction } from "@/lib/queries/use-audit-log";

interface CriterionFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  hackathonId: string;
  nextOrder: number;
  criterion?: Criterion;
}

/**
 * `maxScore` and `order` carry Zod `.default()`s, which makes them optional
 * in `CreateCriterionInput`. The form always supplies them explicitly, so
 * they are narrowed back to required here — same pattern as
 * `JudgeFormDialog`.
 */
type CriterionFormValues = Omit<CreateCriterionInput, "maxScore" | "order"> & {
  maxScore: number;
  order: number;
};

export function CriterionFormDialog({
  open,
  onOpenChange,
  hackathonId,
  nextOrder,
  criterion,
}: CriterionFormDialogProps) {
  const isEditing = Boolean(criterion);
  const createMutation = useCreateCriterion();
  const updateMutation = useUpdateCriterion();
  const recordAudit = useRecordAuditAction();

  const defaultValues = React.useMemo<CriterionFormValues>(
    () => ({
      hackathonId,
      name: criterion?.name ?? "",
      description: criterion?.description ?? "",
      weight: criterion?.weight ?? 0,
      maxScore: criterion?.maxScore ?? DEFAULT_MAX_SCORE,
      order: criterion?.order ?? nextOrder,
    }),
    [hackathonId, criterion, nextOrder]
  );

  const form = useForm<CriterionFormValues>({
    resolver: zodResolver(createCriterionInputSchema) as unknown as Resolver<
      CriterionFormValues
    >,
    defaultValues,
  });

  React.useEffect(() => {
    if (open) form.reset(defaultValues);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, defaultValues]);

  async function onSubmit(values: CriterionFormValues) {
    try {
      if (isEditing && criterion) {
        const parsed = updateCriterionInputSchema.parse({
          ...values,
          id: criterion.id,
        });
        const updated = await updateMutation.mutateAsync(parsed);
        await recordAudit.mutateAsync({
          hackathonId: updated.hackathonId,
          action: AuditAction.CriterionUpdated,
          entityType: "criterion",
          entityId: updated.id,
          summary: `تم تعديل معيار ${updated.name}`,
        });
        toast.success("تم تحديث المعيار بنجاح");
      } else {
        const created = await createMutation.mutateAsync(values);
        await recordAudit.mutateAsync({
          hackathonId: created.hackathonId,
          action: AuditAction.CriterionCreated,
          entityType: "criterion",
          entityId: created.id,
          summary: `تمت إضافة معيار ${created.name}`,
        });
        toast.success("تمت إضافة المعيار بنجاح");
      }
      onOpenChange(false);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "حدث خطأ أثناء حفظ البيانات"
      );
    }
  }

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "تعديل المعيار" : "إضافة معيار تقييم جديد"}
          </DialogTitle>
          <DialogDescription>
            مجموع أوزان جميع المعايير يجب أن يساوي 100% حتى تُحتسب النتائج.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="flex flex-col gap-4"
          >
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>اسم المعيار</FormLabel>
                  <FormControl>
                    <Input placeholder="مثال: الابتكار" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>الوصف</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="ما الذي يقيّمه هذا المعيار؟"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="weight"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>الوزن (%)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        step="0.01"
                        {...field}
                        onChange={(e) => field.onChange(Number(e.target.value))}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="maxScore"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>الدرجة القصوى</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={1}
                        {...field}
                        onChange={(e) => field.onChange(Number(e.target.value))}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                إلغاء
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "جارٍ الحفظ..." : "حفظ"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
