# WMS Permission Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build slice 9-E: role-aware navigation, operation logs, and stale-write conflict mapping.

**Architecture:** Add an operation-log read module and a shared PostgreSQL conflict mapper. Frontend derives navigation items from current role and adds an ADMIN operation-log page.

**Tech Stack:** TypeScript, NestJS, PostgreSQL raw SQL via `pg`, React, Vite, Ant Design, TanStack Query.

## Global Constraints

- Operation log endpoint requires ADMIN.
- Operator navigation shows daily operations only.
- Boss navigation exposes reports and product price flow.
- Optimistic-lock style conflicts return 409 with "刷新后重试".

---

### Task 1: Backend Log Queries and Conflict Mapper

**Files:**
- Create: `apps/api/src/operation-logs/operation-log-queries.ts`
- Create: `apps/api/src/operation-logs/operation-log-queries.spec.ts`
- Create: `apps/api/src/db-errors.ts`
- Create: `apps/api/src/db-errors.spec.ts`

**Interfaces:**
- Produces `buildOperationLogsQuery()`.
- Produces `mapPgConcurrencyError(error)`.

### Task 2: Backend Operation Logs Endpoint

**Files:**
- Create: `apps/api/src/operation-logs/operation-logs.service.ts`
- Create: `apps/api/src/operation-logs/operation-logs.controller.ts`
- Modify: `apps/api/src/app.module.ts`

**Interfaces:**
- Produces `GET /operation-logs`.

### Task 3: Frontend Role Navigation and Logs View

**Files:**
- Create: `apps/web/src/operationLogApi.ts`
- Create: `apps/web/src/operationLogApi.test.ts`
- Modify: `apps/web/src/App.tsx`

**Interfaces:**
- Produces ADMIN-only operation log navigation and table.
- Hides non-daily navigation from OPERATOR.

### Task 4: Verification and Commit

- [ ] Run `pnpm test`, `pnpm typecheck`, `pnpm build`.
- [ ] Verify operator cannot see admin navigation and gets 403 for `/operation-logs`.
- [ ] Verify admin can view operation logs.
- [ ] Verify redline scan has no forbidden inventory/stock writes.
- [ ] Mark 9-E complete, commit, and push.
