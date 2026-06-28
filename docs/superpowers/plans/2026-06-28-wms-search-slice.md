# WMS Search Slice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `GET /search?q=` and a React search screen backed by the seeded PostgreSQL data.

**Architecture:** Backend isolates SQL construction in a small search module and executes it through the existing pg pool. Frontend uses TanStack Query to call `/api/v1/search?q=` and Ant Design for the input/list.

**Tech Stack:** TypeScript, NestJS, PostgreSQL pg_trgm, React, Vite, Ant Design, TanStack Query, Vitest.

## Global Constraints

- Search must check product name, aliases, BOM path aliases, and remarks.
- Do not implement auth.
- Do not edit the authoritative v1.7 SQL files.
- Do not add unrequested grouping, filtering, auto-refresh, or default values beyond a blank initial search box.

---

### Task 1: Tests

- [x] Add failing backend test for four-source SQL construction.
- [x] Add failing frontend test for encoded search request helper.

### Task 2: Backend

- [ ] Implement search query builder, service, and controller.
- [ ] Register the controller in `AppModule`.

### Task 3: Frontend

- [ ] Add API helper, query hook, search input, and result list.
- [ ] Add Vite proxy for `/api` to the local Nest API.

### Task 4: Verification

- [ ] Run tests, typecheck, and build.
- [ ] Run `pnpm db:setup:reset`, API, and web.
- [ ] Verify search via API and rendered browser interaction.

### Task 5: Commit

- [ ] Commit the completed search slice and push to `origin/main`.
