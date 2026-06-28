# WMS Reports Export Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build slice 9-A: authenticated reports and Excel export.

**Architecture:** Add a focused NestJS reports controller/service/query module for read-only movement and inventory aggregation. Add a small React report API helper and one Reports view inside the existing Vite app.

**Tech Stack:** TypeScript, NestJS, PostgreSQL raw SQL via `pg`, React, Vite, Ant Design, TanStack Query, ExcelJS.

## Global Constraints

- Inventory writes must use `op_*` stored procedures.
- Application code must not `UPDATE` or `DELETE` `inventory` or `stock_movement`.
- Do not modify `docs/wms_schema_v1.7.sql`, `docs/wms_procedures_v1.7.sql`, or `docs/wms_logic_v1.7.sql`.
- Reports are authenticated but open to all logged-in roles.
- Keep this module to reports/export only; imports, price, scheduler, and permission hardening are later 9-B through 9-E work.

---

### Task 1: Backend Reports Queries

**Files:**
- Create: `apps/api/src/reports/reports-queries.ts`
- Test: `apps/api/src/reports/reports-queries.spec.ts`

**Interfaces:**
- Produces: `parseReportRange(value)`, `buildPeriodReportQuery(range)`, `buildDeadStockQuery()`, `buildSlotUtilizationQuery()`, `buildExportInventoryQuery()`, `buildExportMovementsQuery()`

- [ ] Write failing Vitest tests that require valid range parsing and select-only SQL for all report/export query builders.
- [ ] Run `pnpm --filter @zr-wms/api test -- src/reports/reports-queries.spec.ts` and confirm the module is missing.
- [ ] Implement the query builders with PostgreSQL `SELECT` statements only.
- [ ] Re-run the same test and confirm green.

### Task 2: Backend Reports Service and Controller

**Files:**
- Create: `apps/api/src/reports/reports.service.ts`
- Create: `apps/api/src/reports/reports.controller.ts`
- Modify: `apps/api/src/app.module.ts`
- Modify: `apps/api/package.json`
- Modify: `pnpm-lock.yaml`

**Interfaces:**
- Consumes Task 1 query builders.
- Produces authenticated `GET /reports/period`, `GET /reports/dead-stock`, `GET /reports/slot-utilization`, `POST /export`.

- [ ] Add `exceljs` to `@zr-wms/api`.
- [ ] Implement service methods that map numeric text to numbers and generate an `.xlsx` buffer.
- [ ] Implement controller methods guarded by `JwtAuthGuard`.
- [ ] Register the controller and service in `AppModule`.
- [ ] Run API tests and typecheck.

### Task 3: Frontend Report API

**Files:**
- Create: `apps/web/src/reportApi.ts`
- Test: `apps/web/src/reportApi.test.ts`

**Interfaces:**
- Produces: `buildPeriodReportUrl(range)`, `buildDeadStockUrl(days)`, `getPeriodReport`, `getDeadStockReport`, `getSlotUtilizationReport`, `downloadExport`.

- [ ] Write failing URL/export request tests.
- [ ] Run `pnpm --filter @zr-wms/web test -- src/reportApi.test.ts` and confirm red.
- [ ] Implement the report API helpers.
- [ ] Re-run the test and confirm green.

### Task 4: Frontend Reports View

**Files:**
- Modify: `apps/web/src/App.tsx`
- Modify: `apps/web/src/styles.css`

**Interfaces:**
- Consumes Task 3 helpers.
- Produces a Reports tab with period, dead-stock, slot-utilization tables and export buttons.

- [ ] Add a `reports` active view and navigation item.
- [ ] Fetch reports with TanStack Query when logged in.
- [ ] Add export buttons for inventory, movements, and period report.
- [ ] Keep layout mobile-first and consistent with existing panels/tables.
- [ ] Run web tests, typecheck, build, and browser validation.

### Task 5: Verification and Commit

**Files:**
- Modify: `docs/WMS_实施计划_逐刀指令.md`

- [ ] Run repo tests/build.
- [ ] Search app code for forbidden `UPDATE`/`DELETE` against `inventory` and `stock_movement`.
- [ ] Validate endpoints with `curl` using a logged-in token.
- [ ] Validate Reports UI in browser.
- [ ] Mark slice 9-A complete in the roadmap.
- [ ] Run `git branch --show-current && git rev-parse --show-toplevel`, commit, and push.
