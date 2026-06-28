# WMS BOM Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add BOM management endpoints and UI, including automatic path alias regeneration.

**Architecture:** Extend the existing products module with BOM query builders and service methods. `PUT /products/{id}/bom` replaces rows through raw SQL and calls `fn_regen_path_aliases()` immediately after modifying `bom_line`. The frontend extends the current product management panel with BOM rows, path aliases, and where-used data.

**Tech Stack:** TypeScript, NestJS, PostgreSQL raw SQL, React, Ant Design, TanStack Query.

## Global Constraints

- Do not edit `docs/wms_schema_v1.7.sql`, `docs/wms_procedures_v1.7.sql`, or `docs/wms_logic_v1.7.sql`.
- Do not update or delete `inventory` or `stock_movement`.
- Any successful BOM mutation must call `fn_regen_path_aliases()`.
- `where-used` must call `fn_where_used()`.
- ADMIN/BOSS actions must be enforced by backend guards.

---

### Task 1: BOM Query Builders

- [x] Add failing tests for BOM query builders.
- [x] Implement BOM list/update/regen/where-used/path-alias query builders.

### Task 2: Backend BOM Endpoints

- [x] Extend `ProductsService` with BOM, path alias, and where-used methods.
- [x] Extend `ProductsController` with `GET /products/:id/bom`, `PUT /products/:id/bom`, `GET /products/:id/where-used`, and `GET /products/:id/path-aliases`.
- [x] Add `POST /bom/regenerate-aliases`.

### Task 3: Frontend BOM API

- [x] Add failing tests for BOM URL/request helpers.
- [x] Implement `apps/web/src/bomApi.ts`.

### Task 4: Frontend BOM Editor

- [x] Extend product management detail with BOM rows.
- [x] Add ADMIN/BOSS controls to replace BOM rows.
- [x] Show path aliases and where-used data.

### Task 5: Verification

- [x] Run tests, typecheck, and build.
- [x] Reset DB and verify BOM API with operator/admin JWTs.
- [x] Verify changing BOM regenerates path aliases and search sees the new alias.
- [x] Verify UI renders BOM data in a browser.
- [x] Grep application code for disallowed `UPDATE`/`DELETE` inventory writes.

### Task 6: Commit

- [x] Commit and push the completed BOM management slice.
