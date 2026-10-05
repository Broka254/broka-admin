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

## Reference audit

The public site and `broka-website/.stitch/DESIGN.md` establish the ink-navy, violet, cyan, amber, Montserrat/Inter, compact-controls language. The `broka` backend repository establishes the pattern of separate validation/build jobs and deployment-specific workflows. Those repositories were inspected as read-only references and were not modified.
