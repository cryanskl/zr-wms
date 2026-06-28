# WMS Stocktakes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Implement the 第 7 刀 stocktake vertical slice from authenticated NestJS endpoints through a React/Ant Design stocktake workflow.

**Architecture:** Add a focused `stocktakes` backend module with query builders, service, controller, and tests. Inventory adjustment stays inside PostgreSQL through `op_apply_stocktake_line`; frontend calls the new endpoints through a small `stocktakeApi.ts` helper and renders a compact stocktake panel in `App.tsx`.

**Tech Stack:** TypeScript, NestJS, PostgreSQL raw SQL via `pg`, React, Vite, Ant Design, TanStack Query, Vitest.

## Global Constraints

- Read and follow `AGENTS.md`.
- Do not modify `docs/wms_schema_v1.7.sql`, `docs/wms_procedures_v1.7.sql`, or `docs/wms_logic_v1.7.sql`.
- Never `UPDATE` or `DELETE` `inventory` or `stock_movement` from application code.
- Applying a stocktake line must call `op_apply_stocktake_line(p_stline, p_operator)`.
- `created_by` and `operator_id` must come from JWT current user, never request body.
- `POST /stocktake-lines/{id}/apply` requires `ADMIN`.
- Run tests, typecheck, build, redline scan, real API verification, and browser verification before commit.

---

### Task 1: Backend Stocktake Queries and Service

**Files:**
- Create: `apps/api/src/stocktakes/stocktake-queries.ts`
- Create: `apps/api/src/stocktakes/stocktakes.service.ts`
- Test: `apps/api/src/stocktakes/stocktake-queries.spec.ts`

**Interfaces:**
- Produces: `buildCreateStocktakeQuery()`, `buildCreateStocktakeLineQuery()`, `buildApplyStocktakeLineQuery()`.
- Produces: `StocktakesService.create(body, userId)`, `StocktakesService.addLine(stocktakeId, body)`, `StocktakesService.applyLine(stlineId, userId)`.

- [x] **Step 1: Write failing query/service tests**

Add tests asserting:
- create inserts `stocktake` with `created_by` from current user.
- line insert computes `system_qty` from `inventory` and returns numeric fields.
- apply calls `op_apply_stocktake_line($1, $2)` with current user.
- SQL has no `UPDATE/DELETE inventory` or `stock_movement`.

Run: `pnpm --filter @zr-wms/api test -- src/stocktakes/stocktake-queries.spec.ts`

Expected: FAIL because files/functions do not exist.

- [x] **Step 2: Implement minimal query builders and service**

Use raw SQL:
- `INSERT INTO stocktake (warehouse_id, status, created_by) ...`
- `INSERT INTO stocktake_line (...) SELECT ..., COALESCE(sum(inventory.qty_on_hand), 0), counted_qty ...`
- `SELECT op_apply_stocktake_line($1::bigint, $2::bigint)::text AS movement_id`

Map stored procedure business errors to `ConflictException`.

- [x] **Step 3: Run backend stocktake tests**

Run: `pnpm --filter @zr-wms/api test -- src/stocktakes/stocktake-queries.spec.ts`

Expected: PASS.

### Task 2: Backend Controller and Module Wiring

**Files:**
- Create: `apps/api/src/stocktakes/stocktakes.controller.ts`
- Modify: `apps/api/src/app.module.ts`

**Interfaces:**
- Consumes: `StocktakesService`.
- Produces routes: `POST /stocktakes`, `POST /stocktakes/:id/lines`, `POST /stocktake-lines/:id/apply`.

- [x] **Step 1: Add controller**

Protect controller with `JwtAuthGuard`.

Use `RolesGuard` + `@Roles('ADMIN')` only on apply.

- [x] **Step 2: Wire module**

Add controller/provider to `AppModule`.

- [x] **Step 3: Run API tests and typecheck**

Run:
- `pnpm --filter @zr-wms/api test`
- `pnpm --filter @zr-wms/api typecheck`

Expected: PASS.

### Task 3: Frontend API Helper

**Files:**
- Create: `apps/web/src/stocktakeApi.ts`
- Create: `apps/web/src/stocktakeApi.test.ts`

**Interfaces:**
- Produces: `createStocktake(token, input)`, `addStocktakeLine(token, stocktakeId, input)`, `applyStocktakeLine(token, stlineId)`.

- [x] **Step 1: Write failing helper tests**

Assert request URLs and JSON bodies:
- `/api/v1/stocktakes`
- `/api/v1/stocktakes/12/lines`
- `/api/v1/stocktake-lines/34/apply`

Run: `pnpm --filter @zr-wms/web test -- src/stocktakeApi.test.ts`

Expected: FAIL because helper does not exist.

- [x] **Step 2: Implement helper**

Use the same `apiFetch` pattern as other frontend API files.

- [x] **Step 3: Run helper test**

Run: `pnpm --filter @zr-wms/web test -- src/stocktakeApi.test.ts`

Expected: PASS.

### Task 4: Frontend Stocktake View

**Files:**
- Modify: `apps/web/src/App.tsx`
- Modify: `apps/web/src/styles.css` only if layout needs a small scoped style.

**Interfaces:**
- Consumes: `stocktakeApi.ts`, existing `getWarehouses`, `getSlots`.
- Produces: a new `stocktakes` segmented view.

- [x] **Step 1: Add view state and mutations**

Add state for current stocktake, product id, warehouse, slot, counted qty, batch id, and line list.

- [x] **Step 2: Render workflow**

Render:
- start stocktake button.
- line form with product, warehouse, slot, counted qty.
- table showing system/count/diff/apply status.
- apply button visible/enabled only for admin users.

- [x] **Step 3: Run frontend tests and typecheck**

Run:
- `pnpm --filter @zr-wms/web test`
- `pnpm --filter @zr-wms/web typecheck`

Expected: PASS.

### Task 5: Verification, Roadmap, Commit

**Files:**
- Modify: `docs/WMS_实施计划_逐刀指令.md`
- Modify: `docs/superpowers/plans/2026-06-28-wms-stocktakes.md`

- [x] **Step 1: Full gates**

Run:
- `pnpm test`
- `pnpm build`
- `rg -n "\\b(UPDATE|DELETE\\s+FROM)\\s+(inventory|stock_movement)\\b|\\b(inventory|stock_movement)\\s+SET\\b" apps scripts -g '!scripts/sql/*.sql' || true`

Expected: tests/build pass and redline scan returns no matches.

- [x] **Step 2: Real API verification**

Against local PostgreSQL:
- create stocktake as operator.
- add line where current stock is 25 and counted is 33, or use current stock + 8.
- verify operator apply is 403.
- apply as admin.
- verify `stock_movement.type = 'ADJUST'` and inventory equals counted qty.
- add another line with counted equal to current stock, apply, verify movement id is null and no new movement created.

- [x] **Step 3: Browser verification**

Open Vite app, login admin, visit “盘点”, create stocktake, add line, see diff, apply.

- [x] **Step 4: Update roadmap and commit**

Mark 第 7 刀 done, then run:
`git branch --show-current && git rev-parse --show-toplevel`
`git add ... && git commit -m "Add stocktake slice" && git push`
