# Task 5 Report - Frontend API Helpers And Pure Model Functions

## 实现内容

- 新增 `apps/web/src/warehouseMapApi.ts`
  - 定义仓库可视化前端类型：
    - `WarehouseLayoutTemplate`
    - `RackTemplate`
    - `WarehouseLayout`
    - `LayoutZone`
    - `RackLayout`
    - `RackSlotMap`
    - `ProductVisualLocation`
    - `WarehouseLayoutSaveInput`
  - 新增 API helper：
    - `listWarehouseLayoutTemplates(token)`
    - `listRackTemplates(token)`
    - `createRackTemplate(token, input)`
    - `getWarehouseLayout(token, warehouseId)`
    - `createWarehouseLayout(token, input)`
    - `saveWarehouseLayout(token, layoutId, input)`
    - `getProductVisualLocations(token, productId)`
  - 新增 URL/request builder，测试可直接断言 URL 和 method。
- 新增 `apps/web/src/warehouseMapModel.ts`
  - `groupLocationsByWarehouse(locations)`
  - `getWarehouseHitCount(warehouseId, locations)`
  - `getRackHitCount(rackLayoutId, locations)`
  - `buildElevationCells(rack, template, mappings, locations)`
  - `normalizeCanvasPosition(value, gridSize)`
- 新增对应测试：
  - `apps/web/src/warehouseMapApi.test.ts`
  - `apps/web/src/warehouseMapModel.test.ts`

## TDD RED/GREEN 证据

### RED

先写测试后运行：

```bash
pnpm --filter @zr-wms/web test -- warehouseMapApi.test.ts warehouseMapModel.test.ts
```

结果：失败，原因是新模块尚未实现。

```text
FAIL  src/warehouseMapApi.test.ts
Error: Cannot find module './warehouseMapApi'

FAIL  src/warehouseMapModel.test.ts
Error: Cannot find module './warehouseMapModel'
```

### GREEN

实现 `warehouseMapApi.ts` 和 `warehouseMapModel.ts` 后运行同一目标测试：

```bash
pnpm --filter @zr-wms/web test -- warehouseMapApi.test.ts warehouseMapModel.test.ts
```

结果：

```text
Test Files  14 passed (14)
Tests  29 passed (29)
```

## 测试结果

```bash
pnpm --filter @zr-wms/web test
```

结果：

```text
Test Files  14 passed (14)
Tests  29 passed (29)
```

```bash
pnpm --filter @zr-wms/web typecheck
```

结果：

```text
tsc -b --noEmit
```

额外按仓库约定补跑：

```bash
pnpm --filter @zr-wms/web build
```

结果：通过。Vite 输出既有 chunk size warning：

```text
(!) Some chunks are larger than 500 kB after minification.
```

## 文件列表

- `apps/web/src/warehouseMapApi.ts`
- `apps/web/src/warehouseMapApi.test.ts`
- `apps/web/src/warehouseMapModel.ts`
- `apps/web/src/warehouseMapModel.test.ts`
- `.superpowers/sdd/task-5-report.md`

## 自审

- 未接入 `App.tsx`，未实现 UI 页面。
- 未新增任何库存写操作。
- API helper 保持现有前端 helper 风格：本地 `apiFetch`、Bearer token、JSON body、错误消息沿用 `请求失败：HTTP ...`。
- 测试断言了 brief 指定的精确 URL：
  - `/api/v1/warehouse-layouts?warehouse=W1`
  - `/api/v1/warehouse-layout-templates`
  - `/api/v1/rack-templates`
  - `/api/v1/products/RM-001/visual-locations`
- 测试断言了 read/create/save helper 的 HTTP method。
- 模型函数无 DOM 依赖，可以在普通 Vitest 环境下测试。

## 顾虑

- `buildElevationCells()` 的 cell 顺序当前为 level -> bay -> position。brief 未指定视图渲染顺序，后续 UI 如果需要从高层到低层展示，建议在 UI 层或后续任务中明确排序规则。
- 多个 `highlight_kind` 同格时当前优先级为 `UNMAPPED > UNAVAILABLE > DEFECTIVE > GOOD`。这是保守展示风险优先的纯前端规则，brief 未给出明确优先级。
