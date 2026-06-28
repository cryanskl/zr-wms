# WMS Reservations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add reservation create, fulfill, release, and order reservation detail UI for slice 6 part 2.

**Architecture:** Add backend reservation query builders and service/controller that call only existing `op_*` stored procedures for reservation writes. Add frontend `reservationApi.ts` and extend the existing order detail view with reservation create/list/action controls.

**Tech Stack:** TypeScript, NestJS, PostgreSQL raw SQL, React, Ant Design, TanStack Query.

## Global Constraints

- Do not edit `docs/wms_schema_v1.7.sql`, `docs/wms_procedures_v1.7.sql`, or `docs/wms_logic_v1.7.sql`.
- Reservation writes must call `op_reserve`, `op_fulfill_reservation`, and `op_release_reservation`.
- Operator must come from current JWT user id.
- Do not update or delete `inventory`, `stock_movement`, or `reservation` from application code.
- Do not implement purchase receiving or MRP in this part.

---

### Task 1: Backend Reservation Query Builders And Endpoints

**Files:**
- Create: `apps/api/src/reservations/reservation-queries.spec.ts`
- Create: `apps/api/src/reservations/reservation-queries.ts`
- Create: `apps/api/src/reservations/reservations.service.ts`
- Create: `apps/api/src/reservations/reservations.controller.ts`
- Modify: `apps/api/src/app.module.ts`

**Interfaces:**
- Produces `POST /reservations`, `POST /reservations/:id/fulfill`, `POST /reservations/:id/release`, `GET /orders/:id/reservations`.

- [x] Write failing tests proving reservation writes call only `op_*` and do not update inventory/reservation directly.
- [x] Run tests and verify RED.
- [x] Implement query builders, service, controller, and module registration.
- [x] Run tests/typecheck and verify GREEN.

### Task 2: Frontend Reservation API

**Files:**
- Create: `apps/web/src/reservationApi.test.ts`
- Create: `apps/web/src/reservationApi.ts`

**Interfaces:**
- Produces `createReservation`, `fulfillReservation`, `releaseReservation`, `listOrderReservations`.

- [x] Write failing frontend API helper tests.
- [x] Run tests and verify RED.
- [x] Implement frontend API client.
- [x] Run tests and verify GREEN.

### Task 3: Frontend Reservation UI

**Files:**
- Modify: `apps/web/src/App.tsx`

**Interfaces:**
- Consumes `reservationApi.ts` inside the existing order detail panel.

- [x] Add reservation query and mutations tied to selected order.
- [x] Add create reservation form with product, slot, qty, optional batch.
- [x] Add reservation list with fulfill/release buttons for `RESERVED` rows.
- [x] Run typecheck/build.

### Task 4: Verification And Commit

- [x] Verify real API: reserve one stock row, available decreases while on-hand stays constant.
- [x] Verify fulfill consumes reservation, on-hand decreases, and stock movement has `ref_order_id`.
- [x] Verify release returns available.
- [x] Verify insufficient reservation returns `409` with Chinese message.
- [x] Browser verify reservation controls render on order detail.
- [x] Grep application code for disallowed `UPDATE`/`DELETE` inventory/stock_movement/reservation writes.
- [x] Update `docs/WMS_实施计划_逐刀指令.md` with slice 6 second-part progress.
- [x] Commit and push.
