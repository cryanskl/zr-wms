# 2026-06-30 仓库可视化切片修复记录

## 背景

执行 `docs/superpowers/plans/2026-06-29-wms-warehouse-visualization.md` 时发现并修复以下问题。

## 已修复问题

1. `rack_layout.zone_id` 可跨 layout 绑定。
   - 风险：A 仓库布局里的货架可能挂到 B 布局的区域。
   - 修复：为 `layout_zone(zone_id, layout_id)` 增加复合唯一约束，并让 `rack_layout(zone_id, layout_id)` 复合引用它。

2. `rack_slot_map.slot_id` 可跨 warehouse 绑定。
   - 风险：W1 的布局可能绑定 W2 的真实库位。
   - 修复：增加 `validate_rack_slot_map_warehouse()` 触发器，校验 slot 所属仓库必须等于 layout 所属仓库。

3. 产品可视化位置 SQL 引用了不存在的 `inventory.reserved_qty`。
   - 风险：`GET /products/:id/visual-locations` 在真实 PostgreSQL 上会报错。
   - 修复：改用权威 SQL 中的 `fn_available(product, warehouse, slot, batch, quality)` 计算可用量，并由 `qty_on_hand - available_qty` 推出预留/冻结量。

4. 产品可视化位置 SQL 使用了不存在的排序列 `rl.rack_code`。
   - 风险：真实查询执行失败。
   - 修复：使用真实列 `rl.code`，对外仍返回 alias `rack_code`。

5. 前端仓库地图保存 payload 会丢失“新建区域 + 新建货架”的关联。
   - 风险：管理员同次新增区域和货架后保存，货架变成未归属区域。
   - 修复：保存 payload 对临时负数 zone 建立 `zone_id -> code` 映射，并在 rack payload 中发送后端可解析的 `zone_code`。

6. `.superpowers/sdd/task-*-report.md` 曾被误纳入提交。
   - 风险：开发过程文件污染 repo。
   - 修复：从 git 追踪中移除，确认 `git ls-files .superpowers` 无输出，保留 `.gitignore` 对 `.superpowers/` 的忽略。

## 验证

- `pnpm test` 通过。
- `pnpm typecheck` 通过。
- `pnpm build` 通过；仅有既有 Vite large chunk warning。
- 库存红线扫描无输出。
- `git diff --check` 通过。
