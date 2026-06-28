# WMS 第 6 刀第三部分：采购到货 + 缺料推衍

## 目标

- 采购单详情支持到货入库，生成入库流水并把 `ref_order_id` 指向订单。
- 生产单详情展示 `fn_order_mrp(order_id)` 的逐层毛需求、在库、缺口。

## 范围

- 新增 `POST /orders/:id/receive`，仅登录用户可用。
- 新增 `GET /orders/:id/mrp`，仅登录用户可用。
- 前端在订单详情中按订单类型显示采购到货或 MRP 面板。

## 约束

- 库存写操作只能调用 `op_inbound`，应用层不得 `UPDATE/DELETE inventory` 或 `stock_movement`。
- MRP 只能调用 `fn_order_mrp`，不在应用层重算 BOM。
- `operator_id` 使用 JWT 当前用户 id，不接受前端传值。
- 采购到货可更新 `order_line.qty_done/line_status`，这是订单状态记录，不属于库存写操作。

## 行为

- 到货请求必须指定采购行、产品、仓库、库位、数量；数量必须大于 0。
- 到货数量不得超过该采购行剩余数量。
- 到货成功后：
  - 调 `op_inbound(..., ref_order_id, operator_id)`。
  - 累加采购行 `qty_done`。
  - 行未收满标记为 `PARTIAL_RECEIVED`，收满标记为 `RECEIVED`。
- 非采购单调用到货返回 400；非生产单调用 MRP 返回 400。
- 存储过程业务错误映射成 409 中文消息。
