import { describe, it, expect } from "vitest";
import {
  isLocale,
  LOCALE_DIRECTION,
  DEFAULT_LOCALE,
  SUPPORTED_LOCALES,
} from "./locale";

// Note: this test file runs under vitest's "node" environment (no jsdom —
// see vitest.config.mts), matching every other test in this codebase, so
// only the pure locale primitives are covered here (isLocale/direction
// mapping/defaults). The DOM-touching parts of LocaleProvider
// (applyDocumentLocale, localStorage persistence, the <html> lang/dir
// sync) have no automated test — see the F6 final report's "no jsdom /
// no @testing-library/react" limitation note; they were verified manually
// instead, mirroring how next-themes' own equivalent script has no test
// in this codebase either.

describe("isLocale", () => {
  it("accepts every supported locale", () => {
    for (const locale of SUPPORTED_LOCALES) {
      expect(isLocale(locale)).toBe(true);
    }
  });

  it("rejects an unsupported locale string", () => {
    expect(isLocale("fr")).toBe(false);
    expect(isLocale("AR")).toBe(false); // case-sensitive
  });

  it("rejects non-string values, including null/undefined (a fresh localStorage read)", () => {
    expect(isLocale(null)).toBe(false);
    expect(isLocale(undefined)).toBe(false);
    expect(isLocale(42)).toBe(false);
    expect(isLocale({})).toBe(false);
  });
});

describe("LOCALE_DIRECTION", () => {
  it("maps Arabic to rtl and English to ltr", () => {
    expect(LOCALE_DIRECTION.ar).toBe("rtl");
    expect(LOCALE_DIRECTION.en).toBe("ltr");
  });

  it("has a direction defined for every supported locale", () => {
    for (const locale of SUPPORTED_LOCALES) {
      expect(LOCALE_DIRECTION[locale]).toBeDefined();
    }
  });
});

describe("DEFAULT_LOCALE", () => {
  it("defaults to Arabic, per the F6 requirement", () => {
    expect(DEFAULT_LOCALE).toBe("ar");
  });
});
