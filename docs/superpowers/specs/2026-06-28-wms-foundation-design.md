# WMS Foundation Design

## Scope

Initialize the runnable project foundation only. This pass creates a minimal TypeScript monorepo with a NestJS API, a Vite React app, a PostgreSQL setup script, and seed data that proves the existing SQL artifacts can be applied.

## Non-Goals

- No search endpoint or search UI.
- No authentication or role guard implementation.
- No ORM-generated schema.
- No edits to `docs/wms_schema_v1.7.sql`, `docs/wms_procedures_v1.7.sql`, or `docs/wms_logic_v1.7.sql`.

## Architecture

- Root uses `pnpm` workspaces.
- `apps/api` exposes `GET /api/v1/health` and `GET /api/v1/health/db` only, so database connectivity can be checked before any business endpoint exists.
- `apps/web` is a minimal React/Vite shell with Ant Design and TanStack Query installed for later slices.
- `scripts/setup-db.ts` reads `DATABASE_URL`, then executes `schema -> procedures -> logic -> seed` in order.
- `scripts/sql/seed-foundation.sql` inserts a small deterministic fixture set and calls `fn_regen_path_aliases()`.

## Constraints

- PostgreSQL 15+ is required.
- Inventory writes in seed data use `op_inbound()` rather than direct `inventory` or `stock_movement` writes.
- Application code must not regenerate or modify the database schema.
- `DATABASE_URL` is the single connection setting for scripts and API.
