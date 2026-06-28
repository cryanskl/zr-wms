# WMS Producible Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Implement 第 8 刀正向产能推衍 from NestJS `GET /products/{id}/producible` through a click-triggered React UI.

**Architecture:** Extend the existing product/BOM module because producible is a product derivation beside BOM, where-used, and path aliases. The backend query builders call only PostgreSQL `fn_max_producible` and `fn_max_producible_deep`; the frontend adds a small API helper and a product detail panel that runs only when the user clicks.

**Tech Stack:** TypeScript, NestJS, PostgreSQL raw SQL via `pg`, React, Vite, Ant Design, TanStack Query, Vitest.

## Global Constraints

- Read and follow `AGENTS.md`.
- Do not modify `docs/wms_schema_v1.7.sql`, `docs/wms_procedures_v1.7.sql`, or `docs/wms_logic_v1.7.sql`.
- This slice is read-only; do not write inventory, stock movement, BOM, or product data.
- Single-level producible must call `fn_max_producible(p_target)`.
- Deep producible must call `fn_max_producible_deep(p_target, p_use_sf_stock)`.
- Frontend must calculate on click, not via an automatically enabled query.
- Run tests, typecheck, build, real API verification, browser verification, and redline scan before commit.

---

### Task 1: Backend Producible Query and Service

**Files:**
- Modify: `apps/api/src/products/bom-queries.ts`
- Modify: `apps/api/src/products/products.service.ts`
- Test: `apps/api/src/products/bom-queries.spec.ts`

**Interfaces:**
- Produces: `buildMaxProducibleQuery()`.
- Produces: `buildMaxProducibleDeepQuery()`.
- Produces: `ProductsService.producible(productId: string, deep?: string, useSfStock?: string)`.

- [x] **Step 1: Write failing tests**

Assert:
- query SQL contains `fn_max_producible` and `fn_max_producible_deep`.
- query SQL does not direct-write `inventory` or `stock_movement`.
- service maps single-level rows to `{ target, maxMake, limiting, limitingOnHand }`.
- service maps deep rows to `{ target, maxMake, limiting, limitingOnHand, limitingDemand }`.
- `useSfStock=false` passes boolean `false`.

Run: `pnpm --filter @zr-wms/api test -- src/products/bom-queries.spec.ts`

Expected: FAIL because new query builders and service method do not exist.

- [x] **Step 2: Implement backend minimal code**

Add query builders:
- `SELECT target, max_make::text, limiting_product, limiting_on_hand::text FROM fn_max_producible($1::text)`
- `SELECT target, max_make::text, limiting_product, limiting_on_hand::text, limiting_demand::text FROM fn_max_producible_deep($1::text, $2::boolean)`

Add `ProductsService.producible()` using `deep === 'true'` and `useSfStock !== 'false'`.

Map database `P0001`/`23514` to `ConflictException`.

- [x] **Step 3: Run backend tests**

Run:
- `pnpm --filter @zr-wms/api test -- src/products/bom-queries.spec.ts`
- `pnpm --filter @zr-wms/api typecheck`

Expected: PASS.

### Task 2: Backend Route

**Files:**
- Modify: `apps/api/src/products/products.controller.ts`

**Interfaces:**
- Consumes: `ProductsService.producible`.
- Produces: `GET /products/:id/producible`.

- [x] **Step 1: Add route before `GET /products/:id`**

Add:
`@Get(':id/producible') producible(@Param('id') productId, @Query('deep') deep, @Query('useSfStock') useSfStock)`.

- [x] **Step 2: Run API typecheck**

Run: `pnpm --filter @zr-wms/api typecheck`

Expected: PASS.

### Task 3: Frontend Producible API Helper

**Files:**
- Modify: `apps/web/src/bomApi.ts`
- Modify: `apps/web/src/bomApi.test.ts`

**Interfaces:**
- Produces: `buildProducibleUrl(productId, options)`.
- Produces: `getProducible(token, productId, options)`.

- [x] **Step 1: Write failing helper tests**

Assert:
- `/api/v1/products/FG-1/producible`
- `/api/v1/products/FG-1/producible?deep=true`
- `/api/v1/products/FG-1/producible?deep=true&useSfStock=false`

Run: `pnpm --filter @zr-wms/web test -- src/bomApi.test.ts`

Expected: FAIL because helper does not exist.

- [x] **Step 2: Implement helper**

Add `ProducibleResult` with fields `target`, `maxMake`, `limiting`, `limitingOnHand`, optional `limitingDemand`.

- [x] **Step 3: Run helper tests**

Run: `pnpm --filter @zr-wms/web test -- src/bomApi.test.ts`

Expected: PASS.

### Task 4: Frontend Product Producible Panel

**Files:**
- Modify: `apps/web/src/App.tsx`

**Interfaces:**
- Consumes: `getProducible`.
- Produces: product detail panel with three explicit calculate buttons.

- [x] **Step 1: Add state and mutation**

Track the latest `ProducibleResult` plus a mode label. Use `useMutation`, not auto `useQuery`, so requests happen only on click.

- [x] **Step 2: Render panel**

In `ProductManagement`, when a product is selected, render:
- “单层计算”
- “深度计算”
- “深度计算（不用半成品库存）”
- result summary: max make, limiting product, limiting on hand, limiting demand if present.

- [x] **Step 3: Run frontend checks**

Run:
- `pnpm --filter @zr-wms/web test`
- `pnpm --filter @zr-wms/web typecheck`

Expected: PASS.

### Task 5: Verification, Roadmap, Commit

**Files:**
- Modify: `docs/WMS_实施计划_逐刀指令.md`
- Modify: `docs/superpowers/plans/2026-06-28-wms-producible.md`

- [x] **Step 1: Full gates**

Run:
- `pnpm test`
- `pnpm build`
- `rg -n "\\b(INSERT|UPDATE|DELETE\\s+FROM)\\s+(inventory|stock_movement)\\b|\\b(inventory|stock_movement)\\s+SET\\b" apps scripts -g '!scripts/sql/*.sql' || true`

Expected: tests/build pass and redline scan returns no matches for application code.

- [x] **Step 2: Real API verification**

Call local API:
- `GET /products/FG-7L0199131F/producible`
- `GET /products/FG-7L0199131F/producible?deep=true`
- `GET /products/FG-7L0199131F/producible?deep=true&useSfStock=false`

Verify responses come from current seeded BOM and differ appropriately after changing a bottleneck through existing inbound if needed.

- [x] **Step 3: Browser verification**

Open Vite app, login admin, select `FG-7L0199131F` in product management, click all three calculate buttons, and verify result text/table updates only after clicks.

- [x] **Step 4: Update roadmap and commit**

Mark 第 8 刀 done, then run:
`git branch --show-current && git rev-parse --show-toplevel`
`git add ... && git commit -m "Add producible capacity slice" && git push`
