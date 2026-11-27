"use client";

import { useId, useMemo, useState, type PointerEvent } from "react";

import { formatCount } from "@/lib/intelligence";
import type { TrendPoint } from "@/lib/jarvis/command-centre";
import { cn } from "@/lib/utils";

import { EmptyNote } from "@/components/jarvis/ui/primitives";

export type TrendSeries = { key: string; label: string; points: TrendPoint[]; tone: "violet" | "cyan" };

const WIDTH = 640;
const HEIGHT = 200;
// The left margin holds the largest axis label ("KES 4,200") at the chart's scale.
const PAD = { left: 84, right: 14, top: 14, bottom: 30 };
const BASELINE = HEIGHT - PAD.bottom;

const STROKE: Record<TrendSeries["tone"], string> = { violet: "#8b75ff", cyan: "#54d7e9" };

type Segment = { d: string; startX: number; endX: number };

function dayLabel(value: string, style: "short" | "long" = "short"): string {
  const time = Date.parse(value.length === 10 ? `${value}T00:00:00Z` : value);
  if (!Number.isFinite(time)) return value;
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "UTC",
    day: "numeric",
    month: style === "long" ? "long" : "short",
    year: style === "long" ? "numeric" : undefined,
  }).format(new Date(time));
}

function measured(value: number | null): value is number {
  return value !== null && Number.isFinite(value);
}

/**
 * A measured series over time. A bucket the backend did not measure is left as
 * a gap, never drawn as zero. The line draws once on mount; the reduced-motion
 * stylesheet shows it at once.
 */
