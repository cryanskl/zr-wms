# WMS Warehouse Visualization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a usable warehouse map slice: four different warehouse layouts, reusable warehouse/rack templates, product visual locations across warehouses/racks, and top/elevation views.

**Architecture:** Add an additive visualization schema beside the authoritative WMS schema. Backend exposes authenticated layout/template/product-location APIs using raw PostgreSQL queries. Frontend adds a mobile-aware `仓库地图` page with locate mode for all users and design mode for ADMIN/BOSS. Inventory writes remain untouched and continue to go through existing `op_*` procedures only.

**Tech Stack:** TypeScript, NestJS, PostgreSQL raw SQL, React, Vite, Ant Design, TanStack Query, Vitest, Chrome MCP/browser verification.

## Global Constraints

- Classify the implementation as `功能/重构` before coding because it spans DB setup, API, UI, tests, browser verification, and commits.
- Do not edit `docs/wms_schema_v1.7.sql`, `docs/wms_procedures_v1.7.sql`, or `docs/wms_logic_v1.7.sql`.
- Do not `UPDATE`, `DELETE`, or direct-write `inventory` or `stock_movement` from application code. Product visual locations are read-only queries.
- New visualization tables describe spatial layout only. Stock truth stays in existing `warehouse`, `slot`, `inventory`, and `stock_movement`.
- Layout editing and template creation must be enforced by backend guards with `ADMIN` / `BOSS`; do not rely on frontend hiding.
- Keep the first implementation minimal: no full 3D, no automatic picking recommendation, no inventory-changing action from the map.
- Follow existing project patterns: flat NestJS services/controllers in `apps/api/src`, query-builder tests that assert SQL text, API helper tests in `apps/web/src`, and conditional rendering from `apps/web/src/App.tsx`.
- Commit after each completed, verified task that is independently safe to save. Before each commit run `git branch --show-current && git rev-parse --show-toplevel`.

---

### Task 1: Add Visualization DB Extension Script

- [ ] Create `scripts/sql/warehouse-visualization.sql`.
- [ ] Define additive, idempotent tables:
  - `warehouse_layout`
  - `layout_zone`
  - `rack_template`
  - `warehouse_layout_template`
  - `rack_layout`
  - `rack_slot_map`
- [ ] Add constraints:
  - `warehouse_layout.warehouse_id` references `warehouse(warehouse_id)`.
  - `layout_zone.layout_id` references `warehouse_layout(layout_id)` with cascade delete.
  - `rack_layout.layout_id` references `warehouse_layout(layout_id)` with cascade delete.
  - `rack_layout.template_id` references `rack_template(template_id)`.
  - `rack_slot_map.rack_layout_id` references `rack_layout(rack_layout_id)` with cascade delete.
  - `rack_slot_map.slot_id` references `slot(slot_id)`.
  - A partial unique index allows only one active layout per warehouse: `unique (warehouse_id) where is_active`.
  - A unique index prevents duplicate visual binding inside one layout. Use an expression index through the rack relation only if PostgreSQL allows it cleanly; otherwise enforce this in the save query transaction.
- [ ] Use `GENERATED ALWAYS AS IDENTITY` for new bigint primary keys.
- [ ] Include `created_by` / `updated_by` references to `app_user(user_id)` where mutation endpoints need operator tracking.
- [ ] Seed four warehouse layout templates:
  - `PARALLEL_RACKS` / 平行货架
  - `NARROW_AISLE` / 密集窄巷
  - `MIXED_ZONES` / 分区混合
  - `OUTSOURCE_AREA` / 外协无货架
- [ ] Seed rack templates:
  - `标准三层货架`: `STANDARD`, bay 4, level 3, positions `{A,B,C}`.
  - `托盘货架`: `PALLET`, bay 6, level 4, positions `{A,B}`.
  - `轻型层板`: `SHELF`, bay 5, level 5, positions `{A,B,C}`.
- [ ] Update `scripts/setup-db.ts` so the order stays:
  1. `docs/wms_schema_v1.7.sql`
  2. `docs/wms_procedures_v1.7.sql`
  3. `docs/wms_logic_v1.7.sql`
  4. existing auth/foundation scripts
  5. `scripts/sql/warehouse-visualization.sql`
