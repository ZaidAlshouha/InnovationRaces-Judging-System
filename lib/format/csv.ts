/** Escapes a single CSV field per RFC 4180 (quotes fields containing commas, quotes, or newlines). */
function escapeCsvField(value: unknown): string {
  const str = value === null || value === undefined ? "" : String(value);
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/** Builds a CSV string (with header row) from column definitions and rows. */
export function toCsv<T>(
  columns: { header: string; accessor: (row: T) => unknown }[],
  rows: T[]
): string {
  const headerLine = columns.map((c) => escapeCsvField(c.header)).join(",");
  const lines = rows.map((row) =>
    columns.map((c) => escapeCsvField(c.accessor(row))).join(",")
  );
  // Leading BOM so Excel opens UTF-8 Arabic text correctly.
  return "﻿" + [headerLine, ...lines].join("\r\n");
}

/** Triggers a browser download of the given CSV content. */
export function downloadCsv(filename: string, csvContent: string): void {
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
