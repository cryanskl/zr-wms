# Task 4 Report: Product Visual Locations API

## 实现内容

- 新增只读 query builder `buildProductVisualLocationsQuery()`，用于 `GET /products/:id/visual-locations`。
- 查询返回指定产品所有 `qty_on_hand <> 0 OR reserved_qty <> 0` 的库存行。
- 查询包含映射与未映射库存行：
  - `inventory i`
  - `warehouse w`
  - `slot s`
  - active `warehouse_layout wl`
  - `rack_slot_map rsm`
  - `rack_layout rl`
- `rack_slot_map` join 额外限定 `rsm.layout_id = wl.layout_id`，避免误使用非 active layout 的库位映射。
- 对外字段包含 `rack_layout_id`、`rack_code`、`bay_no`、`level_no`、`position_code`，无映射时允许为 `null`。
- SQL 计算：
  - `available_qty = qty_on_hand - reserved_qty`
  - `highlight_kind = GOOD | DEFECTIVE | UNAVAILABLE | UNMAPPED`
- `WarehouseLayoutsService.getProductVisualLocations(productId)` 负责规范化产品 ID、执行查询、把 numeric text 映射为 number。
- 新增 `ProductVisualLocationsController`，注册路由 `GET /products/:id/visual-locations`。
- Endpoint 使用 `JwtAuthGuard`，没有 `@Roles()` 限制。
- 注册 `ProductVisualLocationsController` 到 `AppModule`。

## 测试结果

- `pnpm --filter @zr-wms/api test`：通过，19 个 test files / 61 个 tests。
- `pnpm --filter @zr-wms/api typecheck`：通过。
- `pnpm --filter @zr-wms/api build`：通过。
- 库存红线扫描：无输出。

红线扫描命令：

```bash
rg -n "\b(UPDATE|DELETE\s+FROM)\s+(inventory|stock_movement)\b|\b(inventory|stock_movement)\s+SET\b|INSERT\s+INTO\s+(inventory|stock_movement)" apps scripts start.sh -g '!scripts/sql/*.sql'
```

## TDD RED/GREEN 证据

### RED

先写测试后运行：

```bash
pnpm --filter @zr-wms/api test -- apps/api/src/warehouse-layouts/visual-location-queries.spec.ts apps/api/src/warehouse-layouts/warehouse-layouts.service.spec.ts
```

预期失败：

- `Cannot find module './visual-location-queries'`
- `getProductVisualLocations is not a function`
- `Cannot find module './product-visual-locations.controller'`

### GREEN

实现后同一组测试通过：

```bash
pnpm --filter @zr-wms/api test -- apps/api/src/warehouse-layouts/visual-location-queries.spec.ts apps/api/src/warehouse-layouts/warehouse-layouts.service.spec.ts
```

结果：19 个 test files / 61 个 tests 通过。

随后全量 API 测试、typecheck、build 均通过。

## 文件列表

- `apps/api/src/warehouse-layouts/visual-location-queries.ts`
- `apps/api/src/warehouse-layouts/visual-location-queries.spec.ts`
- `apps/api/src/warehouse-layouts/product-visual-locations.controller.ts`
- `apps/api/src/warehouse-layouts/warehouse-layouts.service.ts`
- `apps/api/src/warehouse-layouts/warehouse-layouts.service.spec.ts`
- `apps/api/src/app.module.ts`
- `.superpowers/sdd/task-4-report.md`

## 自审

- 符合只读 API 范围，没有修改权威 SQL 文档。
- 没有 `INSERT` / `UPDATE` / `DELETE` `inventory` 或 `stock_movement`。
- Controller 只要求 JWT，不添加角色限制。
- Query 用 `LEFT JOIN` 保留未映射库存行。
- Service 将产品 ID 统一转大写，沿用当前仓库内既有 ID 处理习惯。
- `rack_slot_map` 按 active layout 收紧，避免同一 slot 在旧布局中的映射污染当前可视化结果。

## 顾虑

- brief 的示例字段写了 `position_code`，但当前 schema 的实际列名是 `rack_slot_map.position`；实现使用 `rsm.position AS position_code` 对外兼容 brief。
- 本任务没有启动本地 API 服务做 curl 验证，因为要求的验证项是 API test/typecheck；当前没有在报告中声明真实数据库样例响应。