- [ ] Add or update a setup test if current test coverage for `scripts/setup-db.ts` checks ordered files. If no such test exists, add a lightweight Node test in `scripts/setup-db.test.mjs` that reads the file text and asserts `warehouse-visualization.sql` appears after the three authoritative SQL files.

Implementation notes:

```sql
CREATE TABLE IF NOT EXISTS warehouse_layout (
  layout_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  warehouse_id text NOT NULL REFERENCES warehouse(warehouse_id),
  name text NOT NULL,
  version integer NOT NULL DEFAULT 1,
  is_active boolean NOT NULL DEFAULT true,
  canvas_width numeric NOT NULL DEFAULT 1200,
  canvas_height numeric NOT NULL DEFAULT 720,
  grid_size numeric NOT NULL DEFAULT 20,
  created_by bigint REFERENCES app_user(user_id),
  updated_by bigint REFERENCES app_user(user_id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS warehouse_layout_one_active_idx
  ON warehouse_layout (warehouse_id)
  WHERE is_active;
```

Verification:

```bash
pnpm test
DATABASE_URL="$DATABASE_URL" pnpm db:setup
```

Expected result:

- Setup runs without changing the three v1.7 SQL files.
- Verification count still prints products/path aliases/movements.
- `select count(*) from rack_template;` returns at least 3 after setup.

Commit:

```bash
git branch --show-current && git rev-parse --show-toplevel
git status --short
git add scripts/sql/warehouse-visualization.sql scripts/setup-db.ts scripts/setup-db.test.mjs
git commit -m "Add warehouse visualization schema setup"
```

---

### Task 2: Backend Layout Query Builders And Tests

- [ ] Create `apps/api/src/warehouse-layouts/warehouse-layout-queries.ts`.
- [ ] Create `apps/api/src/warehouse-layouts/warehouse-layout-queries.spec.ts`.
- [ ] Implement query builders:
  - `buildWarehouseLayoutTemplatesQuery()`
  - `buildRackTemplatesQuery()`
  - `buildCreateRackTemplateQuery()`
  - `buildActiveLayoutQuery()`
  - `buildCreateLayoutQuery()`
  - `buildDeactivateWarehouseLayoutsQuery()`
  - `buildUpdateLayoutHeaderQuery()`
  - `buildDeleteLayoutZonesQuery()`
  - `buildInsertLayoutZoneQuery()`
  - `buildDeleteRackLayoutsQuery()`
  - `buildInsertRackLayoutQuery()`
  - `buildInsertRackSlotMapQuery()`
  - `buildSlotWarehouseValidationQuery()`
- [ ] Tests must assert:
  - Product/location and layout read queries contain no `UPDATE inventory`, `DELETE inventory`, `UPDATE stock_movement`, `DELETE stock_movement`.
  - Save helpers only mutate visualization tables.
  - Active layout query returns nested-ready fields with IDs cast to text where needed.
  - Slot validation checks `slot.warehouse_id = $warehouseId`.

Suggested query shape:

```ts
export function buildActiveLayoutQuery(): SqlQuery {
  return {
    text: `
      SELECT
        wl.layout_id::text,
        wl.warehouse_id,
        wl.name,
        wl.version,
        wl.canvas_width,
        wl.canvas_height,
        wl.grid_size,
        lz.zone_id::text,
        rl.rack_layout_id::text,
        rsm.map_id::text,
        rsm.slot_id::text
      FROM warehouse_layout wl
      LEFT JOIN layout_zone lz ON lz.layout_id = wl.layout_id
      LEFT JOIN rack_layout rl ON rl.layout_id = wl.layout_id
      LEFT JOIN rack_slot_map rsm ON rsm.rack_layout_id = rl.rack_layout_id
      WHERE wl.warehouse_id = $1::text
        AND wl.is_active = true
      ORDER BY lz.zone_id NULLS LAST, rl.rack_code NULLS LAST, rsm.bay_no NULLS LAST
    `,
  };
}
```

Verification:

```bash
pnpm --filter @zr-wms/api test
pnpm --filter @zr-wms/api typecheck
```

Commit:

