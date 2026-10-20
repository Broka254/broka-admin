"use client";

import { Activity, AlertCircle, Cpu, RefreshCw, X } from "lucide-react";
import { useAdminWorkerDiagnostics } from "@/hooks/use-admin-resource";
import { StatusBadge } from "@/components/ui/primitives";

interface WorkerDiagnosticsDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export function WorkerDiagnosticsDialog({ isOpen, onClose }: WorkerDiagnosticsDialogProps) {
  const { data, isLoading, isError, error, refetch, isFetching } = useAdminWorkerDiagnostics(isOpen);

  if (!isOpen) return null;

  const worker = data?.worker;
  const backlog = data?.backlog;
  const lastPass = worker?.last_pass;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="diagnostics-title">
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-white/[0.1] bg-[#080a14] p-6 shadow-2xl">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-lg p-1.5 text-slate-400 hover:bg-white/5 hover:text-white"
          aria-label="Close dialog"
        >
          <X size={18} />
        </button>

        <div className="flex items-center justify-between pb-4 border-b border-white/[0.07]">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 bg-[#8b75ff]/10 text-[#a895ff]">
              <Cpu size={20} />
            </div>
            <div>
              <h2 id="diagnostics-title" className="font-display text-lg font-semibold text-white">
                Worker Engine Diagnostics
              </h2>
              <p className="text-xs text-slate-400">Live operational diagnostics from backend communications worker</p>
            </div>
          </div>
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs text-slate-300 hover:bg-white/5 transition"
          >
            <RefreshCw size={13} className={isFetching ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>

        {isLoading ? (
          <div className="py-16 text-center">
            <RefreshCw size={24} className="mx-auto animate-spin text-[#8b75ff]" />
            <p className="mt-3 text-xs text-slate-400">Reading live worker diagnostics...</p>
          </div>
        ) : isError ? (
          <div className="mt-4 rounded-xl border border-rose-400/20 bg-rose-400/10 p-4 text-xs text-rose-200">
            <div className="flex items-center gap-2 font-semibold">
              <AlertCircle size={16} />
              Worker Diagnostics Unavailable
            </div>
            <p className="mt-1 text-slate-400">
              {error instanceof Error ? error.message : "Could not retrieve live worker status from the BROKA API."}
            </p>
          </div>
        ) : (
          <div className="mt-5 space-y-6 text-xs">
            {/* Engine configuration */}
            <section>
              <h3 className="font-semibold text-slate-200 uppercase tracking-wider text-[11px] mb-3">
                Engine Runtime Profile
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-3">
                  <span className="text-[10px] text-slate-500 uppercase tracking-wider block">Mode</span>
                  <span className="font-mono text-xs font-semibold text-slate-200">{worker?.mode ?? "n/a"}</span>
                </div>
                <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-3">
                  <span className="text-[10px] text-slate-500 uppercase tracking-wider block">Sweep Interval</span>
                  <span className="font-mono text-xs font-semibold text-slate-200">{worker?.sweep_seconds ?? "n/a"}s</span>
                </div>
                <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-3">
                  <span className="text-[10px] text-slate-500 uppercase tracking-wider block">Claim Lease</span>
                  <span className="font-mono text-xs font-semibold text-slate-200">{worker?.claim_seconds ?? "n/a"}s</span>
                </div>
                <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-3">
                  <span className="text-[10px] text-slate-500 uppercase tracking-wider block">Provider Concurrency</span>
                  <span className="font-mono text-xs font-semibold text-slate-200">{worker?.provider_concurrency ?? "n/a"}</span>
                </div>
              </div>
            </section>

            {/* Backlog State */}
            <section>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-slate-200 uppercase tracking-wider text-[11px]">
                  Queue Backlog
                </h3>
                <StatusBadge tone={Number(backlog?.pending_recipients || 0) > 0 ? "warning" : "success"}>
                  {Number(backlog?.pending_recipients || 0)} Pending Recipients
                </StatusBadge>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-3.5 space-y-2">
                  <span className="text-[11px] font-semibold text-slate-300 block">Communications Backlog</span>
                  <div className="space-y-1">
                    {Object.entries(backlog?.communications ?? {}).map(([st, cnt]) => (
                      <div key={st} className="flex justify-between items-center text-[11px]">
                        <span className="text-slate-400 capitalize">{st.replace("_", " ")}</span>
                        <span className="font-mono font-medium text-slate-200">{cnt}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-3.5 space-y-2">
                  <span className="text-[11px] font-semibold text-slate-300 block">Recipients Backlog</span>
                  <div className="space-y-1">
                    {Object.entries(backlog?.recipients ?? {}).map(([st, cnt]) => (
                      <div key={st} className="flex justify-between items-center text-[11px]">
                        <span className="text-slate-400 capitalize">{st.replace("_", " ")}</span>
                        <span className="font-mono font-medium text-slate-200">{cnt}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </section>

            {/* Last Sweep Pass */}
            <section className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-4">
              <h3 className="font-semibold text-slate-200 uppercase tracking-wider text-[11px] mb-3 flex items-center gap-2">
                <Activity size={14} className="text-cyan-300" />
                Last Sweep Pass Statistics (Process-Local)
              </h3>
              <p className="mb-3 text-[10px] text-slate-500">
                These counters reset when the worker process restarts. The queue backlog is durable; last-pass counters are not a cross-instance delivery history.
              </p>
              {!lastPass ? (
                <p className="text-slate-500 italic">No pass has completed since worker boot.</p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase block">Last Pass At</span>
                    <span className="text-xs text-slate-300">{lastPass.last_pass_at ? new Date(lastPass.last_pass_at).toLocaleString() : "No pass yet"}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase block">Duration</span>
                    <span className="font-mono text-xs text-slate-300">{lastPass.last_pass_seconds.toFixed(2)} s</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase block">Communications Claimed</span>
                    <span className="font-mono text-xs text-slate-300">{lastPass.communications_claimed}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase block">Provider Accepted</span>
                    <span className="font-mono text-xs text-emerald-400">{lastPass.provider_accepted}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase block">Failures</span>
                    <span className="font-mono text-xs text-rose-400">{lastPass.failures}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase block">Retries Scheduled</span>
                    <span className="font-mono text-xs text-amber-300">{lastPass.retries_scheduled}</span>
                  </div>
                </div>
              )}
            </section>

            <div className="text-[11px] text-slate-500 flex items-center justify-between pt-2">
              <span>Report generated at: {data?.generated_at ? new Date(data.generated_at).toLocaleString() : "Unknown"}</span>
              <span className="text-slate-400">Durable backlog; process-local last-pass counters</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
