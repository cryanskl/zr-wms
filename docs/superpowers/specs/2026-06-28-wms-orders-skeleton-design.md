# WMS Orders Skeleton Design

## Scope

Implement slice 6 part 1 only: order list, create, detail, and header patch for purchase/production orders.

## Requirements

- Use existing `order_doc` and `order_line`; do not change authoritative SQL files.
- Implement:
  - `GET /orders?type=PURCHASE|PRODUCTION&status=`
  - `POST /orders`
  - `GET /orders/{id}`
  - `PATCH /orders/{id}`
- All endpoints require JWT login.
- `created_by` must come from the current token user.
- Purchase and production are the only order types.
- Keep line status values aligned to order type:
  - purchase: `PENDING`, `PARTIAL_RECEIVED`, `RECEIVED`, `DONE`, `CANCELLED`
  - production: `PENDING`, `SHORTAGE`, `PICKED`, `IN_PRODUCTION`, `PRODUCED`, `CANCELLED`
- Frontend adds an order tab with:
  - order list filters by type/status
  - create order form with multiple lines
  - detail view showing header and line statuses
  - header/status patch controls

## Out Of Scope

- Reservations.
- Reservation fulfill/release.
- Purchase receive / automatic inbound.
- MRP display.
- Any inventory write.