```bash
git branch --show-current && git rev-parse --show-toplevel
git status --short
git add apps/api/src/warehouse-layouts/warehouse-layout-queries.ts apps/api/src/warehouse-layouts/warehouse-layout-queries.spec.ts
git commit -m "Add warehouse layout query builders"
```

---

### Task 3: Backend Layout Service And Controller

- [ ] Create `apps/api/src/warehouse-layouts/warehouse-layouts.service.ts`.
- [ ] Create `apps/api/src/warehouse-layouts/warehouse-layouts.controller.ts`.
- [ ] Register the controller/service in `apps/api/src/app.module.ts`.
- [ ] Use `@UseGuards(JwtAuthGuard, RolesGuard)` on the controller.
- [ ] Implement authenticated read endpoints:
  - `GET /warehouse-layout-templates`
  - `GET /rack-templates`
  - `GET /warehouse-layouts?warehouse=W1`
- [ ] Implement admin endpoints:
  - `POST /rack-templates`
  - `POST /warehouse-layouts`
  - `PUT /warehouse-layouts/:layoutId`
- [ ] Define DTO/body interfaces in the service file or a local `types.ts`:
  - `RackTemplateBody`
  - `WarehouseLayoutCreateBody`
  - `WarehouseLayoutSaveBody`
  - `LayoutZoneBody`
  - `RackLayoutBody`
  - `RackSlotMapBody`
- [ ] In create layout:
  - Require `warehouse_id`, `name`, `canvas_width`, `canvas_height`.
  - Validate warehouse exists using existing `warehouse` table.
  - Deactivate previous active layouts for that warehouse before inserting the new active layout.
  - Store `created_by` and `updated_by` from the JWT user id.
- [ ] In save layout:
  - Require `version`.
  - Update `warehouse_layout` where `layout_id = $1 and version = $2`.
  - Increment `version`.
  - If no row updates, return `409 布局已被其他人修改，请刷新后重试`.
  - Validate every `slot_id` belongs to the layout warehouse before inserting `rack_slot_map`.
  - If the warehouse has `has_slots=false`, reject rack slot mappings with `409 外协仓不能绑定货架库位`.
  - Replace zones/racks/maps inside one transaction. Use `queryDatabase` client support if available; otherwise add a small transaction helper in `apps/api/src/database.ts` without changing existing call sites.
- [ ] Error mapping:
  - `23503` -> `409 引用的仓库、货架模板或库位不存在`
  - `23505` -> `409 布局元素重复`
  - optimistic conflict -> `409 布局已被其他人修改，请刷新后重试`
  - malformed request -> `400` with Chinese message.

Controller sketch:

```ts
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller()
export class WarehouseLayoutsController {
  @Get('warehouse-layouts')
  activeLayout(@Query('warehouse') warehouseId: string) {
    return this.service.getActiveLayout(warehouseId);
  }

  @Post('warehouse-layouts')
  @Roles('ADMIN', 'BOSS')
  createLayout(@Req() req: RequestWithUser, @Body() body: WarehouseLayoutCreateBody) {
    return this.service.createLayout(req.user.user_id, body);
  }
}
```

Verification:

```bash
pnpm --filter @zr-wms/api test
pnpm --filter @zr-wms/api typecheck
```

Manual API smoke with admin JWT:

```bash
curl -s -H "Authorization: Bearer $ADMIN_TOKEN" \
  http://127.0.0.1:3000/api/v1/warehouse-layout-templates

curl -s -X POST http://127.0.0.1:3000/api/v1/warehouse-layouts \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"warehouse_id":"W1","name":"W1 默认平面图","canvas_width":1200,"canvas_height":720}'
```

Commit:

```bash
git branch --show-current && git rev-parse --show-toplevel
git status --short
git add apps/api/src/app.module.ts apps/api/src/database.ts apps/api/src/warehouse-layouts
git commit -m "Add warehouse layout APIs"
```

---

### Task 4: Backend Product Visual Locations API

