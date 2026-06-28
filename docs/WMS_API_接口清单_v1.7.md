# 汽配 WMS — API 接口清单

**版本 V1.7 ｜ 2026-06-28 ｜ 后端 PostgreSQL + 响应式网页（云部署）**

本清单把功能清单与数据层（schema / 存储过程 / 业务逻辑）映射成 REST 端点，作为前后端契约。每个端点标注了**后端映射**（对应的存储过程或查询）和**最低角色**。这是前端开工前要先定下来的那层。

---

## 0. 通用约定

- **Base URL**：`/api/v1`
- **认证**：除登录外，所有请求带 `Authorization: Bearer <token>`；后端按 `app_user.role` 鉴权。
- **角色简写**：`全`＝三角色均可 ｜ `管+`＝管理员及以上 ｜ `老板`＝仅老板。读操作三角色基本都放开，写/结构/价格按权限矩阵收口。
- **错误格式**：`{ "error": { "code": "INSUFFICIENT_STOCK", "message": "可用 60，需出 70" } }`。库存不足、占用冲突等业务错误返回 `409`；鉴权 `401/403`；校验 `400`。
- **并发**：可变资源（库存、预留）响应带 `version`；前端提交时回传，后端不一致返回 `409 STALE`，提示"刷新后重试"。
- **分页**：列表类用 `?page=&size=`（默认 size=50），响应含 `total`。
- **金额/数量**：数量 `numeric`，单位只计数量（不计重量）。

---

## 1. 认证

| Method | Path | 说明 | 后端映射 | 权限 |
|---|---|---|---|---|
| POST | `/auth/login` | 登录换 token | `app_user` | 公开 |
| GET | `/auth/me` | 当前用户与角色 | `app_user` | 全 |

---

## 2. 产品主数据

| Method | Path | 说明 | 后端映射 | 权限 |
|---|---|---|---|---|
| GET | `/products` | 列表/筛选（`?type=&active=`） | `product` | 全 |
| GET | `/products/{id}` | 单个产品（含别名、属性、图、路径别名） | `product`+`product_alias`+`product_image`+`bom_path_alias` | 全 |
| POST | `/products` | 新增产品（生成唯一 ID） | `product` | 管+ |
| PATCH | `/products/{id}` | 改产品（含**改编码＝产品 ID 维护**） | `product` | 管+ |
| DELETE | `/products/{id}` | 停用（软删 `active=false`，永不物删） | `product` | 管+ |
| GET | `/products/recent` | 最近填写/最近订单的产品（**按当前用户**） | `recent_use` | 全 |
| POST | `/products/{id}/aliases` | 加人工别名（≤10，可跨产品重复） | `product_alias` | 全 |
| DELETE | `/products/{id}/aliases/{aliasId}` | 删别名 | `product_alias` | 全 |
| POST | `/products/{id}/images` | 传产品图（≤3） | `product_image` | 管+ |

---

## 3. 搜索与定位（客户首要诉求："查得快、查得准"）

| Method | Path | 说明 | 后端映射 | 权限 |
|---|---|---|---|---|
| GET | `/search?q=` | 跨**名称/别名/路径别名/备注**模糊查 | `pg_trgm` GIN 索引（4 张表 union） | 全 |
| GET | `/products/{id}/locations` | 某产品在**哪些货架/库位** | `inventory`（按 product 聚合 slot） | 全 |
| GET | `/slots/{id}/products` | 某库位上**有哪些产品** | `inventory`（按 slot 聚合 product） | 全 |
| GET | `/locations/{code}/products` | 按库位编码（`W1-R03-C12-L2-A`）查 | `slot`+`inventory` | 全 |

> 搜索示例
> ```http
> GET /api/v1/search?q=带管子
> → [{ "product_id":"FG-7L0199131F", "name":"...", "matched":"alias", "snippet":"带管子" }, ...]
> ```
> 路径别名也可直接搜（如 `FG-7L0199131F-1-1` 命中其原料）。前端展示时可去掉 `FG-/SF-/RM-` 前缀。

---

## 4. BOM 与路径别名

| Method | Path | 说明 | 后端映射 | 权限 |
|---|---|---|---|---|
| GET | `/products/{id}/bom` | 查看配方（含子项顺序 seq、用量） | `bom_line` | 全 |
| PUT | `/products/{id}/bom` | 改配方（子项顺序决定 -1/-2） | `bom_line` | 管+ |
| GET | `/products/{id}/where-used` | 该料用在哪些半成品/成品（`?recursive=`） | `fn_where_used()` | 全 |
| GET | `/products/{id}/path-aliases` | 该料的全部路径别名 | `bom_path_alias` | 全 |
| POST | `/bom/regenerate-aliases` | **改完 BOM 后**触发全量重算路径别名 | `fn_regen_path_aliases()` | 管+ |

