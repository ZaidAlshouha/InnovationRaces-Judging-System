import type { Locale } from "./locale";
import { TRANSLATIONS, type Translations } from "./translations";

/**
 * Pure translation-resolution logic, extracted from locale-context.tsx so
 * it's unit-testable without a React renderer (this codebase has no
 * @testing-library/react dependency and none was added for Phase F6 — see
 * the F6 final report's "why no component-render tests" note). The
 * LocaleProvider's t() is a thin wrapper around resolveTranslation() below.
 */
export function resolveKey(dict: Translations, key: string): string {
  const parts = key.split(".");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let value: any = dict;
  for (const part of parts) {
    value = value?.[part];
  }
  return typeof value === "string" ? value : key;
}

export function interpolate(template: string, vars?: Record<string, string | number>): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (match, name) =>
    name in vars ? String(vars[name]) : match
  );
}

export function resolveTranslation(
  locale: Locale,
  key: string,
  vars?: Record<string, string | number>
): string {
  return interpolate(resolveKey(TRANSLATIONS[locale], key), vars);
}
