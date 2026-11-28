# BROKA NEXUS — Frontend Implementation Plan

**Target:** `Broka254/broka-admin`  
**Base:** `main`  
**Working branch:** `feat/nexus-admin-redesign`  
**Status:** Planning baseline; no backend/API changes authorized by this plan.

## Guiding rule

Deliver a coherent redesign in small, reviewable slices. Establish the global shell and reusable visual primitives first, then redesign each workspace using its actual purpose and available API data. Do not rewrite every page at once.

## Phase 0 — Baseline and inventory

1. Map all routes, layout groups, navigation items, role/permission gates, and shared components.
2. Record current behavior and data dependencies for each route.
3. Identify existing components/classes worth retaining (`holo-panel`, `instrument-panel`, `stat-tile`, `hero-cockpit`, existing charts, drawers, command palette, and status components).
4. Capture desktop and mobile screenshots for representative pages.
5. Run existing tests, typecheck, lint, and production build; record pre-existing failures separately.
6. Create a route/component checklist so no admin surface is silently omitted.

**Exit gate:** a verified inventory and baseline. No functional changes in this phase.


## Verified repository inventory (main branch)

### Route entry points

The current App Router contains these page entry points:

| Route | Source page |
|---|---|
| `/login` | `app/(auth)/login/page.tsx` |
| `/` | `app/(dashboard)/page.tsx` |
| `/alerts` | `app/(dashboard)/alerts/page.tsx` |
| `/assistant` | `app/(dashboard)/assistant/page.tsx` |
| `/assistant/business` | `app/(dashboard)/assistant/business/page.tsx` |
| `/assistant/core` | `app/(dashboard)/assistant/core/page.tsx` |
| `/assistant/live` | `app/(dashboard)/assistant/live/page.tsx` |
| `/assistant/marketplace` | `app/(dashboard)/assistant/marketplace/page.tsx` |
| `/assistant/operations` | `app/(dashboard)/assistant/operations/page.tsx` |
| `/assistant/studio` | `app/(dashboard)/assistant/studio/page.tsx` |
| `/assistant/trust` | `app/(dashboard)/assistant/trust/page.tsx` |
| `/communications` | `app/(dashboard)/communications/page.tsx` |
| `/complaints` | `app/(dashboard)/complaints/page.tsx` |
| `/email-reply` | `app/(dashboard)/email-reply/page.tsx` |
| `/growth` | `app/(dashboard)/growth/page.tsx` |
| `/intelligence` | `app/(dashboard)/intelligence/page.tsx` |
| `/market` | `app/(dashboard)/market/page.tsx` |
| `/operations` | `app/(dashboard)/operations/page.tsx` |
| `/production-costs` | `app/(dashboard)/production-costs/page.tsx` |
| `/reports` | `app/(dashboard)/reports/page.tsx` |
| `/reports/builder` | `app/(dashboard)/reports/builder/page.tsx` |
| `/revenue` | `app/(dashboard)/revenue/page.tsx` |
| Additional legacy/admin destinations | `app/(dashboard)/[...slug]/page.tsx` catch-all |

The shared dashboard route group is protected by `app/(dashboard)/layout.tsx`, which calls `requireAdminSession()` and passes the verified admin identity into `AdminShell`. Jarvis routes share `app/(dashboard)/assistant/layout.tsx`, which mounts `JarvisProvider` and `JarvisFrame`.

### Navigation groups found in the shell

The existing `components/layout/admin-shell.tsx` defines these groups and destinations. Preserve them unless an explicit product decision changes the information architecture:

