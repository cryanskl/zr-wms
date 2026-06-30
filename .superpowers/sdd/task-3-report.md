# Task 3 Report: Backend Layout Service And Controller

## 实现内容

- 新增 `WarehouseLayoutsService`：
  - `GET` 读能力：布局模板、货架模板、指定仓库当前 active layout。
  - `POST /rack-templates`：创建货架模板，校验编码、名称、层/列数和 A/B/C 位置。
  - `POST /warehouse-layouts`：校验仓库存在，在事务内停用旧 active layout 并创建新 active layout，`created_by` / `updated_by` 使用 JWT 当前用户 ID。
  - `PUT /warehouse-layouts/:layoutId`：使用 `layout_id + version` 乐观锁更新 header；冲突返回 `409 布局已被其他人修改，请刷新后重试`。
  - 保存 layout 时在同一事务内替换 zones/racks/maps。
  - 插入 `rack_slot_map` 前校验每个 `slot_id` 属于 layout warehouse。
  - `has_slots=false` 的外协仓如果传入 rack slot mapping，返回 `409 外协仓不能绑定货架库位`。
  - PostgreSQL 错误映射：
    - `23503` -> `409 引用的仓库、货架模板或库位不存在`
    - `23505` -> `409 布局元素重复`
    - `23514` / `22P02` -> `400`
- 新增 `WarehouseLayoutsController`：
  - `GET /warehouse-layout-templates`
  - `GET /rack-templates`
  - `GET /warehouse-layouts?warehouse=W1`
  - `POST /rack-templates`
  - `POST /warehouse-layouts`
  - `PUT /warehouse-layouts/:layoutId`
  - controller 使用 `@UseGuards(JwtAuthGuard, RolesGuard)`。
  - 写接口使用 `@Roles('ADMIN', 'BOSS')`。
- 在 `AppModule` 注册 controller/service。
- 在 `database.ts` 新增 `withDatabaseTransaction()`，不改变现有 `queryDatabase(text, values)` 调用方式。

## 测试结果

- `pnpm --filter @zr-wms/api test`
  - 18 files passed
  - 57 tests passed
- `pnpm --filter @zr-wms/api typecheck`
  - passed
- `pnpm --filter @zr-wms/api build`
  - passed
- 库存红线扫描：
  - 命令：`rg -n "\b(UPDATE|DELETE\s+FROM)\s+(inventory|stock_movement)\b|\b(inventory|stock_movement)\s+SET\b|INSERT\s+INTO\s+(inventory|stock_movement)" apps scripts start.sh -g '!scripts/sql/*.sql'`
  - 结果：无输出

## TDD RED/GREEN 证据

- RED：
  - 新增 `apps/api/src/warehouse-layouts/warehouse-layouts.service.spec.ts` 后运行：
    - `pnpm --filter @zr-wms/api test src/warehouse-layouts/warehouse-layouts.service.spec.ts`
  - 失败原因符合预期：
    - `Cannot find module './warehouse-layouts.service'`
  - 说明测试先于实现，捕获了缺失 service/controller 行为。
- GREEN：
  - 实现 service/controller/module/transaction helper 后重跑：
    - `pnpm --filter @zr-wms/api test src/warehouse-layouts/warehouse-layouts.service.spec.ts`
  - 结果：
    - 1 file passed
    - 6 tests passed

## 文件列表

- `apps/api/src/warehouse-layouts/warehouse-layouts.service.ts`
- `apps/api/src/warehouse-layouts/warehouse-layouts.controller.ts`
- `apps/api/src/warehouse-layouts/warehouse-layouts.service.spec.ts`
- `apps/api/src/app.module.ts`
- `apps/api/src/database.ts`
- `.superpowers/sdd/task-3-report.md`

## 自审

- 没有修改 `docs/wms_schema_v1.7.sql`、`docs/wms_procedures_v1.7.sql`、`docs/wms_logic_v1.7.sql`。
- 没有在应用层写 `inventory` 或 `stock_movement`。
- 保存 layout 的 header update、子表替换、slot validation 都在同一 transaction helper 内执行；失败会 rollback。
- controller 读接口只要求登录；写接口限制 `ADMIN` / `BOSS`。
- `request.user.userId` 沿用当前项目的 `CurrentUser` 实际字段名。

## 顾虑

- `rack_layout.zone_id` 保存时会先删除并重建 zones，所以 service 支持用输入 zone 的旧 `zone_id` 或 `zone_code` 映射到新插入的 zone；后续前端 Task 5 需要稳定采用其中一种方式。
- 当前未做真实数据库 smoke，因为任务要求的必跑验证是 API test/typecheck；本地自动化测试已覆盖关键 mapping、乐观锁、外协仓和 slot warehouse 校验。
