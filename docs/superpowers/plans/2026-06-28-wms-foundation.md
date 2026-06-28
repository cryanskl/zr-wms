# WMS Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the minimum runnable foundation for the WMS repo so PostgreSQL can be initialized from the existing v1.7 SQL artifacts and the API can prove database connectivity.

**Architecture:** Use a pnpm monorepo with `apps/api`, `apps/web`, and root-level database scripts. The setup script applies SQL in the authoritative order and seeds through stored procedures where inventory changes are needed.

**Tech Stack:** TypeScript, Node, NestJS, React, Vite, Ant Design, TanStack Query, PostgreSQL, `pg`, `tsx`.

## Global Constraints

- Do not edit `docs/wms_schema_v1.7.sql`, `docs/wms_procedures_v1.7.sql`, or `docs/wms_logic_v1.7.sql`.
- Execute SQL in `schema -> procedures -> logic -> seed` order.
- Do not implement search in this slice.
- Do not directly write `inventory` or `stock_movement` from application code or seed data; use `op_*` functions for inventory writes.
- Use `DATABASE_URL` for database connectivity.

---

### Task 1: Project Skeleton

**Files:**
- Create: `package.json`
- Create: `pnpm-workspace.yaml`
- Create: `.gitignore`
- Create: `.env.example`
- Create: `tsconfig.base.json`

- [x] Create root workspace and shared scripts.

### Task 2: API Health Check

**Files:**
- Create: `apps/api/package.json`
- Create: `apps/api/tsconfig.json`
- Create: `apps/api/tsconfig.build.json`
- Create: `apps/api/src/main.ts`
- Create: `apps/api/src/app.module.ts`
- Create: `apps/api/src/health.controller.ts`
- Create: `apps/api/src/database.ts`

- [x] Create a minimal NestJS app with `/api/v1/health` and `/api/v1/health/db`.

### Task 3: Web Shell

**Files:**
- Create: `apps/web/package.json`
- Create: `apps/web/index.html`
- Create: `apps/web/tsconfig.json`
- Create: `apps/web/tsconfig.node.json`
- Create: `apps/web/vite.config.ts`
- Create: `apps/web/src/main.tsx`
- Create: `apps/web/src/App.tsx`
- Create: `apps/web/src/styles.css`

- [x] Create a minimal Vite React shell with the selected stack dependencies.

### Task 4: Database Setup and Seed

**Files:**
- Create: `scripts/setup-db.ts`
- Create: `scripts/sql/seed-foundation.sql`

- [x] Implement ordered SQL execution and deterministic seed data.

### Task 5: Verification

**Commands:**
- `pnpm install`
- `pnpm typecheck`
- `pnpm build`
- `pnpm db:setup` when `DATABASE_URL` points to a PostgreSQL 15+ database.

- [x] Run install, typecheck, and build locally.
- [ ] Run DB setup if a reachable PostgreSQL database is configured.