---

## 5. 库存查询

| Method | Path | 说明 | 后端映射 | 权限 |
|---|---|---|---|---|
| GET | `/inventory` | 快照查询（`?product=&warehouse=&slot=&quality=`，**可跨仓**） | `inventory` | 全 |
| GET | `/inventory/summary?product=` | 数量桶：总/可用/冻结（可用=在库−预留） | `inventory`+`reservation`/`fn_available` | 全 |

---

## 6. 出入库与移库

| Method | Path | 说明 | 后端映射 | 权限 |
|---|---|---|---|---|
| POST | `/inbound` | 入库（原料/配件/半成品/成品/退货） | `op_inbound()` | 全 |
| POST | `/outbound` | 出库（成品/半成品/配件/损耗）；不足默认拦截 | `op_outbound()` | 全 |
| POST | `/outbound?force=true` | 强制出库（库存不足时） | `op_outbound(p_allow_negative=true)` | **管+** |
| POST | `/transfer` | 移库（库位间，产品总量零和） | `op_transfer()` | 全 |

> 入库示例
> ```http
> POST /api/v1/inbound
> { "product":"RM-0123","warehouse":"W1","qty":100,"slot":12,"batch":5,"type":"IN","refOrder":8 }
> → { "movementId": 1 }
> ```

---

## 7. 库存流水与冲正

| Method | Path | 说明 | 后端映射 | 权限 |
|---|---|---|---|---|
| GET | `/movements` | 流水查询（`?product=&operator=&from=&to=&type=`） | `stock_movement` | 全 |
| GET | `/products/{id}/movements` | 某产品历史流水 | `stock_movement` | 全 |
| POST | `/movements/{id}/reverse` | 冲正（原条目作废 + 反向流水） | `op_reverse_movement()` | 全 |
| — | （流水不可删除，只能作废/冲正） | DB 触发器强制 | `forbid_movement_delete` | — |
| GET | `/operation-logs` | 操作日志（改 BOM/库位/登录等，区别于库存流水） | `operation_log` | 管+ |

---

## 8. 预留（订单占用：可用↔冻结，库位人工指定）

| Method | Path | 说明 | 后端映射 | 权限 |
|---|---|---|---|---|
| POST | `/reservations` | 预留（人工指定库位；冲突即提示占用/不足） | `op_reserve()` | 全 |
| POST | `/reservations/{id}/fulfill` | 履约→出库（冻结消耗、挂回订单） | `op_fulfill_reservation()` | 全 |
| POST | `/reservations/{id}/release` | 释放（订单取消，冻结回可用） | `op_release_reservation()` | 全 |
| GET | `/orders/{id}/reservations` | 订单的预留明细 | `reservation` | 全 |

---

## 9. 订单与缺料推衍（规则引擎）

| Method | Path | 说明 | 后端映射 | 权限 |
|---|---|---|---|---|
| GET | `/orders` | 订单列表（`?type=PURCHASE\|PRODUCTION&status=`） | `order_doc` | 全 |
| POST | `/orders` | 建单（采购/生产）+ 明细行 | `order_doc`+`order_line` | 全 |
| GET | `/orders/{id}` | 单详情（表头 + 行级状态） | `order_doc`+`order_line` | 全 |
| PATCH | `/orders/{id}` | 改表头/状态 | `order_doc` | 全 |
| POST | `/orders/{id}/receive` | **采购到货→自动入库**（订单联动） | `op_inbound(refOrder)` | 全 |
| GET | `/orders/{id}/mrp` | **缺料推衍**：逐层净需求，显示差几个原料 | `fn_order_mrp()` | 全 |

> 缺料推衍示例（生产订单）
> ```http
> GET /api/v1/orders/1/mrp
> → [
>   { "product":"FG-A","type":"FG","lvl":0,"gross":10,"onHand":0,"net":10 },
>   { "product":"SF-B","type":"SF","lvl":1,"gross":20,"onHand":5,"net":15 },
>   { "product":"RM-E","type":"RM","lvl":2,"gross":45,"onHand":30,"net":15 }  // ← 缺 15
> ]
> ```
> 按"不算其他订单已占用"口径，用总在库计算。

---

## 10. 正向产能推衍（点击触发，非实时渲染）

| Method | Path | 说明 | 后端映射 | 权限 |
|---|---|---|---|---|
| GET | `/products/{id}/producible` | **单层**：当前库存能做多少（直接子项口径） | `fn_max_producible()` | 全 |
| GET | `/products/{id}/producible?deep=true` | **深度**：跨层最多能做几个 + 卡脖子料 | `fn_max_producible_deep()` | 全 |
| GET | `/products/{id}/producible?deep=true&useSfStock=false` | 深度但全部从原料做起（不用半成品库存） | `fn_max_producible_deep(false)` | 全 |

