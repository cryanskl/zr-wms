# WMS Orders Skeleton Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add order skeleton endpoints and UI for purchase/production order list, creation, detail, and header updates.

**Architecture:** Add an `orders` backend module with raw SQL query builders plus a service/controller. Add a frontend `orderApi.ts` and an order tab inside the existing authenticated app shell. This part does not implement reservations, receiving, MRP, or any inventory writes.

**Tech Stack:** TypeScript, NestJS, PostgreSQL raw SQL, React, Ant Design, TanStack Query.

## Global Constraints

- Do not edit `docs/wms_schema_v1.7.sql`, `docs/wms_procedures_v1.7.sql`, or `docs/wms_logic_v1.7.sql`.
- Use `order_doc`, not `order`.
- All order endpoints require JWT login.
- `created_by` must come from the current token user.
- Do not update or delete `inventory` or `stock_movement`.
- Do not implement reservations, receiving, or MRP in this part.

---

### Task 1: Backend Order Query Builders

**Files:**
- Create: `apps/api/src/orders/order-queries.spec.ts`
- Create: `apps/api/src/orders/order-queries.ts`

**Interfaces:**
- Produces `buildOrderListQuery()`, `buildCreateOrderQuery()`, `buildInsertOrderLineQuery()`, `buildOrderDetailQuery()`, `buildUpdateOrderHeaderQuery()`.

- [x] Write failing tests for order query builders.
- [x] Run tests and verify RED.
- [x] Implement query builders.
- [x] Run tests and verify GREEN.

### Task 2: Backend Order Endpoints

**Files:**
- Create: `apps/api/src/orders/orders.service.ts`
- Create: `apps/api/src/orders/orders.controller.ts`
- Modify: `apps/api/src/app.module.ts`

**Interfaces:**
- Consumes query builders from Task 1.
- Produces authenticated routes `GET /orders`, `POST /orders`, `GET /orders/:id`, `PATCH /orders/:id`.

- [x] Implement request validation and row mappers.
- [x] Use a transaction for order create.
- [x] Register controller/service.
- [x] Run typecheck/tests.

### Task 3: Frontend Order API

**Files:**
- Create: `apps/web/src/orderApi.test.ts`
- Create: `apps/web/src/orderApi.ts`

**Interfaces:**
- Produces `listOrders`, `createOrder`, `getOrder`, `patchOrder`, and URL/request helper functions.

- [x] Write failing frontend API helper tests.
- [x] Run tests and verify RED.
- [x] Implement frontend API client.
- [x] Run tests and verify GREEN.

### Task 4: Frontend Order View

**Files:**
- Modify: `apps/web/src/App.tsx`

**Interfaces:**
- Consumes `orderApi.ts`.
- Adds an authenticated order tab with filters, create form, detail table, and header patch controls.

- [x] Add order tab state and queries/mutations.
- [x] Add create order form with line draft list.
- [x] Add order list/detail and patch controls.
- [x] Run typecheck/build.

### Task 5: Verification And Commit

- [x] Verify real API: login, create production order with lines, list, detail, patch status.
- [x] Verify app returns 401 without token for `/orders`.
- [x] Browser verify order tab renders and shows created order.
- [x] Grep application code for disallowed `UPDATE`/`DELETE` inventory writes.
- [x] Update `docs/WMS_实施计划_逐刀指令.md` with slice 6 first-part progress.
- [x] Commit and push.
