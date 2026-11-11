/**
 * Client-side CSV export. Spreadsheet-friendly per language: az/ru use `;` between columns and a
 * decimal comma (what Excel expects with Azerbaijani / Russian regional settings), en uses `,` and a
 * decimal point. Numbers are plain (no thousands separators or currency signs — the header says
 * "(AZN)"), dates are ISO `YYYY-MM-DD`. A UTF-8 BOM keeps ə / ş / Cyrillic intact in Excel.
 */
import type { Locale } from "@/lib/i18n/config";

export type CsvCell = string | number | null | undefined;

export function toCsv(rows: CsvCell[][], locale: Locale): string {
  const sep = locale === "en" ? "," : ";";
  const cell = (value: CsvCell): string => {
    if (value === null || value === undefined) return "";
    if (typeof value === "number") {
      if (!Number.isFinite(value)) return "";
      const text = String(Math.round(value * 100) / 100);
      return locale === "en" ? text : text.replace(".", ",");
    }
    // Text from partner data (service / product names) must never run as a spreadsheet formula.
    const text = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
    return /["\n\r;,]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  return rows.map((row) => row.map(cell).join(sep)).join("\r\n");
}

/** Saves `csv` as a file through a temporary object URL. */
export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob(["﻿", csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
