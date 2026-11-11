"use client";

import { Info } from "lucide-react";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * A small contextual explanation. It is a real button so the definition is
 * reachable by keyboard, and the panel is exposed as a tooltip rather than
 * hidden text. Escape closes it and focus returns to the trigger.
 */
export function InfoTip({ label, children, className, align = "left" }: {
  label: string;
  children: ReactNode;
  className?: string;
  align?: "left" | "right";
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const wrapRef = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    if (!open) return;
    function onPointer(event: MouseEvent) {
      if (!wrapRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <span ref={wrapRef} className={cn("relative inline-flex", className)}>
      <button
        ref={triggerRef}
        type="button"
        aria-label={label}
        aria-describedby={open ? id : undefined}
        aria-expanded={open}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onClick={() => setOpen((value) => !value)}
        className="focus-ring grid h-5 w-5 place-items-center rounded-full border border-white/10 bg-white/[0.045] text-slate-400 transition hover:border-[#8b75ff]/45 hover:text-[#ded8ff]"
      >
        <Info size={11} aria-hidden="true" />
      </button>
      {open ? (
        <span
          id={id}
          role="tooltip"
          className={cn(
            "absolute bottom-[calc(100%+8px)] z-50 w-64 rounded-xl border border-[#8b75ff]/30 bg-[#0c1020]/98 px-3 py-2 text-left text-[11px] font-normal normal-case leading-5 tracking-normal text-slate-300 shadow-[0_18px_50px_rgba(0,0,0,0.55)] backdrop-blur",
            align === "right" ? "right-0" : "left-0",
          )}
        >
          {children}
        </span>
      ) : null}
    </span>
  );
}