export function TrendChart({
  series,
  valueLabel = (value: number) => formatCount(value),
  emptyText = "No measured buckets in this window.",
}: {
  series: TrendSeries[];
  valueLabel?: (value: number) => string;
  emptyText?: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  // Two charts can share a page, so each gets its own gradient id.
  const fillId = `jv-trend-fill-${useId().replace(/[^A-Za-z0-9_-]/g, "")}`;

  const model = useMemo(() => {
    const times = Array.from(new Set(series.flatMap((item) => item.points.map((point) => point.t)))).sort();
    const values = series.flatMap((item) => item.points.map((point) => point.v)).filter(measured);
    if (times.length === 0 || values.length === 0) return null;
    const max = Math.max(...values);
    const min = Math.min(0, ...values);
    const span = max - min || 1;
    const innerW = WIDTH - PAD.left - PAD.right;
    const innerH = HEIGHT - PAD.top - PAD.bottom;
    const x = (index: number) => PAD.left + (times.length === 1 ? innerW / 2 : (index / (times.length - 1)) * innerW);
    const y = (value: number) => PAD.top + (1 - (value - min) / span) * innerH;

    const lines = series.map((item) => {
      const byTime = new Map(item.points.map((point) => [point.t, point.v]));
      const values: Array<number | null> = times.map((time) => byTime.get(time) ?? null);
      const segments: Segment[] = [];
      let current: Segment | null = null;
      for (let index = 0; index < values.length; index += 1) {
        const value = values[index];
        if (!measured(value)) {
          if (current !== null) segments.push(current);
          current = null;
          continue;
        }
        const px = x(index);
        const py = y(value);
        if (current === null) {
          current = { d: `M ${px.toFixed(1)} ${py.toFixed(1)}`, startX: px, endX: px };
        } else {
          current = { d: `${current.d} L ${px.toFixed(1)} ${py.toFixed(1)}`, startX: current.startX, endX: px };
        }
      }
      if (current !== null) segments.push(current);
      // A measured day with an unmeasured day on both sides has no line to draw,
      // so it is marked with a point. Without one it would be invisible.
      const isolated = values.flatMap((value, index) => {
        if (!measured(value)) return [];
        const before = index > 0 ? values[index - 1] : null;
        const after = index < values.length - 1 ? values[index + 1] : null;
        return measured(before) || measured(after) ? [] : [index];
      });
      return { key: item.key, label: item.label, tone: item.tone, segments, values, isolated };
    });

    const latestFor = (line: { values: Array<number | null> }) => {
      for (let index = line.values.length - 1; index >= 0; index -= 1) {
        const value = line.values[index];
        if (measured(value)) return { index, value };
      }
      return null;
    };

    return { times, min, max, x, y, lines, latestFor, innerW };
  }, [series]);

  if (!model) return <EmptyNote>{emptyText}</EmptyNote>;

  const first = model.times[0];
  const last = model.times[model.times.length - 1];
  const summary = model.lines
    .map((line) => {
      const latest = model.latestFor(line);
      return latest
        ? `${line.label}: latest ${valueLabel(latest.value)} on ${dayLabel(model.times[latest.index], "long")}`
        : `${line.label}: no measured buckets`;
    })
    .join(". ");

  const onMove = (event: PointerEvent<SVGSVGElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    const svgX = ((event.clientX - box.left) / box.width) * WIDTH;
    const ratio = (svgX - PAD.left) / model.innerW;
    const index = model.times.length === 1 ? 0 : Math.round(ratio * (model.times.length - 1));
    setHover(Math.max(0, Math.min(model.times.length - 1, index)));
  };

  const hoverTime = hover === null ? null : model.times[hover];

  return (
    <figure className="space-y-3">
      <div className="relative">
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          role="img"
          aria-label={summary}
          className="h-[200px] w-full touch-pan-y select-none"
          onPointerMove={onMove}
          onPointerLeave={() => setHover(null)}
        >
          <defs>
            <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#8b75ff" stopOpacity="0.28" />
              <stop offset="100%" stopColor="#8b75ff" stopOpacity="0" />
            </linearGradient>
          </defs>
          {[model.max, model.min].map((tick, index) => (
            <g key={index}>
              <line x1={PAD.left} x2={WIDTH - PAD.right} y1={model.y(tick)} y2={model.y(tick)} stroke="rgba(195,202,226,0.08)" />
              <text x={PAD.left - 8} y={model.y(tick) + 4} textAnchor="end" className="fill-slate-500 text-[12px] tabular-nums">
                {valueLabel(tick)}
              </text>
            </g>
          ))}
          {model.lines.map((line, lineIndex) => (
            <g key={line.key}>
              {lineIndex === 0
                ? line.segments.map((segment, segmentIndex) => (
                    <path
                      key={`fill-${segmentIndex}`}
                      d={`${segment.d} L ${segment.endX.toFixed(1)} ${BASELINE} L ${segment.startX.toFixed(1)} ${BASELINE} Z`}
                      fill={`url(#${fillId})`}
                      stroke="none"
                    />
                  ))
                : null}
              {line.segments.map((segment, segmentIndex) => (
                <path
                  key={segmentIndex}
                  d={segment.d}
                  pathLength={1}
                  fill="none"
                  stroke={STROKE[line.tone]}
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="jv-draw"
                  style={{ animationDelay: `${lineIndex * 120}ms` }}
                />
              ))}
              {line.isolated.map((index) => {
                const value = line.values[index];
                return measured(value) ? (
                  <circle
                    key={`point-${index}`}
                    className="jv-point"
                    cx={model.x(index)}
                    cy={model.y(value)}
                    r={3}
                    fill={STROKE[line.tone]}
                  />
                ) : null;
              })}
            </g>
          ))}
          <text x={PAD.left} y={HEIGHT - 8} className="fill-slate-500 text-[12px]">{dayLabel(first)}</text>
          <text x={WIDTH - PAD.right} y={HEIGHT - 8} textAnchor="end" className="fill-slate-500 text-[12px]">{dayLabel(last)}</text>
          {hover !== null ? (
            <line x1={model.x(hover)} x2={model.x(hover)} y1={PAD.top} y2={BASELINE} stroke="rgba(222,216,255,0.35)" strokeDasharray="3 4" />
          ) : null}
          {hover !== null
            ? model.lines.map((line) => {
                const value = line.values[hover];
                return measured(value) ? (
                  <circle key={line.key} cx={model.x(hover)} cy={model.y(value)} r={3.5} fill={STROKE[line.tone]} stroke="#05060d" strokeWidth={1.5} />
                ) : null;
              })
            : null}
        </svg>
        {hover !== null && hoverTime ? (
          <div
            className={cn(
              "pointer-events-none absolute top-2 rounded-lg border border-white/10 bg-[#080a14]/95 px-3 py-2 text-[11px] shadow-xl",
              hover > model.times.length / 2 ? "right-2" : "left-14",
            )}
          >
            <p className="font-semibold text-slate-200">{dayLabel(hoverTime, "long")}</p>
            {model.lines.map((line) => {
              const value = line.values[hover];
              return (
                <p key={line.key} className="text-slate-400">
                  <span style={{ color: STROKE[line.tone] }}>●</span> {line.label}:{" "}
                  <span className="font-semibold tabular-nums text-slate-200">
                    {measured(value) ? valueLabel(value) : "not measured"}
                  </span>
                </p>
              );
            })}
          </div>
        ) : null}
      </div>

      <figcaption className="flex flex-wrap items-center justify-between gap-3 text-[11px] text-slate-500">
        <div className="flex flex-wrap items-center gap-4">
          {model.lines.map((line) => (
            <span key={line.key} className="inline-flex items-center gap-1.5">
              <span className="h-0.5 w-4 rounded-full" style={{ backgroundColor: STROKE[line.tone] }} aria-hidden="true" />
              {line.label}
            </span>
          ))}
        </div>
        <details className="group">
          <summary className="focus-ring cursor-pointer list-none rounded-md font-semibold text-[#a895ff] hover:text-[#ded8ff] [&::-webkit-details-marker]:hidden">
            Show the values
          </summary>
          <div className="mt-2 max-h-56 overflow-auto rounded-lg border border-white/[0.07]">
            <table className="w-full text-left text-[11px]">
              <thead className="sticky top-0 bg-[#080a14] text-slate-500">
                <tr>
                  <th className="px-3 py-1.5 font-semibold">Day (UTC)</th>
                  {model.lines.map((line) => (
                    <th key={line.key} className="px-3 py-1.5 font-semibold">
                      {line.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {model.times.map((time, index) => (
                  <tr key={time} className="border-t border-white/[0.05] text-slate-300">
                    <td className="px-3 py-1.5 tabular-nums">{dayLabel(time, "long")}</td>
                    {model.lines.map((line) => {
                      const value = line.values[index];
                      return (
                        <td key={line.key} className="px-3 py-1.5 tabular-nums">
                          {measured(value) ? valueLabel(value) : "not measured"}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      </figcaption>
    </figure>
  );
}