- [ ] Add query builders to `apps/api/src/warehouse-layouts/visual-location-queries.ts`.
- [ ] Add tests in `apps/api/src/warehouse-layouts/visual-location-queries.spec.ts`.
- [ ] Add `getProductVisualLocations(productId: string)` to `WarehouseLayoutsService`, or create `VisualLocationsService` in the same folder if that keeps responsibilities cleaner.
- [ ] Add a controller method for `GET /products/:id/visual-locations`. Prefer adding a small `ProductVisualLocationsController` with `@Controller('products')` in `apps/api/src/warehouse-layouts/product-visual-locations.controller.ts` so the route stays under `/products` without overloading `ProductsController`.
- [ ] Return all stock rows for the product where `qty_on_hand <> 0 OR reserved_qty <> 0`.
- [ ] Join:
  - `inventory i`
  - `warehouse w`
  - `slot s`
  - active `warehouse_layout wl`
  - `rack_layout rl`
  - `rack_slot_map rsm`
- [ ] Include unmapped stock rows. `rack_layout_id`, `rack_code`, `bay_no`, `level_no`, and `position_code` may be null.
- [ ] Compute `available_qty = qty_on_hand - reserved_qty`.
- [ ] Compute `highlight_kind`:
  - `GOOD` for `quality = 'GOOD'`
  - `DEFECTIVE` for `quality = 'DEFECTIVE'`
  - `UNAVAILABLE` for all other unavailable/non-good qualities
  - `UNMAPPED` when the inventory slot has no visual mapping
- [ ] Endpoint requires JWT but no role restriction.

Suggested SQL:

```sql
SELECT
  i.product_id,
  i.warehouse_id,
  w.name AS warehouse_name,
  i.slot_id::text,
  s.code AS slot_code,
  rl.rack_layout_id::text,
  rl.rack_code,
  rsm.bay_no,
  rsm.level_no,
  rsm.position_code,
  i.quality,
  i.batch_id::text,
  i.qty_on_hand,
  i.reserved_qty,
  (i.qty_on_hand - i.reserved_qty) AS available_qty,
  CASE
    WHEN i.slot_id IS NOT NULL AND rsm.map_id IS NULL THEN 'UNMAPPED'
    WHEN i.quality = 'GOOD' THEN 'GOOD'
    WHEN i.quality = 'DEFECTIVE' THEN 'DEFECTIVE'
    ELSE 'UNAVAILABLE'
  END AS highlight_kind
FROM inventory i
JOIN warehouse w ON w.warehouse_id = i.warehouse_id
LEFT JOIN slot s ON s.slot_id = i.slot_id
LEFT JOIN warehouse_layout wl ON wl.warehouse_id = i.warehouse_id AND wl.is_active = true
LEFT JOIN rack_slot_map rsm ON rsm.slot_id = i.slot_id
LEFT JOIN rack_layout rl ON rl.rack_layout_id = rsm.rack_layout_id AND rl.layout_id = wl.layout_id
WHERE i.product_id = $1::text
  AND (i.qty_on_hand <> 0 OR i.reserved_qty <> 0)
ORDER BY i.warehouse_id, rl.rack_code NULLS LAST, s.code NULLS LAST, i.quality;
```

Verification:

```bash
pnpm --filter @zr-wms/api test
pnpm --filter @zr-wms/api typecheck
curl -s -H "Authorization: Bearer $OPERATOR_TOKEN" \
  http://127.0.0.1:3000/api/v1/products/RM-001/visual-locations
```

Commit:

```bash
git branch --show-current && git rev-parse --show-toplevel
git status --short
git add apps/api/src/app.module.ts apps/api/src/warehouse-layouts
git commit -m "Add product visual location API"
```

---

### Task 5: Frontend API Helpers And Pure Model Tests

- [ ] Create `apps/web/src/warehouseMapApi.ts`.
- [ ] Create `apps/web/src/warehouseMapApi.test.ts`.
- [ ] Create `apps/web/src/warehouseMapModel.ts`.
- [ ] Create `apps/web/src/warehouseMapModel.test.ts`.
- [ ] Implement types:
  - `WarehouseLayoutTemplate`
  - `RackTemplate`
  - `WarehouseLayout`
  - `LayoutZone`
  - `RackLayout`
  - `RackSlotMap`
  - `ProductVisualLocation`
  - `WarehouseLayoutSaveInput`