- **Jarvis Mode:** Command Centre, Intelligence Core, Business Intelligence, Marketplace Intelligence, Trust & Safety, Operations Intelligence, Investigation Studio, Live Intelligence Feed.
- **Founder:** Command Center, Intelligence, Growth, Market Intelligence, Reports, Report Builder.
- **Respond:** Complaints, Email Reply, Alert Centre.
- **Marketplace:** Listings, Deals, Stores.
- **Identity:** All Users, Admins.
- **Trust & Safety:** Fraud, Disputes.
- **Money:** Revenue, Production Costs, Payments, Finance Integrity, Transactions, Escrow, Commissions.
- **Zeno:** AI Activity, Negotiations, AI Savings.
- **Analytics:** Platform, Marketplace, Users.
- **System:** Service Communications, Operations, Service Health, Audit Logs, Diagnostics, Events, Workflow Versions, Settings.

The catch-all route means the page-file inventory alone is not a complete list of navigable destinations. The navigation configuration and `lib/workspaces.ts` must also be audited before sign-off.

### Existing implementation touchpoints

| Concern | Existing source | NEXUS approach |
|---|---|---|
| Global dashboard shell and navigation | `components/layout/admin-shell.tsx` | First visual implementation target; preserve route matching, search palette, alert/complaint badges, API/stream status, logout, and responsive drawer behavior. |
| Dashboard auth boundary | `app/(dashboard)/layout.tsx`, `lib/auth/session.ts` | Treat as protected infrastructure; no visual refactor should alter session checks. |
| Jarvis shared frame | `components/jarvis/frame.tsx` | Align its section navigation and Zeno command bar with the new shell without duplicating navigation. |
| Jarvis session state | `components/jarvis/provider.tsx`, `hooks/use-jarvis.ts` | Preserve current session and command semantics; do not invent AI actions. |
| Global tokens and component styling | `app/globals.css` | Extend existing BROKA tokens and primitives; avoid competing palettes. |
| Existing motion preference | `hooks/use-reduced-motion.ts` and global CSS | Reuse and verify; do not introduce a second preference hook. |
| Shared dashboard primitives | `components/ui/primitives.tsx`, `components/intelligence/visuals.tsx`, `components/jarvis/ui/primitives.tsx` | Consolidate selectively after checking consumers; preserve honest data-state rendering. |
| Route metadata and fonts | `app/layout.tsx` | Retain self-hosted Inter and Montserrat fonts and existing metadata behavior. |

### Verified baseline constraints

- Next.js 15 App Router, React 19, Tailwind CSS 4, Recharts, Lucide icons, TanStack Query, and Zod are already present.
- No animation library is currently listed in `package.json`; begin with CSS and existing React patterns. Add a dependency only if a concrete interaction cannot be implemented well with the current stack.
- Existing global CSS already includes a reduced-motion media query and Jarvis motion primitives.
- The authenticated shell intentionally does not use localStorage or sessionStorage for tokens or recent routes. Keep that security constraint intact.
- The current shell already has desktop collapse and a mobile drawer. NEXUS should improve their visual quality and interaction details, not replace working behavior without reason.
- The current Jarvis frame has its own compact mobile section strip. Coordinate this with the global shell so users do not receive redundant navigation.

## Phase 0 findings and first-slice decision

The initial inventory confirms that the highest-leverage first implementation is the global shell, not an immediate rewrite of every dashboard. The first code slice should target:

1. `app/globals.css` — NEXUS tokens, reusable surface primitives, and restrained motion primitives.
2. `components/layout/admin-shell.tsx` — desktop navigation, mobile drawer, header, and workspace frame.
3. `components/jarvis/frame.tsx` — consistent Jarvis section navigation and shared command workspace.
4. Focused tests for shell navigation, drawer state, keyboard behavior, and reduced-motion handling.

Do not change `app/(dashboard)/layout.tsx`, auth/session modules, API proxy routes, or backend contracts for visual reasons. Before coding, inspect the full relevant component implementations and their tests, then capture baseline verification on the feature branch.

## Phase 1 — NEXUS foundation and global shell

