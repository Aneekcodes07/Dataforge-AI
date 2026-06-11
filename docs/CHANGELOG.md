# DataForge AI — Changelog

> All notable changes to this project.

---

## [0.1.1] — 2026-06-10

### Changed
- **Global Spacing System** — Standardized all margins, paddings, and gaps to align with the 4, 8, 12, 16, 24, 32, 48, 64px scale.
- **Typography hierarchy** — Configured `.font-hero`, `.font-h1`, `.font-h2`, `.font-h3`, `.font-body`, `.font-small` classes in `index.css`.
- **Component sizes** — Uniform inputs and buttons heights (38px-40px) and border radius (8px).
- **Sidebar width** — Reduced width to 240px (expanded) and 64px (collapsed) for improved visual weight.

### Improved
- **Landing page density** — Decreased dead space and section padding (`py-12` / `py-16`). Alternated section backgrounds and borders for smooth transitions.
- **Mockup screenshot prominence** — Increased width limits on ProductPreview browser mockup to 680px.
- **Dashboard Information Density** — Placed Quick Start ingestion buttons in a single row (`lg:grid-cols-6`) and aligned Recent Projects columns.
- **Auth screen hierarchy** — Standardized uppercase tracking labels, warning alerts, and form layouts.

### Fixed
- **Timeline connector alignment** — Fixed timeline line coordinates center in Activity Feed (`left-[28px]`).
- **Signup Page JSX tags** — Resolved unclosed tag compile errors in `SignupPage.tsx`.

## [0.1.0] — 2026-06-09

### Added
- **Frontend scaffolding** — Vite + React 19 + TypeScript + TailwindCSS v4
- **Design system** — Dark-first glassmorphic design tokens, animation keyframes, utility classes
- **Layout shell** — Collapsible sidebar (280px → 72px), top navbar with breadcrumbs and notifications
- **Landing page** — Hero with animated gradient mesh, typewriter headlines, How It Works, Features Grid, Agent Network Preview, CTA + Footer
- **Authentication** — Login and Signup pages with mock localStorage auth, password strength indicator, social login buttons
- **Dashboard** — Stats cards with SVG sparklines, Quick Start source selector, Recent Projects table, Activity Feed timeline
- **Routing** — React Router v6 with lazy loading, protected routes, public route redirects
- **State management** — Zustand stores for auth (persisted) and UI state
- **API client** — Typed fetch wrapper with auth injection and error handling
- **Backend skeleton** — FastAPI with health check, mock auth endpoints, mock project listing
- **Documentation** — PROJECT_LOG, PROJECT_STATE, DECISIONS, ARCHITECTURE, CHANGELOG, ROADMAP
