import type { Locale } from "../locale";
import type { Translations } from "./types";
import { ar } from "./ar";
import { en } from "./en";

export type { Translations } from "./types";

export const TRANSLATIONS: Record<Locale, Translations> = { ar, en };
