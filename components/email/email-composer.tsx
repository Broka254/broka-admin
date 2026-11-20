"use client";

import { AlertCircle, CheckCircle2, CircleDashed, Lock, Mail, RotateCcw, Send } from "lucide-react";
import { useId, useState, type FormEvent } from "react";

import { SectionEyebrow } from "@/components/ui/primitives";
import { useSendAdminEmail } from "@/hooks/use-send-admin-email";
import {
  AdminEmailSendInSchema,
  EMAIL_MESSAGE_MAX,
  EMAIL_SUBJECT_MAX,
  type AdminEmailSendIn,
  type AdminEmailSendOut,
} from "@/lib/api/email-schemas";
import { cn } from "@/lib/utils";

// What the sender is when nothing else has been reported. The address that
// matters is the one the server answers with after a send (shown in the
// confirmation): the sender is the backend's setting, never the dashboard's.
const DEFAULT_SENDER = "Broka Admin <admin@broka.co.ke>";
const DEFAULT_REPLY_TO = "admin@broka.co.ke";

type Field = keyof AdminEmailSendIn;
type Draft = Record<Field, string>;
const EMPTY: Draft = { to: "", subject: "", message: "" };

/** The first problem with each field, or none: the same rules the proxy and backend apply. */
function problems(draft: Draft): Partial<Record<Field, string>> {
  const parsed = AdminEmailSendInSchema.safeParse(draft);
  if (parsed.success) return {};
  const found: Partial<Record<Field, string>> = {};
  for (const issue of parsed.error.issues) {
    const field = issue.path[0] as Field | undefined;
    if (field && !found[field]) found[field] = issue.message;
  }
  return found;
}

const inputClass = "mt-1.5 w-full rounded-xl border bg-[#080a14] px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none disabled:opacity-60";

function Counter({ used, max }: { used: number; max: number }) {
  return <span className={cn("text-[10px] tabular-nums", used > max ? "text-rose-300" : "text-slate-500")}>{used.toLocaleString("en-US")} / {max.toLocaleString("en-US")}</span>;
}

function Sent({ result, to, onAnother }: { result: AdminEmailSendOut; to: string; onAnother: () => void }) {
  return (
    <div role="status" className="rounded-2xl border border-emerald-400/25 bg-emerald-400/[0.07] p-5">
      <div className="flex items-start gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-emerald-400/25 bg-emerald-400/10 text-emerald-200" aria-hidden="true"><CheckCircle2 size={17} /></span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-emerald-100">Message sent to <span className="break-all">{to}</span></p>
          <p className="mt-1 text-xs leading-5 text-emerald-100/80">
            The email service accepted it for delivery. This page does not show whether it reached the inbox. Replies go to {result.reply_to}.
          </p>
          <dl className="mt-3 grid gap-x-6 gap-y-1 text-[11px] text-slate-400 sm:grid-cols-[auto_1fr]">
            <dt>From</dt><dd className="break-all text-slate-300">{result.sender}</dd>
            <dt>Reference</dt><dd className="break-all font-mono text-slate-300">{result.message_id}</dd>
          </dl>
        </div>
      </div>
      <button type="button" onClick={onAnother} className="focus-ring mt-4 inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-3.5 py-2 text-xs font-semibold text-slate-100 transition hover:bg-white/[0.08]">
        <RotateCcw size={13} aria-hidden="true" />
        Write another
      </button>
    </div>
  );
}

