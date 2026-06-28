# WMS Inventory Dashboard Design

## Scope

Implement the third vertical slice from `docs/WMS_实施计划_逐刀指令.md`: inventory dashboard and low-stock warning. This slice is read-only.

## Backend

Protected endpoints:

- `GET /api/v1/inventory`
  - Supports `?product=&warehouse=&slot=&quality=`.
  - Returns product, warehouse, slot, quality, on-hand, available, and frozen.
- `GET /api/v1/inventory/summary?product=`
  - Returns total, available, and frozen buckets.
  - Available is calculated through `fn_available`.
- `GET /api/v1/products/{id}/locations`
  - Lists locations where the product has stock.
- `GET /api/v1/slots/{id}/products`
  - Lists products on a slot.
- `GET /api/v1/reports/low-stock`
  - Lists active products whose total inventory across warehouses is lower than `product.safety_stock`.

## Frontend

- Add an inventory dashboard view inside the existing authenticated app.
- Provide filters for product, warehouse, and quality.
- Show an inventory table with product, warehouse, slot, quality, on-hand, available, and frozen.
- Show a prominent low-stock warning list.

## Constraints

- This slice must not add any write operation.
- Application code must not `UPDATE` or `DELETE` `inventory` or `stock_movement`.
- Do not edit authoritative v1.7 SQL files.
