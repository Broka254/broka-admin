"use client";

import { useId } from "react";

import type { ZenoAvailability } from "@/components/jarvis/provider";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { cn } from "@/lib/utils";

// Zeno's visible presence. The core shows readiness at a glance and changes
// while an investigation runs. Its motion is CSS transform only, and it stops
// for reduced-motion readers, where the state is still conveyed in its label.

export type CoreState = "checking" | "ready" | "analysing" | "attention" | "disabled" | "unavailable";

export const CORE_LABEL: Record<CoreState, string> = {
  checking: "Checking Zeno readiness",
  ready: "Zeno is ready",
  analysing: "Zeno is investigating",
  attention: "The model gateway is not ready",
  disabled: "Jarvis Mode is not enabled",
  unavailable: "Zeno cannot be reached",
};

/** The state the core shows. A disabled or unreachable Zeno wins over an investigation that cannot be running. */
export function coreStateFor(input: { availability: ZenoAvailability; investigating: boolean }): CoreState {
  if (input.availability === "disabled") return "disabled";
  if (input.availability === "unavailable") return "unavailable";
  if (input.availability === "checking") return "checking";
  if (input.availability === "model-not-ready") return "attention";
  return input.investigating ? "analysing" : "ready";
}

const COLOURS: Record<CoreState, { from: string; to: string; core: string; dot: string }> = {
  checking: { from: "#8b75ff", to: "#64748b", core: "#94a3b8", dot: "#cbd5e1" },
  ready: { from: "#54d7e9", to: "#8b75ff", core: "#54d7e9", dot: "#e0fbff" },
  analysing: { from: "#8b75ff", to: "#54d7e9", core: "#8b75ff", dot: "#ded8ff" },
  attention: { from: "#dbb75d", to: "#fb7185", core: "#dbb75d", dot: "#fff3c4" },
  disabled: { from: "#475569", to: "#334155", core: "#475569", dot: "#94a3b8" },
  unavailable: { from: "#fb7185", to: "#7f1d1d", core: "#fb7185", dot: "#ffe4e6" },
};

export function ZenoCore({ state, size = "sm", className }: { state: CoreState; size?: "sm" | "lg"; className?: string }) {
  // useId can contain characters that are unsafe inside url(#...), so only
  // letters, digits, underscores and hyphens are kept.
  const idBase = useId().replace(/[^A-Za-z0-9_-]/g, "");
  const ringGradientId = `jv-ring-${idBase}`;
  const coreGradientId = `jv-core-${idBase}`;
  const reduced = useReducedMotion();
  const colours = COLOURS[state];
  const moving = !reduced;

  const outerMotion = moving && (state === "analysing" ? "jv-orbit" : state === "ready" ? "jv-orbit-slow" : undefined);
  const innerMotion = moving && state !== "disabled" && state !== "unavailable" ? "jv-orbit-reverse" : undefined;
  const dotMotion = moving && (state === "ready" || state === "checking" || state === "analysing") ? "jv-breathe" : undefined;

  return (
    <svg
      viewBox="0 0 120 120"
      role="img"
      aria-label={CORE_LABEL[state]}
      className={cn(size === "lg" ? "h-44 w-44" : "h-11 w-11", "shrink-0", className)}
    >
      <defs>
        <linearGradient id={ringGradientId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={colours.from} />
          <stop offset="1" stopColor={colours.to} />
        </linearGradient>
        <radialGradient id={coreGradientId}>
          <stop offset="0" stopColor={colours.core} stopOpacity="0.85" />
          <stop offset="1" stopColor={colours.core} stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="60" cy="60" r="55" fill="none" stroke="rgba(195,202,226,0.1)" strokeWidth="1" />
      <g className={cn("jv-spin-origin", outerMotion)}>
        <circle
          cx="60"
          cy="60"
          r="50"
          fill="none"
          stroke={`url(#${ringGradientId})`}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeDasharray={state === "analysing" ? "96 218" : "70 244"}
        />
      </g>
      <g className={cn("jv-spin-origin", innerMotion)}>
        <circle cx="60" cy="60" r="39" fill="none" stroke={colours.from} strokeOpacity="0.4" strokeWidth="1" strokeDasharray="2 7" />
      </g>
      <circle cx="60" cy="60" r="28" fill={`url(#${coreGradientId})`} />
      <circle cx="60" cy="60" r="8" fill={colours.dot} className={cn("origin-center", dotMotion)} style={{ transformOrigin: "60px 60px" }} />
    </svg>
  );
}
