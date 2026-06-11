# DataForge AI — Technical Decisions

> All major technical decisions with rationale. Reference this before making architectural changes.

---

## D001 — Authentication Strategy
**Decision:** Mock auth with localStorage for Phase 1
**Rationale:** Fastest path to a working UI. The auth store interface is designed so swapping to JWT + database requires only changing the `login`/`signup` implementations — no UI changes needed.
**Migration Path:** Phase 3+ → SQLite + JWT → Phase 6 → PostgreSQL

## D002 — CSS Framework
**Decision:** TailwindCSS v4 with `@tailwindcss/vite` plugin
**Rationale:** v4 uses CSS-native `@theme` blocks instead of JS config. Simpler setup, better performance, no `tailwind.config.js` needed.

## D003 — State Management
**Decision:** Zustand for UI/auth state, TanStack Query for server state (Phase 2+)
**Rationale:** Zustand is lightweight and boilerplate-free. TanStack Query handles caching, invalidation, and deduplication for API calls. This split is the 2025/26 gold standard.

## D004 — Animation Library
**Decision:** Motion (Framer Motion v12+) from `motion/react`
**Rationale:** Spring-based animations feel natural and can be interrupted mid-flight. AnimatePresence for exit animations. Layout animations for sidebar.

## D005 — Build Tool
**Decision:** Vite over Next.js
**Rationale:** DataForge is a SPA/dashboard app, not content-heavy. No SSR needed. Vite gives fastest DX with HMR.

## D006 — Backend Framework
**Decision:** FastAPI over Flask/Django
**Rationale:** Native async, automatic OpenAPI docs, Pydantic validation, best for AI/ML workloads.

## D007 — Architecture Pattern
**Decision:** Feature-based modules (not layer-based)
**Rationale:** Each domain (auth, extraction, cleaning) has its own router/service/schemas. Scales better, easier to navigate, clearer ownership.

## D008 — Dark Mode
**Decision:** Dark mode as default and only theme (Phase 1)
**Rationale:** Enterprise data tools are used for long sessions. Dark mode reduces eye strain and feels premium. Light mode toggle can be added in Phase 6.

## D009 — Design Aesthetic
**Decision:** Glassmorphism + gradient accents
**Rationale:** Creates depth without visual clutter. Inspired by Linear, Notion, and Stripe. Premium feel without being flashy.
