# WMS Search Slice Design

## Scope

Implement the first vertical slice after foundation: search from PostgreSQL through NestJS API to React UI.

## Behavior

- Backend exposes `GET /api/v1/search?q=`.
- Empty or whitespace-only `q` returns `[]`.
- Search checks exactly the four documented sources:
  - product name: `product.name`
  - manual aliases: `product_alias.alias_text`
  - BOM path aliases: `bom_path_alias.path_text`
  - remarks: `product.remark`
- Search uses `pg_trgm` similarity for ranking and also supports simple contains matching so partial part numbers remain usable.
- Results include `product_id`, `name`, `matched`, `snippet`, and `score`.
- Frontend provides one search input and a result list. No auth, no filters, no auto-refresh.

## Non-Goals

- No login/roles/guards.
- No product detail page.
- No inventory/location expansion.
- No mutation endpoints.

## Constraints

- Do not change the three authoritative SQL files.
- Do not write inventory or stock movement in this slice.
- Keep the UI minimal and operational, not a marketing page.
