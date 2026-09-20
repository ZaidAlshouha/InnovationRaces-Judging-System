/**
 * Locale primitives shared by the blocking inline script (root layout),
 * the LocaleProvider (locale-context.tsx), and every translation file.
 * Kept dependency-free (no React import) so the inline script — which
 * runs before hydration, exactly like next-themes' own approach — can
 * reuse the same constants without pulling in the client bundle.
 */
export const SUPPORTED_LOCALES = ["ar", "en"] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "ar";

export const LOCALE_STORAGE_KEY = "innovationraces-locale";

export const LOCALE_DIRECTION: Record<Locale, "rtl" | "ltr"> = {
  ar: "rtl",
  en: "ltr",
};

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (SUPPORTED_LOCALES as readonly string[]).includes(value);
}
