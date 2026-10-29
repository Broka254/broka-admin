"use client";

import { useMemo } from "react";

import type { RevenueBucket } from "@/lib/api/revenue";

export interface DateRangeSelection {
  from: string;
  to: string;
  bucket: RevenueBucket;
}

interface DateRangePickerProps extends DateRangeSelection {
  onChange: (selection: DateRangeSelection) => void;
}

type Preset = "7d" | "30d" | "90d" | "custom";

function toISODate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function rangeForPreset(preset: Exclude<Preset, "custom">, bucket: RevenueBucket): DateRangeSelection {
  const to = new Date();
  const from = new Date();
  from.setDate(to.getDate() - (preset === "7d" ? 7 : preset === "30d" ? 30 : 90));
  return { from: toISODate(from), to: toISODate(to), bucket };
}

export function DateRangePicker({ from, to, bucket, onChange }: DateRangePickerProps) {
  const activePreset = useMemo<Preset>(() => {
    for (const preset of ["7d", "30d", "90d"] as const) {
      const candidate = rangeForPreset(preset, bucket);
      if (candidate.from === from && candidate.to === to) return preset;
    }
    return "custom";
  }, [from, to, bucket]);

  const controlClass =
    "rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-2 text-xs font-medium text-slate-200 outline-none transition focus:border-[#8b75ff]/60 focus-visible:outline-2 focus-visible:outline-[#8b75ff]";

  return (
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Date range">
      {(["7d", "30d", "90d"] as const).map((preset) => (
        <button
          key={preset}
          type="button"
          aria-pressed={activePreset === preset}
          onClick={() => onChange(rangeForPreset(preset, bucket))}
          className={
            activePreset === preset
              ? "rounded-lg border border-[#8b75ff]/60 bg-[#8b75ff]/15 px-3 py-2 text-xs font-semibold text-white"
              : "rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-xs font-medium text-slate-300 transition hover:border-[#8b75ff]/40 hover:text-white"
          }
        >
          {preset === "7d" ? "Last 7 days" : preset === "30d" ? "Last 30 days" : "Last 90 days"}
        </button>
      ))}
      <label className="flex items-center gap-1.5 text-xs text-slate-400">
        From
        <input
          type="date"
          aria-label="From date"
          value={from}
          max={to}
          onChange={(event) => onChange({ from: event.target.value, to, bucket })}
          className={controlClass}
        />
      </label>
      <label className="flex items-center gap-1.5 text-xs text-slate-400">
        To
        <input
          type="date"
          aria-label="To date"
          value={to}
          min={from}
          onChange={(event) => onChange({ from, to: event.target.value, bucket })}
          className={controlClass}
        />
      </label>
      <label className="flex items-center gap-1.5 text-xs text-slate-400">
        Bucket
        <select
          aria-label="Bucket"
          value={bucket}
          onChange={(event) => onChange({ from, to, bucket: event.target.value as RevenueBucket })}
          className={controlClass}
        >
          <option value="day">Daily</option>
          <option value="week">Weekly</option>
          <option value="month">Monthly</option>
        </select>
      </label>
    </div>
  );
}
