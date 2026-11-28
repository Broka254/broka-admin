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