- [ ] Implement API helpers:
  - `listWarehouseLayoutTemplates(token)`
  - `listRackTemplates(token)`
  - `createRackTemplate(token, input)`
  - `getWarehouseLayout(token, warehouseId)`
  - `createWarehouseLayout(token, input)`
  - `saveWarehouseLayout(token, layoutId, input)`
  - `getProductVisualLocations(token, productId)`
- [ ] Tests must assert exact URLs and HTTP methods:
  - `/api/v1/warehouse-layouts?warehouse=W1`
  - `/api/v1/warehouse-layout-templates`
  - `/api/v1/rack-templates`
  - `/api/v1/products/RM-001/visual-locations`
- [ ] Model helpers:
  - `groupLocationsByWarehouse(locations)`
  - `getWarehouseHitCount(warehouseId, locations)`
  - `getRackHitCount(rackLayoutId, locations)`
  - `buildElevationCells(rack, template, mappings, locations)`
  - `normalizeCanvasPosition(value, gridSize)`
- [ ] Keep model helpers pure so they can be tested without DOM test setup.

Verification:

```bash
pnpm --filter @zr-wms/web test
pnpm --filter @zr-wms/web typecheck
```

Commit:

```bash
git branch --show-current && git rev-parse --show-toplevel
git status --short
git add apps/web/src/warehouseMapApi.ts apps/web/src/warehouseMapApi.test.ts apps/web/src/warehouseMapModel.ts apps/web/src/warehouseMapModel.test.ts
git commit -m "Add warehouse map frontend data helpers"
```

---

### Task 6: Frontend Warehouse Map Page

- [ ] Create `apps/web/src/WarehouseMapPage.tsx`.
- [ ] Move page-specific component code out of `apps/web/src/App.tsx` to keep the existing large file from growing further.
- [ ] Add `warehouseMap` to the `ActiveView` union in `apps/web/src/App.tsx`.
- [ ] Add a nav option:
  - label: `仓库地图`
  - value: `warehouseMap`
  - icon: `MapPinned`
- [ ] Render `<WarehouseMapPage token={token} user={auth.user} />` when `activeView === 'warehouseMap'`.
- [ ] Add CSS to `apps/web/src/styles.css` using stable responsive dimensions:
  - desktop: left warehouse rail, center map surface, right product panel.
  - mobile: search/type controls at top, horizontal warehouse rail, map body, bottom location list.
- [ ] Components inside `WarehouseMapPage.tsx`:
  - `WarehouseSelector`
  - `WarehouseCanvas`
  - `RackElevationView`
  - `ProductLocationPanel`
  - `LayoutTemplatePanel`
- [ ] Locate mode behavior:
  - Product search reuses `searchProducts(query, token)`.
  - Type segmented control supports `ALL`, `RM`, `SF`, `FG`, `ACC`.
  - Selecting a product calls `getProductVisualLocations`.
  - All matched warehouses/racks/slots highlight at once.
  - Clicking a location card selects its warehouse and rack. If mapped, switch/keep view based on user-selected `top` or `elevation`.
  - Unmapped stock rows stay visible with `未映射到平面图位置`.
- [ ] View switch:
  - Use Ant Design `Segmented` with `俯视图` / `立面图`.
  - Top view highlights rack blocks.
  - Elevation view highlights bay/level/position cells.
- [ ] Design mode behavior:
  - Only show the design mode toggle when `user.role` is `ADMIN` or `BOSS`.
  - Operator can never see save/template-create controls.
  - Admin can create a layout from a warehouse template when none exists.
  - Admin can add zone and rack records from existing templates.
  - Admin can drag racks/zones to change `x`/`y`; width/height/rotation may be edited in the side panel for v1.
  - Admin can save layout with current `version`.
  - On `409`, show `布局已被其他人修改，请刷新后重试`.
- [ ] Keep visual design work-focused:
  - Light canvas, neutral panels, dark rack blocks.
  - Yellow highlight for good stock, red for defective, muted gray for unmapped.
  - No decorative gradient blobs, marketing hero, or nested cards.

Important UI state:

```ts
type WarehouseMapMode = 'locate' | 'design';
type WarehouseMapView = 'top' | 'elevation';

interface WarehouseMapPageProps {
  token: string;
  user: CurrentUser;
}
```

