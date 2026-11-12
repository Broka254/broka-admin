"use client";

import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export type Column<T> = {
  key: string;
  header: string;
  align?: "left" | "right";
  render: (row: T) => ReactNode;
  className?: string;
  /** Shown as the card heading below the md breakpoint. */
  primary?: boolean;
  /** Keep this column out of the mobile card; useful for duplicate actions. */
  mobileHidden?: boolean;
  mobileLabel?: string;
  /** Hide a lower-priority desktop column until there is room for it. */
  hideBelow?: "md" | "lg" | "xl";
};

function columnVisibility(column: Column<unknown>): string | undefined {
  if (column.hideBelow === "xl") return "hidden xl:table-cell";
  if (column.hideBelow === "lg") return "hidden lg:table-cell";
  if (column.hideBelow === "md") return "hidden md:table-cell";
  return undefined;
}

/**
 * One table implementation for every operational workspace. On small screens
 * each row becomes a structured record card instead of a horizontally
 * scrolling table, while the desktop keeps a dense, sticky-header table.
 */
export function DataTable<T>({ rows, columns, rowKey, label, empty, selectedKey, onRowClick }: {
  rows: T[];
  columns: Column<T>[];
  rowKey: (row: T) => string;
  label: string;
  empty?: ReactNode;
  selectedKey?: string | null;
  onRowClick?: (row: T) => void;
}) {
  if (!rows.length) return <>{empty ?? <p className="p-5 text-sm text-slate-500">No records match the current backend filters.</p>}</>;
  const primary = columns.find((column) => column.primary) ?? columns[0];
  const secondary = columns.filter((column) => column !== primary && !column.mobileHidden);
  return (
    <>
      <div className="hidden overflow-x-auto md:block">
        <table className="data-table" aria-label={label}>
          <thead>
            <tr>{columns.map((column) => <th key={column.key} scope="col" className={cn(column.align === "right" && "text-right", columnVisibility(column as Column<unknown>), column.className)}>{column.header}</th>)}</tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const key = rowKey(row);
              const selected = selectedKey !== undefined && selectedKey === key;
              return (
                <tr
                  key={key}
                  aria-selected={selected || undefined}
                  tabIndex={onRowClick ? 0 : undefined}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  onKeyDown={onRowClick ? (event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      onRowClick(row);
                    }
                  } : undefined}
                  className={cn(onRowClick && "cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#8b75ff]")}
                >
                  {columns.map((column) => {
                    const content = column.render(row);
                    return column === primary
                      ? <th key={column.key} scope="row" className={cn("align-middle", columnVisibility(column as Column<unknown>), column.className)}>{content}</th>
                      : <td key={column.key} className={cn("align-middle", column.align === "right" && "cell-number", columnVisibility(column as Column<unknown>), column.className)}>{content}</td>;
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <ul className="space-y-2 p-2 md:hidden" aria-label={`${label} record cards`}>
        {rows.map((row) => {
          const key = rowKey(row);
          const selected = selectedKey !== undefined && selectedKey === key;
          return (
            <li key={key}>
              <article
                tabIndex={onRowClick ? 0 : undefined}
                className={cn("rounded-xl border p-3.5 transition", selected ? "border-[#8b75ff]/45 bg-[#8b75ff]/[0.08]" : "border-white/[0.07] bg-white/[0.025]", onRowClick && "cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#8b75ff]")}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                onKeyDown={onRowClick ? (event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onRowClick(row);
                  }
                } : undefined}
              >
                <div className="flex items-start justify-between gap-2">{primary.render(row)}</div>
                <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2">
                  {secondary.map((column) => (
                    <div key={column.key} className={cn("min-w-0", column.align === "right" && "text-right")}>
                      <dt className="text-[9px] font-bold uppercase tracking-[0.12em] text-slate-600">{column.mobileLabel ?? column.header}</dt>
                      <dd className="mt-0.5 break-words text-[11px] text-slate-300">{column.render(row)}</dd>
                    </div>
                  ))}
                </dl>
              </article>
            </li>
          );
        })}
      </ul>
    </>
  );
}
