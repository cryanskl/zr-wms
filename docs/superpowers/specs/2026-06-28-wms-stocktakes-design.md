# WMS 第 7 刀：盘点

## 目标

- 操作员可以发起盘点并录入实盘明细。
- 管理员可以审核应用盘点行，生成调整流水，并把库存归到实盘数。
- 前端提供最小可运行流程：发起盘点 -> 逐项录实盘 -> 看差异 -> 管理员应用。

## 范围

- `POST /stocktakes`
- `POST /stocktakes/{id}/lines`
- `POST /stocktake-lines/{id}/apply`
- 前端新增“盘点”视图。

## 约束

- `stocktake` 和 `stocktake_line` 直接写业务单据表。
- 任何影响库存快照和库存流水的动作只能调用 `op_apply_stocktake_line`。
- 应用层不得 `UPDATE/DELETE inventory` 或 `stock_movement`。
- `created_by` 和 `operator_id` 均来自 JWT 当前用户。
- 应用盘点行需要 `ADMIN`。
- 存储过程业务错误返回 409 + 中文消息。

## 行为

- 发起盘点支持传 `warehouse_id`，默认状态 `COUNTING`。
- 录入明细必须传 `product_id`、`slot_id`、`counted_qty`，可选 `batch_id`。
- `system_qty` 在录入时从当前 `inventory` 的 `GOOD` 库存读取；无快照行时为 0。
- 录入成功返回 `stline_id`、`system_qty`、`counted_qty`、`diff`。
- 应用成功返回 `movement_id`；若实盘等于应用时账面，存储过程返回 `NULL`，前端显示“无需调整”。
