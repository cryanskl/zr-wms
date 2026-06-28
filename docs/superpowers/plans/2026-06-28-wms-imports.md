# WMS Imports Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build slice 9-B: ADMIN-only Excel imports for initial inventory, products, and BOM.

**Architecture:** Add a focused NestJS imports controller/service/parser module. Excel upload parsing is application-layer validation, but stock writes still go through `op_inbound`; BOM import calls `fn_regen_path_aliases()` after replacing BOM rows.

**Tech Stack:** TypeScript, NestJS, PostgreSQL raw SQL via `pg`, ExcelJS, React, Vite, Ant Design, TanStack Query.

## Global Constraints

- Inventory writes must use `op_*` stored procedures.
- Application code must not `UPDATE` or `DELETE` `inventory` or `stock_movement`.
- Do not modify `docs/wms_schema_v1.7.sql`, `docs/wms_procedures_v1.7.sql`, or `docs/wms_logic_v1.7.sql`.
- Import endpoints require ADMIN or BOSS role.
- BOM import must call `fn_regen_path_aliases()` after modifying BOM lines.

---

### Task 1: Backend Import SQL and Excel Parsing

**Files:**
- Create: `apps/api/src/imports/import-queries.ts`
- Create: `apps/api/src/imports/import-parser.ts`
- Test: `apps/api/src/imports/import-queries.spec.ts`
- Test: `apps/api/src/imports/import-parser.spec.ts`

**Interfaces:**
- Produces: `buildImportProductUpsertQuery()`, `buildImportInventoryInboundQuery()`, `buildDeleteImportedBomLinesQuery()`, `buildInsertImportedBomLineQuery()`, `buildRegenerateImportedPathAliasesQuery()`.
- Produces: `parseProductsWorkbook(buffer)`, `parseInventoryWorkbook(buffer)`, `parseBomWorkbook(buffer)`.

- [ ] Write failing tests that assert inventory import SQL calls only `op_inbound`, product/BOM SQL matches target tables, BOM regeneration uses `fn_regen_path_aliases()`, and parsers read header-based Excel sheets.
- [ ] Run API tests and confirm missing module failures.
- [ ] Implement the query builders and parsers.
- [ ] Re-run API tests and confirm green.

### Task 2: Backend Import Service and Controller

**Files:**
- Create: `apps/api/src/imports/imports.service.ts`
- Create: `apps/api/src/imports/imports.controller.ts`
- Modify: `apps/api/src/app.module.ts`
- Modify: `apps/api/package.json`
- Modify: `pnpm-lock.yaml`

**Interfaces:**
- Consumes Task 1 helpers.
- Produces `POST /import/inventory`, `POST /import/products`, `POST /import/bom`.

- [ ] Add multipart upload support types if needed.
- [ ] Implement ADMIN/BOSS guarded controller methods using `FileInterceptor('file')`.
- [ ] Implement service methods that parse Excel buffers and execute queries inside database transactions.
- [ ] Run tests and typecheck.

### Task 3: Frontend Import API and UI

**Files:**
- Create: `apps/web/src/importApi.ts`
- Create: `apps/web/src/importApi.test.ts`
- Modify: `apps/web/src/App.tsx`
- Modify: `apps/web/src/styles.css`

**Interfaces:**
- Produces `importInventory(token, file)`, `importProducts(token, file)`, `importBom(token, file)`.
- Produces an ADMIN/BOSS-visible import view.

- [ ] Write failing frontend API test for multipart POST URLs and auth header.
- [ ] Implement API helpers.
- [ ] Add an import page with three upload controls and result summaries.
- [ ] Run web tests and typecheck.

### Task 4: Verification and Commit

- [ ] Run `pnpm test`, `pnpm typecheck`, `pnpm build`.
- [ ] Verify operator receives 403 for import endpoints.
- [ ] Upload generated Excel files through API: products, inventory, BOM.
- [ ] Confirm initial inventory import changes inventory dashboard numbers and creates `stock_movement` with logged-in operator.
- [ ] Confirm BOM import regenerates path aliases.
- [ ] Verify no application `UPDATE`/`DELETE` against `inventory` or `stock_movement`.
- [ ] Browser-verify the import page.
- [ ] Mark 9-B complete in the roadmap, commit, and push.
