# BROKA NEXUS — Visual Design System

**Status:** Approved direction / implementation baseline  
**Repository:** `Broka254/broka-admin`  
**Branch:** `feat/nexus-admin-redesign`  
**Product direction:** NEXUS — Futuristic Intelligence Center  
**Motion profile:** Immersive, with mandatory reduced-motion support

## 1. Design intent

BROKA NEXUS is a premium founder and operations intelligence environment. It should feel like a precise, high-end command system—not a generic SaaS admin template and not a noisy science-fiction prop.

The interface is data-first. Cinematic lighting, glass, motion, and ambient effects establish atmosphere, while hierarchy, readable labels, clear actions, and trustworthy data remain dominant.

## 2. Brand and visual language

Retain BROKA's established ink-navy, violet, cyan, and restrained amber identity. Extend it consistently rather than introducing an unrelated palette.

| Role | Token | Value | Use |
|---|---|---|---|
| Deep canvas | `--nexus-void` | `#03040A` | App background |
| Main canvas | `--nexus-ink` | `#070916` | Workspace background |
| Surface | `--nexus-surface` | `#0B1020` | Navigation and panels |
| Raised surface | `--nexus-raised` | `#11182B` | Cards and popovers |
| Elevated surface | `--nexus-elevated` | `#18213A` | Focused/active layers |
| Primary text | `--nexus-text` | `#F5F7FF` | Headlines and key values |
| Secondary text | `--nexus-muted` | `#B4BED3` | Supporting copy |
| Tertiary text | `--nexus-subtle` | `#8491AC` | Metadata; never critical instructions |
| Primary accent | `--nexus-violet` | `#947BFF` | Primary action, focus, active state |
| System signal | `--nexus-cyan` | `#55DDF2` | System/AI information |
| Success | `--nexus-emerald` | `#38D9A5` | Verified healthy/success states |
| Attention | `--nexus-amber` | `#E7BD68` | Warnings and commerce context |
| Critical | `--nexus-rose` | `#FF718D` | Errors and urgent risk |
| Hairline | `--nexus-border` | `rgba(190, 203, 232, .12)` | Subtle boundaries |

Implementation rule: map these tokens to the existing `--broka-*` variables or migrate existing consumers deliberately. Do not create competing token systems or mass-replace established tokens without checking usage.

## 3. Layout and navigation

### Desktop
- Persistent, collapsible primary navigation with clear groups, active route, labels, and tooltips when collapsed.
- A compact command header for page title, global search/command access, notifications, API health, and account actions.
- A flexible workspace with a consistent content width, deliberate grid, and predictable section spacing.
- Optional contextual side panels only when they add useful workflow context.

### Mobile and tablet
- Replace the desktop sidebar with an accessible drawer or compact navigation pattern.
- Keep page title and primary actions reachable without horizontal scrolling.
- Use responsive metric grids; horizontal scrolling is reserved for genuinely comparable metric rails.
- Tables must expose useful mobile alternatives or controlled horizontal scrolling with clear affordance.
- Avoid desktop-sized charts/cards squeezed into a phone viewport.

### Navigation behavior
- Preserve every existing route, permission check, and destination.
- Show active location and current workspace context.
- Keyboard-operable controls, visible focus, Escape-to-close overlays, focus return, and sensible tab order are required.
- Do not hide essential navigation behind icon-only controls without accessible names.

## 4. Surface and component language

- **Command canvas:** layered dark surfaces with a restrained radial glow; no full-screen distracting gradients.
- **Glass panels:** translucent backgrounds and subtle blur only where contrast and device performance remain good.
- **Instrument panels:** crisp borders, quiet inner highlights, and consistent section headers.
- **Metric modules:** one primary value, clear label, time window/source context, comparison where supported, and an explicit unavailable state.
- **Charts:** clear axes, units, legends, tooltips, empty states, and responsive sizing. Color is not the only encoding.
- **AI insight modules:** visually distinct from measured facts; include evidence/source context, confidence only when supplied by the backend, and a clear action or dismissal.
- **Status indicators:** always pair color with text/icon/shape. Never imply that a service is healthy from a static decorative indicator.
- **Dialogs and drawers:** restrained overlays, clear close behavior, focus management, and scroll containment.

Prefer the existing components and classes where they already satisfy this system. Consolidate duplicate patterns instead of adding parallel versions.

## 5. Typography and spacing

- Use the repository's self-hosted Inter variable font for interface text and Montserrat variable font for display headings.
- Use tabular numerals for metrics, timestamps, and financial values.
- Use an 8px spacing rhythm with a 4px base unit.
- Establish clear page title, section title, card title, body, and metadata levels.
- Avoid tiny uppercase text for important information; reserve tracked uppercase labels for short eyebrows and metadata.

## 6. Motion system — immersive, controlled

Motion should communicate state, depth, hierarchy, and causality. It must not compete with reading or data interpretation.

### Allowed motion patterns
- Workspace entry: short opacity/position transition; no long cinematic page intro.
- Navigation: responsive drawer/collapse transitions with clear active-state movement.
- Panels: subtle hover elevation and border/light response on pointer-capable devices.
- Data updates: brief value emphasis or chart transition after a real update.
- Live signals: restrained pulse for a genuinely live/connected source, with textual status.
- AI activity: explicit processing/streaming states tied to actual work.
- Dialogs: short fade/scale or slide with focus behavior.

### Motion constraints
- Prefer transform and opacity; avoid continuous layout animation and expensive blur/filter animation.
- Avoid perpetual particle fields, flashing, aggressive parallax, auto-scrolling, and decorative movement behind dense data.
- Never animate a fabricated live signal, fake AI response, or placeholder metric.
- Keep interaction feedback immediate; do not delay actions for animation.
- Use consistent short durations and easing; motion must remain smooth on mid-range mobile devices.
- Honor `prefers-reduced-motion: reduce` across CSS and JavaScript-driven motion. Replace movement with immediate state changes or subtle opacity changes.
- Avoid autoplay sound and forced motion.

## 7. Data integrity and AI boundaries

- Backend responses remain the sole source of operational/business facts.
- Do not invent metrics, trends, alerts, service health, user activity, AI analysis, or confidence scores.
- Keep existing contract-unavailable, loading, empty, error, forbidden, and success states.
- Distinguish measured facts, backend-generated insights, and explanatory UI copy.
- AI controls must invoke existing authorized capabilities. Do not create a visual-only command that appears operational.
- Preserve authentication, HttpOnly cookie handling, server-side proxy allowlists, role/permission checks, and API boundaries.
- Never add direct browser-to-database access or expose backend secrets/tokens.

## 8. Accessibility and performance

- Target WCAG 2.2 AA contrast and keyboard usability.
- Semantic landmarks, ordered headings, accessible names, visible focus, and announced async states.
- Respect system reduced-motion preferences; test with reduced motion enabled.
- Test at 320px, 360px, 390px, tablet, and wide desktop widths.
- Avoid excessive backdrop filters, oversized canvas effects, and animation loops that continue off-screen.
- Use lazy loading for expensive visualizations where appropriate.
- No regressions to route navigation, authentication, or existing interactions.

## 9. Definition of done

A NEXUS component is complete only when:
1. It has a clear purpose and information hierarchy.
2. It uses shared design tokens and reusable components.
3. It works on mobile, tablet, and desktop.
4. It supports keyboard and screen-reader use.
5. It respects reduced-motion settings.
6. It renders honest loading, empty, error, forbidden, and unavailable states as applicable.
7. It preserves existing API contracts and permissions.
8. Its interactions work; no decorative control is presented as functional.
9. Relevant tests, typecheck, lint, and production build pass.
