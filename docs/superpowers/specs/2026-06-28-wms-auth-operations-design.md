# WMS Thin Auth and Stock Operations Design

## Scope

Add the minimum authentication layer needed to identify the current user and role, then implement inbound/outbound/force-outbound/transfer by calling the existing `op_*` stored procedures.

## Thin Auth

- `POST /api/v1/auth/login` accepts `{ "username": "...", "password": "..." }`.
- Login returns a JWT containing `sub` / `user_id`, `name`, and `role`.
- JWT auth uses Passport JWT and attaches `request.user`.
- `@Roles()` and `RolesGuard` are implemented for role-restricted endpoints.
- Missing or invalid tokens on protected endpoints return `401`.
- Seed users:
  - `operator` / `operator123` -> `OPERATOR`
  - `admin` / `admin123` -> `ADMIN`
  - `boss` / `boss123` -> `BOSS`

## Database Auth Storage

The authoritative `wms_schema_v1.7.sql` has `app_user` but no password field. Do not edit that file. Add a separate app-owned migration:

- `scripts/sql/app-auth.sql`
- Creates `app_user_password(user_id primary key, password_hash text not null)`.
- Enables `pgcrypto` so seed data can store bcrypt hashes with `crypt(..., gen_salt('bf'))`.

## Stock Operations

- `POST /api/v1/inbound` calls `op_inbound(...)`.
- `POST /api/v1/outbound` calls `op_outbound(..., p_allow_negative=false)`.
- `POST /api/v1/outbound?force=true` calls `op_outbound(..., p_allow_negative=true)` and requires current role `ADMIN`.
- `POST /api/v1/transfer` calls `op_transfer(...)`.
- `operator_id` is always current JWT user id. It is never accepted from request body.
- Database business errors from stored procedures are mapped to `409` with a clear Chinese message.

## Frontend

- Minimal login form stores the returned token in browser state/localStorage.
- Operation page is mobile-first.
- Product selection reuses the search API and lets the operator choose a result.
- Form supports inbound, outbound, and transfer.
- Admin users see force outbound. It requires a confirmation modal before calling `POST /outbound?force=true`.

## Non-Goals

- No registration, password reset, refresh token, permission group configuration, or menu-level hiding.
- No direct application writes to `inventory` or `stock_movement`.
- No redesign of the database truth layer.
