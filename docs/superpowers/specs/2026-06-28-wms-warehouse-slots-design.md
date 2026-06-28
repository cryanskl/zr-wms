# WMS Warehouse And Slot Management Design

## Scope

Implement slice 5 from `docs/WMS_实施计划_逐刀指令.md`: warehouse and slot structure management. Inventory operations remain unchanged and must still use `op_*` procedures.

## Backend

Protected endpoints:

- `GET /api/v1/warehouses`
  - Any logged-in role.
  - Lists warehouses including `has_slots=false` outsource warehouse.
- `POST /api/v1/warehouses`
  - ADMIN/BOSS only.
  - Creates one warehouse.
- `GET /api/v1/warehouses/{id}/slots`
  - Any logged-in role.
  - Defaults to selectable slots only (`AVAILABLE`) so inbound/outbound does not offer unusable slots.
  - Supports `?includeUnavailable=true` for management views.
- `POST /api/v1/warehouses/{id}/slots:template`
  - ADMIN/BOSS only.
  - Generates slots from row/column/level/position template.
  - Refuses warehouses with `has_slots=false`.
- `PATCH /api/v1/slots/{id}`
  - ADMIN/BOSS only.
  - Updates `status`, `status_reason`, and `merged_into`.

## Frontend

- Add a warehouse management view in the authenticated app.
- Show warehouse list and create warehouse form.
- Show selected warehouse slots, including unavailable slots.
- Add template generation form with rows, columns, levels, and positions.
- Add slot status update controls.

## Constraints

- Do not edit the authoritative v1.7 SQL files.
- Do not update or delete `inventory` or `stock_movement`.
- Outsource warehouses (`has_slots=false`) must not generate slots.
- Structure write permissions must be enforced by backend guards.
