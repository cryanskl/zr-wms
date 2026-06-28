# WMS Product Master Design

## Scope

Implement the first half of slice 4 from `docs/WMS_实施计划_逐刀指令.md`: product master data. BOM management stays out of this slice.

## Backend

Protected endpoints:

- `GET /api/v1/products?type=&active=`
  - Lists products with simple filters.
- `GET /api/v1/products/{id}`
  - Returns one product plus aliases, images, and path aliases.
- `POST /api/v1/products`
  - ADMIN/BOSS only.
  - Creates a product. If `product_id` is omitted, generates one with the product type prefix.
- `PATCH /api/v1/products/{id}`
  - ADMIN/BOSS only.
  - Updates editable fields. If `product_id` changes and existing foreign-key references prevent it, return `409` with a Chinese message.
- `DELETE /api/v1/products/{id}`
  - ADMIN/BOSS only.
  - Soft-deletes by setting `active=false`.
- `POST /api/v1/products/{id}/aliases`
  - Any logged-in user.
  - Adds a manual alias, with the database limit of 10 enforced in the service.
- `DELETE /api/v1/products/{id}/aliases/{aliasId}`
  - Any logged-in user.
  - Deletes one alias row.
- `POST /api/v1/products/{id}/images`
  - ADMIN/BOSS only.
  - Stores image URL in `product_image`; object storage upload itself is not part of this slice.

## Frontend

- Add an authenticated product management view inside the existing app.
- Show product list with type/active filters.
- Show detail panel with aliases, images, and path aliases.
- Allow ADMIN/BOSS to create/update/soft-delete products and add image URLs.
- Allow every logged-in role to add/delete aliases.
- Keep the existing search and inventory/operation views intact.

## Constraints

- Do not edit the authoritative v1.7 SQL files.
- Do not update or delete `inventory` or `stock_movement`.
- Use backend role guards for ADMIN/BOSS actions.
- Keep BOM management for the next slice segment.
