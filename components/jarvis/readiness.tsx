import Link from "next/link";
import { RefreshCw, X } from "lucide-react";

import { JarvisRequestError, type useJarvisStatus } from "@/hooks/use-jarvis";
import { ERROR_COPY, jarvisErrorKind, lastErrorLabel, type JarvisErrorKind } from "@/lib/jarvis/presentation";
import { relativeTime } from "@/lib/intelligence";
import { cn } from "@/lib/utils";

type Tone = "info" | "warning" | "danger" | "success" | "neutral";

const KIND_TONE: Record<JarvisErrorKind, Exclude<Tone, "success" | "neutral">> = {
  disabled: "info",
  endpoint_unavailable: "info",
  not_found: "info",
  unauthorized: "info",
  context_unsafe: "info",
  validation: "info",
  unavailable: "warning",
  rate_limited: "warning",
  model_unavailable: "warning",
  timeout: "warning",
  forbidden: "danger",
  invalid_response: "danger",
  error: "danger",
};

const PANEL_TONE: Record<Exclude<Tone, "neutral" | "success">, string> = {
  info: "border-cyan-300/20 bg-cyan-300/[0.06]",
  warning: "border-amber-300/25 bg-amber-300/[0.06]",
  danger: "border-rose-400/25 bg-rose-400/[0.06]",
};

/**
 * A plain statement of a failed or unavailable state, with the next step
 * that is actually available. Retry appears only where retrying can help.
 */
export function JarvisNotice({
  kind,
  onRetry,
  onDismiss,
  retryAfterSeconds = null,
  className,
}: {
  kind: JarvisErrorKind;
  onRetry?: () => void;
  onDismiss?: () => void;
  retryAfterSeconds?: number | null;
  className?: string;
}) {
  const copy = ERROR_COPY[kind];
  const tone = KIND_TONE[kind];
  const wait = retryAfterSeconds ? ` Try again in about ${retryAfterSeconds} seconds.` : "";
  return (
    <div
      role={tone === "info" ? "status" : "alert"}
      className={cn(
        "flex flex-col gap-4 rounded-xl border p-4 sm:flex-row sm:items-start sm:justify-between",
        PANEL_TONE[tone],
        className,
      )}
    >
      <div className="min-w-0 space-y-1">
        <p className="text-sm font-semibold text-slate-100">{copy.title}</p>
        <p className="text-sm leading-6 text-slate-400">
          {copy.body}
          {wait}
        </p>
      </div>
      {onRetry || onDismiss || kind === "unauthorized" ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {kind === "unauthorized" ? (
            <Link
              href="/login"
              className="focus-ring rounded-lg border border-white/12 bg-white/[0.05] px-3 py-1.5 text-xs font-semibold text-slate-100 hover:border-white/25"
            >
              Sign in
            </Link>
          ) : null}
          {onRetry ? (
            <button
              type="button"
              onClick={onRetry}
              className="focus-ring inline-flex items-center gap-1.5 rounded-lg border border-[#8b75ff]/35 bg-[#8b75ff]/10 px-3 py-1.5 text-xs! font-semibold text-[#ded8ff] hover:border-[#8b75ff]/60"
            >
              <RefreshCw size={13} aria-hidden="true" />
              Retry
            </button>
          ) : null}
          {onDismiss ? (
            <button
              type="button"
              onClick={onDismiss}
              aria-label={`Dismiss: ${copy.title}`}
              className="focus-ring rounded-lg border border-white/10 p-1.5 text-slate-400 hover:text-white"
            >
              <X size={14} aria-hidden="true" />
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

const DOT: Record<Tone, string> = {
  success: "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]",
  danger: "bg-rose-400 shadow-[0_0_8px_rgba(251,113,133,0.55)]",
  warning: "bg-amber-300 shadow-[0_0_8px_rgba(219,183,93,0.5)]",
  info: "bg-cyan-300",
  neutral: "bg-slate-500",
};

function Tile({ label, value, tone }: { label: string; value: string; tone: Tone }) {
  return (
    <div className="inset-panel min-w-0 space-y-1.5 p-3">
      <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.13em] text-slate-500">
        <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", DOT[tone])} aria-hidden="true" />
        {label}
      </p>
      <p className="break-words text-sm font-semibold text-slate-100">{value}</p>
    </div>
  );
}

/**
 * Compact readiness: whether Jarvis Mode is on, whether the model gateway and
 * providers are configured, the tool registry, and the last failure category.
 * It shows names and counts only, never keys or provider text.
 */
export function ReadinessStrip({ status }: { status: ReturnType<typeof useJarvisStatus> }) {
  if (status.isPending) {
    return (
      <section aria-label="System readiness" aria-busy="true" className="data-panel p-4">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {Array.from({ length: 5 }, (_, index) => (
            <div key={index} className="skeleton h-[72px]" aria-hidden="true" />
          ))}
        </div>
        <p className="sr-only" role="status">Checking Jarvis Mode readiness</p>
      </section>
    );
  }

  if (status.error) {
    const error = status.error instanceof JarvisRequestError ? status.error : null;
    const kind = jarvisErrorKind(error?.code, error?.status ?? 0);
    return (
      <section aria-label="System readiness">
        <JarvisNotice
          kind={kind}
          onRetry={kind === "disabled" || kind === "endpoint_unavailable" ? undefined : () => void status.refetch()}
          retryAfterSeconds={error?.retryAfterSeconds ?? null}
        />
      </section>
    );
  }

  const data = status.data;
  if (!data) return null;
  const providers = data.providers_configured;
  const tiles: Array<{ label: string; value: string; tone: Tone }> = [
    { label: "Jarvis Mode", value: data.enabled ? "Enabled" : "Disabled", tone: data.enabled ? "success" : "danger" },
    {
      label: "Model gateway",
      value: data.model_gateway_ready ? "Ready" : "Not ready",
      tone: data.model_gateway_ready ? "success" : "danger",
    },
    {
      label: "Providers configured",
      value: providers.length > 0 ? providers.join(", ") : "None configured",
      tone: providers.length > 0 ? "success" : "danger",
    },
    {
      label: "Tool registry",
      value: data.tool_registry_ready ? `Ready · ${data.tool_count} tools` : "Not ready",
      tone: data.tool_registry_ready ? "success" : "danger",
    },
    {
      label: "Last model error",
      value: lastErrorLabel(data.last_error_category),
      tone: data.last_error_category ? "warning" : "neutral",
    },
  ];

  return (
    <section aria-labelledby="jarvis-readiness-title" className="data-panel p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 id="jarvis-readiness-title" className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#a895ff]">
          System readiness
        </h2>
        <div className="flex items-center gap-3 text-[11px] text-slate-500">
          <span>Checked {relativeTime(data.generated_at)}</span>
          <button
            type="button"
            onClick={() => void status.refetch()}
            disabled={status.isFetching}
            className="focus-ring inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 font-semibold text-slate-400 hover:text-slate-100 disabled:opacity-50"
          >
            <RefreshCw size={12} aria-hidden="true" className={cn(status.isFetching && "motion-safe:animate-spin")} />
            Refresh
          </button>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {tiles.map((tile) => (
          <Tile key={tile.label} label={tile.label} value={tile.value} tone={tile.tone} />
        ))}
      </div>
    </section>
  );
}
