"use client";

import { RequireRole } from "@/lib/auth/require-role";
import { UserRole } from "@/lib/domain/user";
import { useHackathons } from "@/lib/queries/use-hackathons";
import { useResults } from "@/lib/queries/use-results";
import { formatDateAr } from "@/lib/format/dates";

/**
 * Print-only view of the final results table — no admin chrome, opened in a
 * new tab from the Reports page and printed via the browser's own dialog
 * (no PDF library dependency). Lives outside `app/admin` so it doesn't
 * inherit the sidebar/header layout.
 */
export default function PrintResultsPage() {
  return (
    <RequireRole role={UserRole.Admin}>
      <PrintResultsContent />
    </RequireRole>
  );
}

function PrintResultsContent() {
  const hackathonsQuery = useHackathons();
  const activeHackathon = hackathonsQuery.data?.[0];
  const resultsQuery = useResults(activeHackathon?.id);
  const results = resultsQuery.data ?? [];

  if (hackathonsQuery.isLoading || resultsQuery.isLoading) {
    return <p className="p-8 text-sm text-muted-foreground">جارٍ التحميل...</p>;
  }

  if (!activeHackathon) {
    return <p className="p-8 text-sm text-muted-foreground">لا يوجد هاكاثون نشط.</p>;
  }

  return (
    <div className="mx-auto max-w-3xl p-8 print:p-0" dir="rtl">
      <div className="mb-2 flex items-center justify-between print:hidden">
        <button
          type="button"
          onClick={() => window.print()}
          className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground"
        >
          طباعة
        </button>
      </div>

      <h1 className="text-xl font-semibold text-foreground">
        نتائج {activeHackathon.name}
      </h1>
      <p className="mb-6 text-sm text-muted-foreground">
        {formatDateAr(activeHackathon.startDate)} — {formatDateAr(activeHackathon.endDate)}
      </p>

      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-foreground/20 text-start">
            <th className="p-2 text-start">الترتيب</th>
            <th className="p-2 text-start">الرقم</th>
            <th className="p-2 text-start">المشروع</th>
            <th className="p-2 text-start">الفريق</th>
            <th className="p-2 text-start">النتيجة النهائية</th>
          </tr>
        </thead>
        <tbody>
          {results.map((result) => (
            <tr key={result.projectId} className="border-b border-foreground/10">
              <td className="p-2 tabular-nums">{result.rank ?? "—"}</td>
              <td className="p-2 tabular-nums">{result.projectNumber}</td>
              <td className="p-2">{result.projectName}</td>
              <td className="p-2">{result.teamName}</td>
              <td className="p-2 tabular-nums">
                {result.finalScore ?? (result.isComplete ? "—" : "غير مكتمل")}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