> 深度推衍正确处理：多个半成品/**配件**需"一起"组成成品 → 取最短板；共用原料用量累加。
> ```http
> GET /api/v1/products/FG-A/producible?deep=true
> → { "target":"FG-A","maxMake":7,"limiting":"ACC-G","limitingOnHand":7 }
> ```

---

## 11. 仓库与库位（结构性操作收口到管+）

| Method | Path | 说明 | 后端映射 | 权限 |
|---|---|---|---|---|
| GET | `/warehouses` | 仓库列表（含外协库 has_slots=false） | `warehouse` | 全 |
| POST | `/warehouses` | 新增仓库 | `warehouse` | **管+** |
| GET | `/warehouses/{id}/slots` | 库位列表 | `slot` | 全 |
| POST | `/warehouses/{id}/slots:template` | 按"排×列×层×前中后"模板批量生成库位 | `slot` | **管+** |
| PATCH | `/slots/{id}` | 改库位状态（占用/不可用/合并，如消防栓） | `slot` | **管+** |

---

## 12. 盘点

| Method | Path | 说明 | 后端映射 | 权限 |
|---|---|---|---|---|
| POST | `/stocktakes` | 发起盘点 | `stocktake` | 全 |
| POST | `/stocktakes/{id}/lines` | 录入实盘明细（系统带出账面） | `stocktake_line` | 全 |
| POST | `/stocktake-lines/{id}/apply` | 审核→生成调整流水→**库存归到实盘** | `op_apply_stocktake_line()` | 管+ |

---

## 13. 报表与预警

| Method | Path | 说明 | 后端映射 | 权限 |
|---|---|---|---|---|
| GET | `/reports/low-stock` | 低库存预警（**总库存** < 安全库存） | `product.safety_stock`+`inventory` | 全 |
| GET | `/reports/period?range=day\|week\|month` | 日/周/月报 | `stock_movement` 聚合 | 全 |
| GET | `/reports/dead-stock` | 呆滞库存（长期无流水） | `stock_movement`+`inventory` | 全 |
| GET | `/reports/slot-utilization` | 库位利用率 | `slot`+`inventory` | 全 |
| POST | `/export` | 导出 Excel（库存/流水/报表） | 服务端生成 | 全 |
| POST | `/notifications/test` | 邮件/企微推送（后续） | 通知服务 | 管+ |

---

## 14. 导入

| Method | Path | 说明 | 后端映射 | 权限 |
|---|---|---|---|---|
| POST | `/import/inventory` | 初始库存 Excel 导入 | 批量写 `inventory`+`stock_movement` | 管+ |
| POST | `/import/products` | 产品批量导入 | `product` | 管+ |
| POST | `/import/bom` | BOM 批量导入（导入后触发别名重算） | `bom_line`+`fn_regen_path_aliases()` | 管+ |

---

## 15. 价格（后续阶段，P2）

| Method | Path | 说明 | 后端映射 | 权限 |
|---|---|---|---|---|
| GET | `/products/{id}/price` | 查看价格（入货/加工/损耗/出货） | `price` | 管+ |
| PUT | `/products/{id}/price` | 改价格 | `price` | **老板** |

---

## 16. 用户与权限

| Method | Path | 说明 | 后端映射 | 权限 |
|---|---|---|---|---|
| GET | `/users` | 用户列表 | `app_user` | 管+ |
| POST | `/users` | 新增用户/分配角色 | `app_user` | 管+ |
| PATCH | `/users/{id}` | 改角色/归属仓/停用 | `app_user` | 管+ |

---

## 端点 → 数据层映射小结

- **写库存的端点**（入库/出库/移库/冲正/履约/盘点应用）一律走对应 `op_*` 存储过程，保证"写流水 + 改快照"原子化，绝不让前端直接 UPDATE `inventory`。
- **推衍类端点**（mrp / producible / where-used）走只读 `fn_*` 业务函数。
- **主数据/结构类**端点直接 CRUD 对应表，权限按矩阵收口。
- 路径别名是**派生数据**：只读端点暴露，写端点只有"改 BOM"和"重算别名"。

## 建议的实现顺序

1. 认证 + 产品主数据 + **搜索**（客户最在意，先让"查得快查得准"跑起来）。
2. 库存查询 + 出入库 + 流水。
3. 订单 + 预留 + 缺料推衍。
4. 盘点 + 报表/预警 + 导入导出。
5. 价格、通知等后续项。
