# WMS Inventory Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add read-only inventory dashboard and low-stock warning endpoints/UI.

**Architecture:** Keep writes untouched. Add read-only SQL builder functions and protected controller methods. Reuse existing JWT token in the frontend and add a dashboard segmented view beside the operation page.

**Tech Stack:** TypeScript, NestJS, PostgreSQL raw SQL, React, Ant Design, TanStack Query.

## Global Constraints

- This slice is read-only.
- Do not write `inventory` or `stock_movement`.
- Do not edit `docs/wms_schema_v1.7.sql`, `docs/wms_procedures_v1.7.sql`, or `docs/wms_logic_v1.7.sql`.

---

### Task 1: Backend Read Queries

- [x] Add SELECT-only query builders for inventory, summary, product locations, slot products, and low stock.
- [x] Add tests confirming the query builders are SELECT-only and use `fn_available`.

### Task 2: Backend Endpoints

- [x] Implement protected endpoints from the API checklist.
- [x] Preserve existing operation endpoints.

### Task 3: Frontend Dashboard

- [x] Add inventory filters/table.
- [x] Add low-stock warning list.
- [x] Keep mobile layout usable.

### Task 4: Verification

- [x] Run tests, typecheck, and build.
- [x] Reset DB and verify API endpoints with JWT.
- [x] Verify UI loads and shows dashboard data.
- [x] Grep application code for disallowed `UPDATE`/`DELETE` inventory writes.

### Task 5: Commit

- [x] Commit and push the completed read-only slice.
