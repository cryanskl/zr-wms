# WMS Warehouse And Slot Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add warehouse and slot structure management endpoints and UI.

**Architecture:** Add a `warehouses` backend module for warehouse and slot structure queries/mutations. Remove warehouse/slot list ownership from `StockController` so one controller owns those routes. Add frontend `warehouseApi.ts` and a new authenticated warehouse management tab.

**Tech Stack:** TypeScript, NestJS, PostgreSQL raw SQL, React, Ant Design, TanStack Query.

## Global Constraints

- Do not edit `docs/wms_schema_v1.7.sql`, `docs/wms_procedures_v1.7.sql`, or `docs/wms_logic_v1.7.sql`.
- Do not update or delete `inventory` or `stock_movement`.
- ADMIN/BOSS actions must be enforced by backend guards.
- Outsource warehouses with `has_slots=false` must not generate slots.
- Default slot list must exclude unusable/merged/occupied slots so operation forms cannot choose them.

---

### Task 1: Warehouse Query Builders

- [x] Add failing tests for warehouse/slot query builders.
- [x] Implement warehouse list/create, slot list/template, and slot patch builders.

### Task 2: Backend Warehouse Endpoints

- [x] Implement `WarehousesService`.
- [x] Implement `WarehousesController`.
- [x] Register the controller/service and remove duplicate warehouse routes from `StockController`.

### Task 3: Frontend Warehouse API

- [x] Add failing URL/request helper tests.
- [x] Implement `apps/web/src/warehouseApi.ts`.
- [x] Update operation API to request only selectable slots by default.

### Task 4: Frontend Management View

- [x] Add a warehouse management tab.
- [x] Add warehouse create form.
- [x] Add template generation form.
- [x] Add slot status update controls.

### Task 5: Verification

- [x] Run tests, typecheck, and build.
- [x] Verify API permissions with operator/admin JWTs against the existing local DB.
- [x] Verify outsource warehouse cannot generate slots.
- [x] Verify unusable slot is hidden from operation slot list.
- [x] Verify UI renders warehouse management data in a browser.
- [x] Grep application code for disallowed `UPDATE`/`DELETE` inventory writes.

### Task 6: Commit

- [x] Commit and push the completed warehouse/slot management slice.
