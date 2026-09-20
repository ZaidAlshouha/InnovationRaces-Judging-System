"use client";

import * as React from "react";
import {
  DEFAULT_LOCALE,
  LOCALE_DIRECTION,
  LOCALE_STORAGE_KEY,
  isLocale,
  type Locale,
} from "./locale";
import type { Translations } from "./translations";
import { resolveTranslation } from "./resolve";

/**
 * Centralized i18n architecture (Phase F6) — mirrors next-themes'
 * ThemeProvider shape exactly (see components/layout/theme-switcher.tsx):
 * a React context + localStorage persistence + a blocking inline script in
 * the root layout (see app/layout.tsx) that applies the persisted locale's
 * dir/lang to <html> BEFORE hydration, so there is no flash of
 * wrong-direction content.
 *
 * That script only ever touches <html> lang/dir directly via the DOM — it
 * has no effect on React's own render output, which is what hydration
 * actually compares. LocaleProvider's `locale` state therefore always
 * starts at DEFAULT_LOCALE on both server and client (see the useState
 * below) and only syncs to the real persisted locale in an effect after
 * mount, so every server-rendered string produced via t()/locale (not just
 * <html>'s attributes) matches the client's first render exactly — no
 * hydration mismatch warning.
 *
 * No routing changes (no /ar/... or /en/... segments) — the locale is
 * pure client state layered on top of the existing single-route
 * structure, exactly as the task's architecture requirement asked for
 * ("do not require duplicate routes unless the existing architecture
 * clearly benefits from it" — it doesn't here: every page is already
 * behind an admin/judge auth gate with no locale-specific data-fetching
 * or SEO requirement that would justify route-level splitting).
 */
interface LocaleContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  toggleLocale: () => void;
  /** Translation accessor. Usage: t("nav.dashboard"), or with interpolation: t("login.welcomeToast", { name: user.name }). */
  t: <K extends DottedKeys<Translations>>(
    key: K,
    vars?: Record<string, string | number>
  ) => string;
}

const LocaleContext = React.createContext<LocaleContextValue | undefined>(undefined);

/** Every "section.key" dotted path through the Translations shape, e.g. "nav.dashboard" | "login.emailLabel" | ... — gives t() full autocomplete/type-checking against the shared Translations type, so a typo or an untranslated key fails to compile rather than silently rendering nothing. */
type DottedKeys<T, Prefix extends string = ""> = {
  [K in keyof T & string]: T[K] extends string
    ? `${Prefix}${K}`
    : DottedKeys<T[K], `${Prefix}${K}.`>;
}[keyof T & string];

function applyDocumentLocale(locale: Locale) {
  const root = document.documentElement;
  root.lang = locale;
  root.dir = LOCALE_DIRECTION[locale];
}

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  // Always starts at DEFAULT_LOCALE, identically on the server and on the
  // client's very first render — deliberately NOT a lazy initializer that
  // reads localStorage. Reading localStorage inside useState's initializer
  // runs during React's client render itself (not just "on the client" in
  // some later, already-hydrated sense), so it produced a different value
  // on the client's first pass than the server ever rendered whenever a
  // visitor had a persisted non-default locale — a real
  // "server rendered text didn't match the client" hydration error on any
  // text driven by t()/locale (e.g. RequireRole's loading message), not
  // just a cosmetic flash.
  //
  // The persisted locale is instead applied in the effect below, after
  // mount — this is what next-themes' own provider actually does
  // (ThemeProvider renders its default value tree until mounted, then
  // swaps), not what the previous comment here assumed. The blocking
  // inline script in app/layout.tsx already prevents the *visual* flash by
  // mutating <html> lang/dir directly, outside of React, before hydration
  // — that part is untouched and still does its job; this only changes
  // what React's own render output is, which is the actual hydration
  // boundary.
  const [locale, setLocaleState] = React.useState<Locale>(DEFAULT_LOCALE);

  const setLocale = React.useCallback((next: Locale) => {
    setLocaleState(next);
    try {
      window.localStorage.setItem(LOCALE_STORAGE_KEY, next);
    } catch {
      // localStorage unavailable (private browsing, etc.) — locale still
      // works for this session via React state, just doesn't persist.
    }
    applyDocumentLocale(next);
  }, []);

  const toggleLocale = React.useCallback(() => {
    setLocale(locale === "ar" ? "en" : "ar");
  }, [locale, setLocale]);

  // Runs once after mount: reads the persisted locale (if any) and, only
  // when it differs from the DEFAULT_LOCALE this component already
  // rendered with, updates React state to match — this happens strictly
  // after hydration has already reconciled the identical server/client
  // initial output, so it is an ordinary post-mount state update, not a
  // hydration participant. Also (re)applies <html> lang/dir, covering both
  // the case where the persisted locale is the default (blocking script
  // already set it correctly, nothing to do) and the case where it isn't
  // (this effect corrects it — a one-frame correction, same as before).
  React.useEffect(() => {
    let next: Locale = DEFAULT_LOCALE;
    try {
      const stored = window.localStorage.getItem(LOCALE_STORAGE_KEY);
      if (isLocale(stored)) next = stored;
    } catch {
      // localStorage unavailable — stay on DEFAULT_LOCALE.
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional mount-only sync from localStorage (not derived state), the standard SSR/client-render-mismatch guard for window-dependent values — same pattern as publication-section.tsx's own mounted flag.
    if (next !== locale) setLocaleState(next);
    applyDocumentLocale(next);
    // Intentionally runs once on mount only (persisted-locale hydration is
    // a one-time sync) — `locale` itself is read, not depended on, and the
    // effect below already handles the ongoing "keep <html> in sync with
    // whatever locale is now current" job via its own [locale] dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keeps <html> in sync whenever locale changes (covers a locale change
  // from another tab via the storage event below, and any setLocale()
  // call after the mount-sync effect above has already run once).
  React.useEffect(() => {
    applyDocumentLocale(locale);
  }, [locale]);

  React.useEffect(() => {
    function handleStorage(event: StorageEvent) {
      if (event.key === LOCALE_STORAGE_KEY && isLocale(event.newValue)) {
        setLocaleState(event.newValue);
        applyDocumentLocale(event.newValue);
      }
    }
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  const t = React.useCallback(
    (key: string, vars?: Record<string, string | number>) => resolveTranslation(locale, key, vars),
    [locale]
  ) as LocaleContextValue["t"];

  const value = React.useMemo<LocaleContextValue>(
    () => ({ locale, setLocale, toggleLocale, t }),
    [locale, setLocale, toggleLocale, t]
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

/** The one hook every component uses for both the current locale and translated strings — never import TRANSLATIONS/ar/en directly outside this file. */
export function useLocale(): LocaleContextValue {
  const context = React.useContext(LocaleContext);
  if (!context) {
    throw new Error("useLocale must be used within a LocaleProvider");
  }
  return context;
}

/** Convenience alias for components that only need t() — same value as useLocale().t. */
export function useTranslations(): LocaleContextValue["t"] {
  return useLocale().t;
}
