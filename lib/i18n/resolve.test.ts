import { describe, it, expect } from "vitest";
import { resolveTranslation, resolveKey, interpolate } from "./resolve";
import { ar } from "./translations/ar";
import { en } from "./translations/en";
import { TRANSLATIONS } from "./translations";

describe("resolveKey", () => {
  it("resolves a nested dotted key to its string value", () => {
    expect(resolveKey(ar, "nav.dashboard")).toBe("لوحة التحكم");
    expect(resolveKey(en, "nav.dashboard")).toBe("Dashboard");
  });

  it("falls back to the key itself when the path doesn't resolve to a string", () => {
    expect(resolveKey(ar, "nav.doesNotExist")).toBe("nav.doesNotExist");
    expect(resolveKey(ar, "totally.made.up.path")).toBe("totally.made.up.path");
  });
});

describe("interpolate", () => {
  it("substitutes a single placeholder", () => {
    expect(interpolate("Hello, {name}!", { name: "Sara" })).toBe("Hello, Sara!");
  });

  it("substitutes multiple placeholders", () => {
    expect(interpolate("{a} of {b}", { a: 1, b: 10 })).toBe("1 of 10");
  });

  it("leaves an unmatched placeholder untouched rather than throwing", () => {
    expect(interpolate("{missing} value", {})).toBe("{missing} value");
  });

  it("returns the template unchanged when no vars are given", () => {
    expect(interpolate("plain text")).toBe("plain text");
  });
});

describe("resolveTranslation", () => {
  it("resolves and interpolates in one call, per locale", () => {
    expect(resolveTranslation("ar", "login.welcomeToast", { name: "سارة" })).toBe(
      "مرحبًا، سارة"
    );
    expect(resolveTranslation("en", "login.welcomeToast", { name: "Sara" })).toBe(
      "Welcome, Sara"
    );
  });
});

describe("TRANSLATIONS completeness — ar/en never drift apart", () => {
  function collectKeys(obj: unknown, prefix = ""): string[] {
    if (typeof obj === "string") return [prefix];
    if (obj && typeof obj === "object") {
      return Object.entries(obj).flatMap(([key, value]) =>
        collectKeys(value, prefix ? `${prefix}.${key}` : key)
      );
    }
    return [];
  }

  it("both locales expose exactly the same set of dotted keys", () => {
    const arKeys = collectKeys(TRANSLATIONS.ar).sort();
    const enKeys = collectKeys(TRANSLATIONS.en).sort();
    expect(enKeys).toEqual(arKeys);
  });

  it("no translation value is an empty string in either locale", () => {
    for (const locale of ["ar", "en"] as const) {
      for (const key of collectKeys(TRANSLATIONS[locale])) {
        expect(resolveKey(TRANSLATIONS[locale], key).length).toBeGreaterThan(0);
      }
    }
  });
});
