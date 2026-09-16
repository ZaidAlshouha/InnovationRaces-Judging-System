import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background px-6 text-center">
      <div className="space-y-2">
        <p className="text-sm font-medium text-muted-foreground">
          InnovationRaces
        </p>
        <h1 className="text-2xl font-semibold text-foreground sm:text-3xl">
          نظام إدارة وتحكيم الهاكاثونات
        </h1>
        <p className="mx-auto max-w-md text-sm leading-7 text-muted-foreground">
          منصة موحّدة لتوزيع المحكمين، جمع التقييمات، احتساب النتائج المرجّحة،
          ومتابعة الإنجاز والترتيب النهائي.
        </p>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row">
        <Button size="lg" render={<Link href="/login" />}>
          تسجيل الدخول
        </Button>
      </div>
    </main>
  );
}