1. Implement the NEXUS token layer in the existing global CSS, mapping to established BROKA tokens rather than creating competing values.
2. Redesign the app shell: responsive navigation, compact command header, workspace frame, page header, breadcrumbs/context, and mobile drawer.
3. Standardize buttons, icon buttons, inputs, tabs, badges/statuses, panels, metric modules, empty/loading/error states, drawers, and dialogs.
4. Establish the motion primitives and reduced-motion behavior.
5. Preserve existing routes, search/command palette, notifications, API health semantics, authentication, and permission boundaries.
6. Add or update focused component tests for navigation, mobile drawer, keyboard behavior, and state rendering.

**Exit gate:** every existing route is reachable; the shell is usable at phone/tablet/desktop widths; no API or auth contract changes.

## Phase 2 — Command Center / founder cockpit

1. Redesign the founder cockpit hierarchy: clear executive summary, date/window controls, verified health/alert state, decision priorities, and key marketplace indicators.
2. Use a deliberate responsive composition instead of a long stack of visually identical cards.
3. Improve gauges, trend visualizations, and insight/decision cards with source/time-window context.
4. Make all drill-down actions navigate to existing destinations.
5. Preserve backend-provided values and explicit no-cohort/empty/unavailable states.

**Exit gate:** Command Center is visually complete and every metric/action is traceable to an existing source or clearly marked unavailable.

## Phase 3 — Workspace-by-workspace redesign

Implement and review each surface separately, sharing primitives but not forcing identical page layouts:

- Intelligence Core
- Business Intelligence
- Marketplace Intelligence
- Trust & Safety
- Operations Intelligence
- Investigation Studio
- Live Intelligence Feed
- Growth
- Reports and Report Builder
- Complaints
- Email Reply
- Communications and Alerts, plus any other routes found in the Phase 0 inventory

For each page: inspect its current data contract and permissions, define the key user tasks, create a page-specific hierarchy, improve relevant visualizations/tables/forms, and verify all states and actions.

**Exit gate:** route inventory is complete; no page is merely a reskinned generic card grid.

## Phase 4 — Contextual intelligence and interaction polish

1. Add contextual AI insight surfaces only where the backend already provides relevant AI/analysis capabilities.
2. Make AI output distinguishable from measured facts and include evidence/source context when available.
3. Connect commands and recommendations to real, authorized actions; otherwise label them as guidance rather than executable controls.
4. Add meaningful motion to navigation, data updates, AI processing, drawers, and feedback.
5. Add a final accessibility, performance, and responsive pass.

**Exit gate:** all controls work, no fake live/AI states, reduced-motion is honored, and interactions remain responsive on mobile.

## Phase 5 — Verification and release readiness

Run:
- `pnpm test`
- `pnpm typecheck`
- `pnpm lint`
- `pnpm build`

Also verify:
- Login, refresh, logout, protected-route handling, and permission gates.
- Existing API proxy allowlist and HttpOnly cookie behavior.
- All navigation destinations and keyboard interactions.
- 320px/360px/390px phone, tablet, laptop, and wide desktop layouts.
- Loading, empty, error, forbidden, and contract-unavailable states.
- Reduced-motion preference and no unintended continuous animation.
- Chart labels, units, tooltips, and data provenance.

Document any pre-existing failures separately; do not hide or bypass them to make the redesign appear green.

## Scope boundaries

- Frontend-only visual/interaction work unless a specific backend contract gap is identified and separately approved.
- No database access from the browser.
- No new API endpoints, schema assumptions, fabricated analytics, mock production activity, or fake AI functionality.
- No changes to auth/token/cookie/security architecture as part of visual work.
- Do not deploy to Railway or merge to `main` without explicit approval.
- Work on the feature branch and submit a reviewable pull request when the first implementation slice is ready.

## First implementation slice

Start with Phase 0 inventory and Phase 1 global shell only. Before modifying page-specific dashboards, report:
1. the complete route/navigation inventory;
2. the shared shell/component files selected for change;
3. the proposed responsive navigation behavior;
4. baseline test/build results;
5. any risks to existing auth, route, or API behavior.

Then implement the shell as a small reviewable change and provide before/after screenshots for desktop and mobile.
