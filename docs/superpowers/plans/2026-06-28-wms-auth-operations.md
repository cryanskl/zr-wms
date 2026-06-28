# WMS Thin Auth and Stock Operations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add real current-user auth and protected stock operations while keeping inventory writes inside PostgreSQL stored procedures.

**Architecture:** NestJS uses Passport JWT for request authentication and a RolesGuard for role checks. Stock operation services call `op_inbound`, `op_outbound`, and `op_transfer` via parameterized raw SQL only. React stores a JWT, uses it for protected operation calls, and provides a mobile-first operation form.

**Tech Stack:** TypeScript, NestJS, @nestjs/jwt, @nestjs/passport, passport-jwt, bcrypt, PostgreSQL stored procedures, React, Ant Design, TanStack Query.

## Global Constraints

- Do not edit `docs/wms_schema_v1.7.sql`, `docs/wms_procedures_v1.7.sql`, or `docs/wms_logic_v1.7.sql`.
- Inventory writes must only call `op_*` stored procedures.
- Do not `UPDATE` or `DELETE` `inventory` or `stock_movement` in application code.
- `operator_id` must come from JWT current user, never from frontend payload.
- Force outbound requires current role `ADMIN`.

---

### Task 1: Auth Foundation

- [ ] Add app auth migration and seeded bcrypt password hashes.
- [ ] Add login endpoint, JWT strategy, JWT guard, roles decorator, and roles guard.
- [ ] Add tests for login URL/request helpers and role guard behavior.

### Task 2: Stock Operation API

- [ ] Add raw SQL builders for inbound, outbound, and transfer.
- [ ] Add tests proving operation SQL calls `op_*` and contains no app-level `UPDATE`/`DELETE`.
- [ ] Add protected controllers/services and 409 business error mapping.
- [ ] Add inventory read endpoint for verification display.

### Task 3: Frontend Operation Page

- [ ] Add login form and token storage.
- [ ] Add product search picker using existing search API.
- [ ] Add mobile-first operation form for inbound, outbound, transfer, and admin force outbound.
- [ ] Show success and inventory shortage errors clearly.

### Task 4: Verification

- [ ] Run tests, typecheck, build.
- [ ] Reset DB and verify login/token flow.
- [ ] Run the six acceptance checks against real PostgreSQL.
- [ ] Grep app code to confirm no direct `UPDATE`/`DELETE` against `inventory` or `stock_movement`.

### Task 5: Commit

- [ ] Commit and push the completed vertical slice.
