import { format, parseISO } from "date-fns";
import { ar } from "date-fns/locale";

const DATE_FORMAT = "d MMMM yyyy";

export function formatDateAr(isoDate: string): string {
  try {
    return format(parseISO(isoDate), DATE_FORMAT, { locale: ar });
  } catch {
    return isoDate;
  }
}

export function formatDateTimeAr(isoDateTime: string): string {
  try {
    return format(parseISO(isoDateTime), "d MMMM yyyy، h:mm a", { locale: ar });
  } catch {
    return isoDateTime;
  }
}

export function formatDateRangeAr(startIso: string, endIso: string): string {
  return `${formatDateAr(startIso)} — ${formatDateAr(endIso)}`;
}