Verification:

```bash
pnpm --filter @zr-wms/web test
pnpm --filter @zr-wms/web typecheck
pnpm --filter @zr-wms/web build
```

Browser verification:

- Start local app with `./start.sh`.
- Login as operator.
- Confirm `仓库地图` opens, locate mode works, and design controls are not visible.
- Login as admin.
- Confirm design mode toggle appears.
- Create or edit a W1 layout.
- Search a product with inventory in multiple warehouses.
- Confirm product is highlighted in every matched warehouse/rack and listed in the location panel.
- Check desktop and a mobile-width viewport for no overlapping text.

Commit:

```bash
git branch --show-current && git rev-parse --show-toplevel
git status --short
git add apps/web/src/App.tsx apps/web/src/WarehouseMapPage.tsx apps/web/src/styles.css
git commit -m "Add warehouse map page"
```

---

### Task 7: End-To-End Verification And Redline Scan

- [ ] Rebuild database from scratch in a local dev DB:

```bash
DATABASE_URL="$DATABASE_URL" pnpm db:setup:reset
```

- [ ] Start the project:

```bash
./start.sh
```

- [ ] Login and collect JWTs:

```bash
curl -s -X POST http://127.0.0.1:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"operator","password":"operator123"}'

curl -s -X POST http://127.0.0.1:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'
```

- [ ] API acceptance checks:
  - Operator can `GET /warehouse-layouts?warehouse=W1`.
  - Operator gets `403` for `POST /warehouse-layouts`.
  - Admin can create W1/W2/W3/W4 layouts with different dimensions or rack positions.
  - Admin can create a rack template.
  - `GET /products/:id/visual-locations` returns mapped and unmapped stock rows.
  - Version conflict on layout save returns `409 布局已被其他人修改，请刷新后重试`.
- [ ] Browser acceptance checks:
  - Four warehouses can each show a different map.
  - Warehouse templates and rack templates are visible to admin.
  - Product type filter narrows search/selection.
  - One product in multiple warehouses highlights all relevant places.
  - Top view locates warehouse/rack.
  - Elevation view locates level/cell.
  - Mobile layout does not overlap controls or text.
- [ ] Run full checks:

```bash
pnpm test
pnpm typecheck
pnpm build
```

- [ ] Run redline scan:

```bash
rg -n "\b(UPDATE|DELETE\s+FROM)\s+(inventory|stock_movement)\b|\b(inventory|stock_movement)\s+SET\b|INSERT\s+INTO\s+(inventory|stock_movement)" apps scripts start.sh -g '!scripts/sql/*.sql'
```

Expected result:

- No application-layer direct `UPDATE`/`DELETE`/`INSERT` against `inventory` or `stock_movement`.
- Existing stored-procedure SQL files are not modified.

- [ ] Inspect changed files:

```bash
git diff --check
git status --short
```

Final commit and push:

```bash
git branch --show-current && git rev-parse --show-toplevel
git status --short
git add <files changed during final verification, if any>
git commit -m "Verify warehouse visualization slice"
git push
```

If final verification changes no files, skip the final commit and run only `git push`.

---

## Rollback Plan

- If the visualization schema causes setup failure, remove `scripts/sql/warehouse-visualization.sql` from `orderedSqlFiles`; the existing WMS schema and inventory operations remain unaffected.
- If frontend map page has rendering regressions, remove only the `warehouseMap` nav option and route rendering in `apps/web/src/App.tsx`; API and schema can remain inert.
- If layout save has a transaction bug, keep read endpoints and disable save buttons in the UI until the backend transaction is fixed.

## Acceptance Summary

- [ ] 4 warehouses can have distinct saved visual layouts.
- [ ] Admin can use warehouse templates and rack templates.
- [ ] Operator can locate products but cannot enter design mode.
- [ ] Admin/BOSS can enter design mode and save layout edits.
- [ ] Product locations show all warehouses/racks/slots, including unmapped inventory rows.
- [ ] Top view and elevation view both work.
- [ ] Full tests/typecheck/build pass.
- [ ] Redline scan confirms no app-layer inventory/stock movement direct writes.
