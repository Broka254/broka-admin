# BROKA Admin design system

## Direction

The admin dashboard is a **dark intelligence control center**: compact, scannable, and authoritative without looking like a generic blue SaaS template. It preserves the target app’s information architecture and contract-safe states while aligning its visual language with the public Broka website.

## Tokens

| Role | Token | Value |
|---|---|---|
| Canvas | `--broka-bg` | `#05060d` |
| Quiet surface | `--broka-surface` | `#080a14` |
| Raised surface | `--broka-surface-2` | `#0c1020` |
| Card surface | `--broka-surface-3` | `#13182b` |
| Elevated surface | `--broka-surface-4` | `#1a2035` |
| Primary text | `--broka-text` | `#f7f7fc` |
| Secondary text | `--broka-muted` | `#c5cada` |
| Tertiary text | `--broka-subtle` | `#9ba4bc` |
| Primary action | `--broka-violet` | `#8b75ff` |
| Supporting signal | `--broka-cyan` | `#54d7e9` |
| Commerce accent | `--broka-amber` | `#dbb75d` |
| Quiet border | `--broka-outline` | `rgba(195,202,226,.13)` |

## Component rules

- Use an 8px working rhythm and 4px base unit.
- Use Montserrat-like display treatment for headings and Inter/system UI for controls and metadata.
- Use violet for primary actions, active navigation, and focus; cyan for system/information signals; amber only for commerce or attention states.
- Use rounded cards with restrained borders and shallow elevation. Avoid large opaque gradients that compete with operational data.
- Every data surface needs loading, success, empty, error, forbidden, and contract-unavailable states.
- Focus is always visible with a violet outline; status is never communicated by color alone.
- Respect `prefers-reduced-motion`.
- Use the real Broka mark from `/public/brand/broka-mark.png`; do not redraw it with CSS.

## Intelligence surfaces

The founder pages (Command Center cockpit, Intelligence, Growth, Complaints,
Reports) add an instrument-panel layer on the same tokens:

- `holo-panel`: glass surface with a hairline violet→cyan gradient edge. Every
  intelligence section uses it through the `Panel` component
  (`components/intelligence/visuals.tsx`), with an eyebrow, title, one-line
  definition and optional actions.
- `stat-tile`: one metric, its change against the previous period and a
  caption. Changes are green or red by the direction that helps the business
  (fewer complaints is green), always with a signed number and arrow, never
  colour alone.
- `Ring`: circular gauge for a percentage with an amber target tick. No data
  renders "—" and an empty track, never 0%.
- Insight cards: severity is a coloured bar **and** a label (Act now, Watch,
  Opportunity, Context, Working), with the evidence as chips and one action.
- `hero-cockpit` and `cockpit-grid`: the faint instrument grid sits only behind
  the hero and report headers, masked so it never runs under data.
- Drawers and the Ctrl/⌘K palette trap focus, close on Escape and return focus
  to where it was. Motion (`live-dot`, drawer and palette entry, ring fill) is
  disabled under `prefers-reduced-motion`.
- Reports print as plain documents: the shell is hidden and ink is dark on
  white (`@media print` in `app/globals.css`).

## Reference audit

The public site and `broka-website/.stitch/DESIGN.md` establish the ink-navy, violet, cyan, amber, Montserrat/Inter, compact-controls language. The `broka` backend repository establishes the pattern of separate validation/build jobs and deployment-specific workflows. Those repositories were inspected as read-only references and were not modified.
