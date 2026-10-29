export type CsvRow = Record<string, string | number | boolean | null | undefined>;

function escapeCell(value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined) return "";
  const text = String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** Serialize rows to CSV text. Headers are the union of keys in row order. */
export function toCSV(rows: CsvRow[]): string {
  if (rows.length === 0) return "";
  const headers = Array.from(new Set(rows.flatMap((row) => Object.keys(row))));
  const lines = [
    headers.map(escapeCell).join(","),
    ...rows.map((row) => headers.map((header) => escapeCell(row[header])).join(",")),
  ];
  return lines.join("\n");
}

/** Trigger a client-side CSV download. Safe to call during SSR (no-op). */
export function downloadCSV(filename: string, rows: CsvRow[]): void {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  if (typeof URL.createObjectURL !== "function") return;
  const blob = new Blob([toCSV(rows)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
