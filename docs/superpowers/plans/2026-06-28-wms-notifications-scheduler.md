# WMS Notifications Scheduler Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build slice 9-D: notification test endpoint and an independent scheduler worker.

**Architecture:** Use `operation_log` as the durable notification outbox until real email or WeCom credentials exist. The API exposes `POST /notifications/test`; `src/scheduler.ts` runs separately from Nest HTTP and records low-stock and period-report notification events.

**Tech Stack:** TypeScript, NestJS, PostgreSQL raw SQL via `pg`, existing report/low-stock SQL.

## Global Constraints

- Do not add a new notification table in this slice.
- Scheduler must run outside the realtime API process.
- Inventory and stock movement tables are read-only for this slice.
- Notification endpoint requires ADMIN or BOSS.

---

### Task 1: Notification Query Builders

**Files:**
- Create: `apps/api/src/notifications/notification-queries.ts`
- Test: `apps/api/src/notifications/notification-queries.spec.ts`

**Interfaces:**
- Produces `buildInsertNotificationLogQuery()`, `buildRecentNotificationLogsQuery()`.

- [ ] Write failing tests that assert notification queries write `operation_log` and do not write `inventory` or `stock_movement`.
- [ ] Implement query builders.
- [ ] Re-run API tests and confirm green.

### Task 2: Notification Service and Controller

**Files:**
- Create: `apps/api/src/notifications/notifications.service.ts`
- Create: `apps/api/src/notifications/notifications.controller.ts`
- Modify: `apps/api/src/app.module.ts`

**Interfaces:**
- Produces `POST /notifications/test`.
- Produces service methods `sendTestNotification(operatorId)`, `scanLowStock()`, `generatePeriodReport(range)`.

- [ ] Implement operation-log notification writes.
- [ ] Add ADMIN/BOSS guarded controller endpoint.
- [ ] Register service and controller.
- [ ] Run tests and typecheck.

### Task 3: Independent Scheduler Worker

**Files:**
- Create: `apps/api/src/scheduler.ts`
- Modify: `apps/api/package.json`

**Interfaces:**
- Produces `pnpm --filter @zr-wms/api scheduler`.
- Produces `pnpm --filter @zr-wms/api scheduler:once`.

- [ ] Implement once mode for verification.
- [ ] Implement loop mode with `SCHEDULER_INTERVAL_MS`.
- [ ] Run scheduler once and confirm it records notification logs.

### Task 4: Verification and Commit

- [ ] Run `pnpm test`, `pnpm typecheck`, `pnpm build`.
- [ ] Verify operator receives 403 for `POST /notifications/test`.
- [ ] Verify admin can trigger test notification.
- [ ] Verify scheduler once records low-stock/report notification events.
- [ ] Mark 9-D complete in roadmap, commit, and push.
