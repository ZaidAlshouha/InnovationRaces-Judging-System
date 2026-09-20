/**
 * Source for the blocking inline <script> in app/layout.tsx's <head> —
 * stringified via .toString() exactly like next-themes' own approach
 * (see node_modules/next-themes: the `M` function serialized into a
 * <script dangerouslySetInnerHTML>). Runs before React hydrates, so the
 * correct lang/dir is already on <html> for the very first paint — no
 * flash of Arabic-then-English (or rtl-then-ltr) layout shift, and no
 * hydration-mismatch warning from LocaleProvider's lazy-init state
 * differing from the server-rendered lang="ar" dir="rtl" default.
 *
 * Keep this function pure and dependency-free — it is never imported at
 * runtime by application code, only stringified into the page's HTML.
 */
export function noFlashLocaleScript(
  storageKey: string,
  defaultLocale: string
) {
  try {
    const stored = window.localStorage.getItem(storageKey);
    const locale = stored === "ar" || stored === "en" ? stored : defaultLocale;
    const root = document.documentElement;
    root.lang = locale;
    root.dir = locale === "ar" ? "rtl" : "ltr";
  } catch {
    // localStorage unavailable — <html> keeps its server-rendered
    // lang="ar" dir="rtl" default (see app/layout.tsx).
  }
}
