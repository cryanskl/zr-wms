# WMS BOM Management Design

## Scope

Implement the second half of slice 4 from `docs/WMS_实施计划_逐刀指令.md`: BOM management and derived path alias visibility. Product master data is already implemented; warehouse/slot management remains out of scope.

## Backend

Protected endpoints:

- `GET /api/v1/products/{id}/bom`
  - Any logged-in role.
  - Returns BOM child rows ordered by `seq`, including child product name/type.
- `PUT /api/v1/products/{id}/bom`
  - ADMIN/BOSS only.
  - Replaces that product's BOM rows.
  - Calls `fn_regen_path_aliases()` in the same statement after changing `bom_line`.
- `POST /api/v1/bom/regenerate-aliases`
  - ADMIN/BOSS only.
  - Calls `fn_regen_path_aliases()` and returns generated count.
- `GET /api/v1/products/{id}/where-used?recursive=`
  - Any logged-in role.
  - Calls `fn_where_used(product, recursive)`.
- `GET /api/v1/products/{id}/path-aliases`
  - Any logged-in role.
  - Returns `bom_path_alias` rows for the product.

## Frontend

- Extend product management detail with a BOM editor.
- Show existing BOM rows with child product, sequence, and quantity.
- Allow ADMIN/BOSS to replace BOM rows using child product IDs, quantities, and seq values.
- Show path aliases and where-used data in the same product detail area.

## Constraints

- Do not edit the authoritative v1.7 SQL files.
- Do not update or delete `inventory` or `stock_movement`.
- Any successful BOM mutation must call `fn_regen_path_aliases()`.
- `where-used` must call `fn_where_used()`.
- Do not implement warehouse/slot management in this slice.
