// The Jarvis workspace's sections. One list feeds the desktop sidebar, the
// mobile section strip, the command bar's suggestions and the route checks in
// the tests, so a section cannot appear in one place and be missing in another.

export type JarvisSectionKey =
  | "command"
  | "core"
  | "business"
  | "marketplace"
  | "trust"
  | "operations"
  | "studio"
  | "live";

export type JarvisSection = {
  key: JarvisSectionKey;
  label: string;
  href: string;
  /** Where the command bar's input is aimed on this section. */
  placeholder: string;
  /** Questions offered as chips on this section. They fill the input; the administrator sends them. */
  suggestions: readonly string[];
};

export const JARVIS_SECTIONS: readonly JarvisSection[] = [
  {
    key: "command",
    label: "Command Centre",
    href: "/assistant",
    placeholder: "Ask Zeno what changed",
    suggestions: ["What changed most this week?", "Which signals need attention first?"],
  },
  {
    key: "core",
    label: "Intelligence Core",
    href: "/assistant/core",
    placeholder: "Ask what Zeno can investigate",
    suggestions: ["What needs attention first?", "What changed since the last briefing?"],
  },
  {
    key: "business",
    label: "Business Intelligence",
    href: "/assistant/business",
    placeholder: "Ask about revenue or growth",
    suggestions: ["How did platform revenue move against the previous window?", "What is driving failed payments?"],
  },
  {
    key: "marketplace",
    label: "Marketplace Intelligence",
    href: "/assistant/marketplace",
    placeholder: "Ask about listings or demand",
    suggestions: ["Which categories show unserved demand?", "Where is supply running short?"],
  },
  {
    key: "trust",
    label: "Trust & Safety",
    href: "/assistant/trust",
    placeholder: "Ask about disputes or fraud",
    suggestions: ["Which trust signals need review first?", "Are complaints slipping past their deadline?"],
  },
  {
    key: "operations",
    label: "Operations Intelligence",
    href: "/assistant/operations",
    placeholder: "Ask about service health",
    suggestions: ["Which operational figures are outside their normal range?", "Is API latency rising?"],
  },
  {
    key: "studio",
    label: "Investigation Studio",
    href: "/assistant/studio",
    placeholder: "Continue the investigation",
    suggestions: [],
  },
  {
    key: "live",
    label: "Live Intelligence Feed",
    href: "/assistant/live",
    placeholder: "Ask about these alerts",
    suggestions: ["What changed in the last hour?", "Which alerts are still open?"],
  },
] as const;

/** The section a pathname belongs to. Unknown paths fall back to the Command Centre. */
export function sectionForPath(pathname: string): JarvisSection {
  const normalised = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  // The longest matching href wins. "/assistant" is a prefix of every section,
  // so a first match in list order would always return the Command Centre.
  const longestFirst = [...JARVIS_SECTIONS].sort((a, b) => b.href.length - a.href.length);
  return (
    longestFirst.find((section) => normalised === section.href || normalised.startsWith(`${section.href}/`)) ??
    JARVIS_SECTIONS[0]
  );
}
