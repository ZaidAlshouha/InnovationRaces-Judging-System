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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  createHackathonInputSchema,
  updateHackathonInputSchema,
  HackathonStatus,
  HACKATHON_STATUS_LABELS_AR,
  type Hackathon,
  type CreateHackathonInput,
} from "@/lib/domain/hackathon";
import { AuditAction } from "@/lib/domain/audit-log";
import {
  useCreateHackathon,
  useUpdateHackathon,
} from "@/lib/queries/use-hackathons";
import { useRecordAuditAction } from "@/lib/queries/use-audit-log";

interface HackathonFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  hackathon?: Hackathon;
}

/**
 * `status` carries a Zod `.default()`, which makes it optional in
 * `CreateHackathonInput`. The form always supplies it explicitly (see
 * `defaultValues` below), so it is narrowed back to required here to keep
 * `useForm`'s generic aligned with what the UI actually provides.
 */
type HackathonFormValues = Omit<CreateHackathonInput, "status"> & {
  status: Hackathon["status"];
};

export function HackathonFormDialog({
  open,
  onOpenChange,
  hackathon,
}: HackathonFormDialogProps) {
  const isEditing = Boolean(hackathon);
  const createMutation = useCreateHackathon();
  const updateMutation = useUpdateHackathon();
  const recordAudit = useRecordAuditAction();

  const form = useForm<HackathonFormValues>({
    // `createHackathonInputSchema` types `status` as optional (it has a Zod
    // `.default()`), but this form always supplies it explicitly — cast the
    // resolver to match the narrowed `HackathonFormValues` used here.
    resolver: zodResolver(createHackathonInputSchema) as unknown as Resolver<
      HackathonFormValues
    >,
    defaultValues: {
      name: hackathon?.name ?? "",
      description: hackathon?.description ?? "",
      startDate: hackathon?.startDate ?? "",
      endDate: hackathon?.endDate ?? "",
      status: hackathon?.status ?? HackathonStatus.Draft,
    },
  });

  React.useEffect(() => {
    if (open) {
      form.reset({
        name: hackathon?.name ?? "",
        description: hackathon?.description ?? "",
        startDate: hackathon?.startDate ?? "",
        endDate: hackathon?.endDate ?? "",
        status: hackathon?.status ?? HackathonStatus.Draft,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, hackathon]);

  async function onSubmit(values: HackathonFormValues) {
    try {
      if (isEditing && hackathon) {
        const parsed = updateHackathonInputSchema.parse({
          ...values,
          id: hackathon.id,
        });
        const updated = await updateMutation.mutateAsync(parsed);
        await recordAudit.mutateAsync({
          hackathonId: updated.id,
          action: AuditAction.HackathonUpdated,
          entityType: "hackathon",
          entityId: updated.id,
          summary: `تم تعديل بيانات هاكاثون ${updated.name}`,
        });
        toast.success("تم تحديث بيانات الهاكاثون بنجاح");
      } else {
        const created = await createMutation.mutateAsync(values);
        await recordAudit.mutateAsync({
          hackathonId: created.id,
          action: AuditAction.HackathonCreated,
          entityType: "hackathon",
          entityId: created.id,
          summary: `تم إنشاء هاكاثون ${created.name}`,
        });
        toast.success("تم إنشاء الهاكاثون بنجاح");
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
            {isEditing ? "تعديل الهاكاثون" : "إنشاء هاكاثون جديد"}
          </DialogTitle>
          <DialogDescription>
            أدخل بيانات الهاكاثون الأساسية. يمكن تعديلها لاحقًا في أي وقت.
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
                  <FormLabel>اسم الهاكاثون</FormLabel>
                  <FormControl>
                    <Input placeholder="مثال: تحدي الابتكار 2026" {...field} />
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
                      placeholder="وصف مختصر عن الهاكاثون وأهدافه"
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
                name="startDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>تاريخ البداية</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="endDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>تاريخ النهاية</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>الحالة</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="اختر الحالة" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {Object.values(HackathonStatus).map((status) => (
                        <SelectItem key={status} value={status}>
                          {HACKATHON_STATUS_LABELS_AR[status]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

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
