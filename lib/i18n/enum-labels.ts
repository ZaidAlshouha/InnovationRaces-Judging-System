import type { Locale } from "./locale";

/**
 * Domain enums (ApplicationStatus, JudgeStatus, QuestionType, etc.) each
 * keep their own `*_LABELS_AR`/`*_LABELS_EN` Record next to the enum
 * definition in lib/domain/*.ts — NOT centralized into the generic
 * Translations dictionary (lib/i18n/translations/*), because these are
 * enum-keyed domain vocabularies (their keys are a closed, migration-
 * governed set like `applications.status`'s CHECK constraint), not
 * free-form UI copy. Centralizing them into Translations would require
 * one dotted key per enum value per domain concept, duplicating the
 * Record<Enum, string> shape the domain files already declare and are
 * already tested against (see e.g. application.test.ts's "never
 * introduces a status value outside the existing CHECK constraint").
 *
 * pickLabel() is the one place that decides "AR map or EN map" from the
 * active locale — every component calls this instead of importing
 * `*_LABELS_AR` directly, so switching language actually changes what's
 * displayed.
 */
export function pickLabel<K extends string | number | symbol>(
  locale: Locale,
  labelsAr: Record<K, string>,
  labelsEn: Record<K, string>,
  key: K
): string {
  return (locale === "ar" ? labelsAr : labelsEn)[key];
}
