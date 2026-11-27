import { render, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { ZenoCore } from "@/components/jarvis/core/zeno-core";
import { useReducedMotion } from "@/hooks/use-reduced-motion";

const originalMatchMedia = window.matchMedia;

afterEach(() => {
  window.matchMedia = originalMatchMedia;
});

/** Answers the reduced-motion query with the given preference, as a browser does. */
function preferReducedMotion(reduce: boolean) {
  window.matchMedia = ((query: string) => ({
    matches: reduce && query === "(prefers-reduced-motion: reduce)",
    media: query,
    onchange: null,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    addListener: () => undefined,
    removeListener: () => undefined,
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

describe("reduced motion", () => {
  it("reports the administrator's reduced-motion preference", () => {
    preferReducedMotion(true);
    expect(renderHook(() => useReducedMotion()).result.current).toBe(true);
  });

  it("reports no preference when the browser asks for motion", () => {
    preferReducedMotion(false);
    expect(renderHook(() => useReducedMotion()).result.current).toBe(false);
  });

  it("keeps Zeno's core still when reduced motion is requested, and says what state it is in", () => {
    preferReducedMotion(true);
    const { container } = render(<ZenoCore state="analysing" size="lg" />);
    expect(container.querySelector(".jv-orbit")).toBeNull();
    expect(container.querySelector(".jv-orbit-reverse")).toBeNull();
    expect(container.querySelector(".jv-breathe")).toBeNull();
    expect(container.querySelector("svg")).toHaveAccessibleName("Zeno is investigating");
  });

  it("moves Zeno's core while an investigation runs when motion is allowed", () => {
    preferReducedMotion(false);
    const { container } = render(<ZenoCore state="analysing" size="lg" />);
    expect(container.querySelector(".jv-orbit")).not.toBeNull();
    expect(container.querySelector(".jv-breathe")).not.toBeNull();
  });
});
