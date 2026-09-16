"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth/auth-context";
import { UserRole } from "@/lib/domain/user";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const loginSchema = z.object({
  email: z.string().email("بريد إلكتروني غير صالح"),
  password: z.string().min(1, "كلمة المرور مطلوبة"),
});

type LoginValues = z.infer<typeof loginSchema>;

const ROLE_HOME: Record<UserRole, string> = {
  [UserRole.Admin]: "/admin/dashboard",
  [UserRole.Judge]: "/judge",
};

export default function LoginPage() {
  const router = useRouter();
  const { signIn } = useAuth();

  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const [isSubmitting, setIsSubmitting] = React.useState(false);

  async function onSubmit(values: LoginValues) {
    setIsSubmitting(true);
    try {
      const user = await signIn(values.email, values.password);
      if (!user) {
        form.setError("email", {
          message: "لم يتم العثور على حساب بهذا البريد الإلكتروني",
        });
        return;
      }
      toast.success(`مرحبًا، ${user.name}`);
      router.replace(ROLE_HOME[user.role]);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "حدث خطأ أثناء تسجيل الدخول"
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>تسجيل الدخول</CardTitle>
          <CardDescription>
            أدخل بريدك الإلكتروني وكلمة المرور للوصول إلى InnovationRaces.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(onSubmit)}
              className="flex flex-col gap-4"
            >
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>البريد الإلكتروني</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        dir="ltr"
                        placeholder="name@example.com"
                        autoComplete="email"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>كلمة المرور</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        dir="ltr"
                        autoComplete="current-password"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button type="submit" disabled={isSubmitting} className="mt-2">
                {isSubmitting ? "جارٍ الدخول..." : "دخول"}
              </Button>

              <p className="text-center text-xs leading-6 text-muted-foreground">
                للتجربة: admin@innovationraces.demo (مسؤول) أو
                judge@innovationraces.demo (محكّم) — أي كلمة مرور.
              </p>
            </form>
          </Form>
        </CardContent>
      </Card>
    </main>
  );
}
