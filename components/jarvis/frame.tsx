"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, type ReactNode } from "react";

import { COMMAND_INPUT_ID, ZenoCommandBar } from "@/components/jarvis/core/command-bar";
import { JARVIS_SECTIONS, sectionForPath } from "@/lib/jarvis/sections";
import { cn } from "@/lib/utils";

/**
 * The shell every Jarvis section shares: Zeno's command bar on top, a compact
 * section strip on narrow screens (the sidebar carries the same list on desktop),
 * and a short entrance on each section change.
 */
export function JarvisFrame({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const active = sectionForPath(pathname);

  // "/" focuses Zeno's input from anywhere outside a field, a common command-centre gesture.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))) return;
      const input = document.getElementById(COMMAND_INPUT_ID);
      if (input) {
        event.preventDefault();
        input.focus();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <div className="mx-auto w-full max-w-[1480px] space-y-6 pb-12">
      <ZenoCommandBar />

      <nav aria-label="Jarvis sections" className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 lg:hidden">
        {JARVIS_SECTIONS.map((section) => {
          const current = section.key === active.key;
          return (
            <Link
              key={section.key}
              href={section.href}
              aria-current={current ? "page" : undefined}
              className={cn(
                "focus-ring shrink-0 rounded-full border px-3 py-1.5 text-xs! font-semibold transition",
                current
                  ? "border-[#8b75ff]/45 bg-[#8b75ff]/15 text-[#ded8ff]"
                  : "border-white/10 text-slate-400 hover:text-slate-100",
              )}
            >
              {section.label}
            </Link>
          );
        })}
      </nav>

      <div key={pathname} className="jv-rise">
        {children}
      </div>
    </div>
  );
}