export function EmailComposer() {
  const { send, isPending, error, reset } = useSendAdminEmail();
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [touched, setTouched] = useState<Partial<Record<Field, boolean>>>({});
  const [sent, setSent] = useState<{ result: AdminEmailSendOut; to: string } | null>(null);
  const ids = { to: useId(), subject: useId(), message: useId() };

  const found = problems(draft);
  const valid = Object.keys(found).length === 0;
  const show = (field: Field) => (touched[field] ? found[field] : undefined);

  function change(field: Field, value: string) {
    setDraft((current) => ({ ...current, [field]: value }));
    // An old failure describes the old text; it must not sit beside a new draft.
    if (error) reset();
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isPending) return;
    if (!valid) {
      setTouched({ to: true, subject: true, message: true });
      return;
    }
    const result = await send(draft);
    if (result) setSent({ result, to: draft.to.trim() });
  }

  function another() {
    setSent(null);
    setDraft(EMPTY);
    setTouched({});
    reset();
  }

  return (
    <div className="space-y-6">
      <header className="border-b border-white/[0.07] pb-6">
        <SectionEyebrow>Respond</SectionEyebrow>
        <h1 className="font-display text-3xl font-semibold tracking-[-0.05em] text-white">Email Reply</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
          Write to a customer from the BROKA admin address. Replies come back to that address&apos;s inbox. This is for sending only: it does not show an inbox or the messages you have sent.
        </p>
      </header>

      {sent ? (
        <Sent result={sent.result} to={sent.to} onAnother={another} />
      ) : (
        <form onSubmit={submit} noValidate aria-label="Send an email" className="max-w-3xl rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4 sm:p-6">
          <dl className="mb-5 grid gap-3 rounded-xl border border-white/[0.06] bg-black/20 p-3.5 text-xs sm:grid-cols-2">
            <div>
              <dt className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500"><Lock size={11} aria-hidden="true" />From</dt>
              <dd className="mt-1 break-all text-slate-200">{DEFAULT_SENDER}</dd>
            </div>
            <div>
              <dt className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500"><Lock size={11} aria-hidden="true" />Replies go to</dt>
              <dd className="mt-1 break-all text-slate-200">{DEFAULT_REPLY_TO}</dd>
            </div>
          </dl>

          <div>
            <label htmlFor={ids.to} className="text-xs font-semibold text-slate-100">To</label>
            <input
              id={ids.to}
              type="email"
              inputMode="email"
              autoComplete="off"
              spellCheck={false}
              value={draft.to}
              disabled={isPending}
              placeholder="customer@example.com"
              aria-invalid={show("to") ? true : undefined}
              aria-describedby={show("to") ? `${ids.to}-error` : undefined}
              onChange={(event) => change("to", event.target.value)}
              onBlur={() => setTouched((current) => ({ ...current, to: true }))}
              className={cn(inputClass, show("to") ? "border-rose-400/50" : "border-white/10 focus:border-[#8b75ff]/50")}
            />
            {show("to") ? <p id={`${ids.to}-error`} className="mt-1.5 text-xs text-rose-300">{show("to")}</p> : null}
          </div>

          <div className="mt-4">
            <div className="flex items-center justify-between gap-2">
              <label htmlFor={ids.subject} className="text-xs font-semibold text-slate-100">Subject</label>
              <Counter used={draft.subject.trim().length} max={EMAIL_SUBJECT_MAX} />
            </div>
            <input
              id={ids.subject}
              type="text"
              autoComplete="off"
              value={draft.subject}
              disabled={isPending}
              aria-invalid={show("subject") ? true : undefined}
              aria-describedby={show("subject") ? `${ids.subject}-error` : undefined}
              onChange={(event) => change("subject", event.target.value)}
              onBlur={() => setTouched((current) => ({ ...current, subject: true }))}
              className={cn(inputClass, show("subject") ? "border-rose-400/50" : "border-white/10 focus:border-[#8b75ff]/50")}
            />
            {show("subject") ? <p id={`${ids.subject}-error`} className="mt-1.5 text-xs text-rose-300">{show("subject")}</p> : null}
          </div>

          <div className="mt-4">
            <div className="flex items-center justify-between gap-2">
              <label htmlFor={ids.message} className="text-xs font-semibold text-slate-100">Message</label>
              <Counter used={draft.message.trim().length} max={EMAIL_MESSAGE_MAX} />
            </div>
            <textarea
              id={ids.message}
              value={draft.message}
              rows={10}
              disabled={isPending}
              placeholder="Write your reply. Line breaks are kept. Plain text only."
              aria-invalid={show("message") ? true : undefined}
              aria-describedby={show("message") ? `${ids.message}-error` : undefined}
              onChange={(event) => change("message", event.target.value)}
              onBlur={() => setTouched((current) => ({ ...current, message: true }))}
              className={cn(inputClass, "min-h-48 resize-y leading-6", show("message") ? "border-rose-400/50" : "border-white/10 focus:border-[#8b75ff]/50")}
            />
            {show("message") ? <p id={`${ids.message}-error`} className="mt-1.5 text-xs text-rose-300">{show("message")}</p> : null}
          </div>

          {error ? (
            <div role="alert" className="mt-4 flex items-start gap-2.5 rounded-xl border border-rose-400/25 bg-rose-400/[0.07] p-3.5 text-xs leading-5 text-rose-100">
              <AlertCircle size={15} className="mt-0.5 shrink-0 text-rose-300" aria-hidden="true" />
              <div className="min-w-0">
                <p>{error.message}</p>
                {error.status >= 500 || error.status === 0 ? <p className="mt-1 text-rose-100/70">Your message is kept. Send again to retry.</p> : null}
              </div>
            </div>
          ) : null}

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={isPending}
              aria-busy={isPending || undefined}
              className="focus-ring inline-flex items-center gap-2 rounded-lg bg-[#8b75ff] px-5 py-2.5 text-xs font-bold text-white shadow-[0_0_24px_rgba(139,117,255,0.35)] transition hover:bg-[#9d8bff] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isPending ? <CircleDashed size={14} className="animate-spin" aria-hidden="true" /> : <Send size={14} aria-hidden="true" />}
              {isPending ? "Sending…" : "Send email"}
            </button>
            <p className="inline-flex items-center gap-1.5 text-[11px] text-slate-500"><Mail size={12} aria-hidden="true" />A sent email cannot be recalled.</p>
          </div>
        </form>
      )}
    </div>
  );
}
