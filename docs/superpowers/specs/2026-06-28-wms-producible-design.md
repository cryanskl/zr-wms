# WMS 第 8 刀：正向产能推衍

## 目标

- 用户选择一个半成品或成品后，点击计算当前库存最多能做多少。
- 支持单层计算和深度计算。
- 支持深度计算时选择是否使用现有半成品库存。

## 范围

- `GET /products/{id}/producible`
- `GET /products/{id}/producible?deep=true`
- `GET /products/{id}/producible?deep=true&useSfStock=false`
- 前端在产品管理里新增“产能推衍”面板。

## 约束

- 本刀纯读，不写库存、不写 BOM、不写流水。
- 单层计算必须调用 `fn_max_producible(p_target)`。
- 深度计算必须调用 `fn_max_producible_deep(p_target, p_use_sf_stock)`。
- 不在应用层重算 BOM、库存或瓶颈。
- 前端必须点击才计算，不随输入或选择实时请求。

## 响应形态

- 单层返回：`target`、`maxMake`、`limiting`、`limitingOnHand`。
- 深度返回：`target`、`maxMake`、`limiting`、`limitingOnHand`、`limitingDemand`。
- 原材料/配件等无 BOM 产品由数据库函数抛错，后端映射为中文 409。

## 验收

- 单层结果只看直接子项。
- 深度结果取整棵 BOM 叶子料最短板，配件也参与卡脖子。
- `useSfStock=false` 时深度计算不使用半成品库存。
- 前端同一产品可以点击比较三种模式。
