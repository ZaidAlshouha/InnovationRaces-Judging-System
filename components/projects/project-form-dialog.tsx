"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
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
  createProjectInputSchema,
  updateProjectInputSchema,
  type Project,
  type CreateProjectInput,
} from "@/lib/domain/project";
import { AuditAction } from "@/lib/domain/audit-log";
import { useCreateProject, useUpdateProject } from "@/lib/queries/use-projects";
import { useRecordAuditAction } from "@/lib/queries/use-audit-log";

interface ProjectFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  hackathonId: string;
  nextProjectNumber: number;
  project?: Project;
}

export function ProjectFormDialog({
  open,
  onOpenChange,
  hackathonId,
  nextProjectNumber,
  project,
}: ProjectFormDialogProps) {
  const isEditing = Boolean(project);
  const createMutation = useCreateProject();
  const updateMutation = useUpdateProject();
  const recordAudit = useRecordAuditAction();

  const defaultValues = React.useMemo<CreateProjectInput>(
    () => ({
      hackathonId,
      projectNumber: project?.projectNumber ?? nextProjectNumber,
      teamName: project?.teamName ?? "",
      projectName: project?.projectName ?? "",
      description: project?.description ?? "",
      category: project?.category ?? "",
      projectUrl: project?.projectUrl ?? "",
      demoUrl: project?.demoUrl ?? "",
      additionalInfo: project?.additionalInfo ?? "",
    }),
    [hackathonId, nextProjectNumber, project]
  );

  const form = useForm<CreateProjectInput>({
    resolver: zodResolver(createProjectInputSchema),
    defaultValues,
  });

  React.useEffect(() => {
    if (open) form.reset(defaultValues);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, defaultValues]);

  async function onSubmit(values: CreateProjectInput) {
    try {
      if (isEditing && project) {
        const parsed = updateProjectInputSchema.parse({
          ...values,
          id: project.id,
        });
        const updated = await updateMutation.mutateAsync(parsed);
        await recordAudit.mutateAsync({
          hackathonId: updated.hackathonId,
          action: AuditAction.ProjectUpdated,
          entityType: "project",
          entityId: updated.id,
          summary: `تم تعديل بيانات مشروع ${updated.projectName}`,
        });
        toast.success("تم تحديث بيانات المشروع بنجاح");
      } else {
        const created = await createMutation.mutateAsync(values);
        await recordAudit.mutateAsync({
          hackathonId: created.hackathonId,
          action: AuditAction.ProjectCreated,
          entityType: "project",
          entityId: created.id,
          summary: `تمت إضافة مشروع ${created.projectName}`,
        });
        toast.success("تمت إضافة المشروع بنجاح");
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
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "تعديل المشروع" : "إضافة مشروع جديد"}
          </DialogTitle>
          <DialogDescription>
            رقم المشروع هو المعرّف الثابت الذي يُستخدم لربط التقييمات بهذا
            المشروع تلقائيًا.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="flex flex-col gap-4"
          >
            <div className="grid grid-cols-3 gap-3">
              <FormField
                control={form.control}
                name="projectNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>رقم المشروع</FormLabel>
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
              <FormField
                control={form.control}
                name="category"
                render={({ field }) => (
                  <FormItem className="col-span-2">
                    <FormLabel>الفئة</FormLabel>
                    <FormControl>
                      <Input placeholder="مثال: التعليم" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="teamName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>اسم الفريق</FormLabel>
                  <FormControl>
                    <Input placeholder="مثال: فريق فينيكس" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="projectName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>اسم المشروع</FormLabel>
                  <FormControl>
                    <Input placeholder="مثال: منصة تتبّع الأمراض المزمنة" {...field} />
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
                    <Textarea placeholder="نبذة عن فكرة المشروع" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="projectUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>رابط المشروع</FormLabel>
                    <FormControl>
                      <Input placeholder="https://" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="demoUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>رابط العرض التوضيحي</FormLabel>
                    <FormControl>
                      <Input placeholder="https://" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="additionalInfo"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>معلومات إضافية</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="أي ملاحظات إضافية يحتاجها المحكّمون"
                      {...field}
                    />
                  </FormControl>
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
