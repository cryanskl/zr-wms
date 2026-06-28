# WMS Product Master Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add product master data endpoints and a minimal authenticated product management UI.

**Architecture:** Add a focused `products` backend module with raw SQL query builders and a service that maps database conflicts to Chinese HTTP errors. Add a frontend `productApi.ts` and a product management view inside the existing authenticated React app. BOM editing is deliberately excluded.

**Tech Stack:** TypeScript, NestJS, PostgreSQL raw SQL, React, Ant Design, TanStack Query.

## Global Constraints

- Do not edit `docs/wms_schema_v1.7.sql`, `docs/wms_procedures_v1.7.sql`, or `docs/wms_logic_v1.7.sql`.
- Do not update or delete `inventory` or `stock_movement`.
- ADMIN/BOSS actions must be enforced by backend guards.
- Alias add/delete is allowed for every logged-in role.
- Product images store URL only; object storage upload is out of scope.

---

### Task 1: Backend Query Builders

- [x] Add query builder tests for product list/detail and mutation statements.
- [x] Implement `apps/api/src/products/product-queries.ts`.

### Task 2: Backend Controller And Service

- [x] Implement `ProductsService` for list/detail/create/update/soft-delete/alias/image actions.
- [x] Implement `ProductsController` with JWT and role guards.
- [x] Register products controller/service in `AppModule`.

### Task 3: Frontend Product API

- [x] Add failing URL/request builder tests.
- [x] Implement `apps/web/src/productApi.ts`.

### Task 4: Frontend Product Management View

- [x] Add a product management tab to the authenticated app.
- [x] Add list/detail filters and ADMIN/BOSS create/edit/soft-delete controls.
- [x] Add alias controls for all logged-in roles and image URL controls for ADMIN/BOSS.

### Task 5: Verification

- [x] Run tests, typecheck, and build.
- [x] Reset DB and verify product API with operator/admin JWTs.
- [x] Verify the UI renders product management data in a browser.
- [x] Grep application code for disallowed `UPDATE`/`DELETE` inventory writes.

### Task 6: Commit

- [x] Commit and push the completed product master slice.
