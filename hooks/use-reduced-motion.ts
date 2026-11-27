"use client";

import { useSyncExternalStore } from "react";

const QUERY = "(prefers-reduced-motion: reduce)";

function subscribe(onChange: () => void) {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return () => undefined;
  const query = window.matchMedia(QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

function readPreference(): boolean {
  return typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia(QUERY).matches;
}

/**
 * True when the administrator asks for reduced motion. Components use it to
 * skip the motion classes they add themselves; the global stylesheet already
 * stops CSS animations. Server rendering assumes no preference.
 */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, readPreference, () => false);
}
