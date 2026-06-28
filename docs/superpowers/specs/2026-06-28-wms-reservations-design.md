# WMS Reservations Design

## Scope

Implement slice 6 part 2 only: reservation create, fulfill, release, and order reservation list.

## Requirements

- Implement:
  - `POST /reservations` -> call `op_reserve()`
  - `POST /reservations/{id}/fulfill` -> call `op_fulfill_reservation()`
  - `POST /reservations/{id}/release` -> call `op_release_reservation()`
  - `GET /orders/{id}/reservations` -> read reservation rows for one order
- All endpoints require JWT login.
- Operator must be current token user id.
- Reservation writes must only call the stored procedures above.
- Do not directly update/delete `inventory`, `stock_movement`, or `reservation` in application code.
- Stored procedure business errors such as insufficient available stock must return `409` with a clear Chinese message.
- Frontend adds reservation controls inside order detail:
  - create reservation by product/slot/qty/batch optional
  - show reservation rows
  - fulfill or release each `RESERVED` reservation

## Out Of Scope

- Purchase receiving.
- MRP.
- Reservation auto-picking.
- Changing order line status automatically.
