# WMS 全项目实施计划 — 给 coding agent 的逐刀指令

> 把这份和 AGENTS.md 放一起。每一刀是一段可直接复制给 coding agent 的指令。
> 核心原则：**一次只做一刀,从数据库打通到界面,跑通能演示了再做下一刀。**

## 怎么用这份计划

1. 每开一刀，先让 agent 读 AGENTS.md，再贴对应那段指令。
3. 每刀做完，照"验收"逐条确认，尤其那条红线：**应用层绝不直接改 `inventory` / `stock_movement`，库存写操作一律走 `op_*` 存储过程。**
4. 遇到它想"优化"数据模型、换 ORM、或一次做好几刀——拉回来。

## 路线图总览

| 刀 | 内容 | 状态 | 依赖 |
|---|---|---|---|
| 0 | 地基（建库 + 种子数据） | ✅ 已完成 | — |
| 1 | 搜索 | ✅ 已完成 | 0 |
| 2 | 薄鉴权 + 出入库/移库 | ✅ 已完成 | 1 |
| 3 | 库存看板 + 低库存预警 | ✅ 已完成 | 2 |
| 4 | 产品主数据 + BOM 管理 | ✅ 已完成 | 2 |
| 5 | 仓库与库位结构管理 | ✅ 已完成 | 2 |
| 6 | 订单 + 预留 + 缺料推衍 | ✅ 已完成 | 2、4、5 |
| 7 | 盘点 | ✅ 已完成 | 2 |
| 8 | 正向产能推衍（能做多少） | ✅ 已完成 | 4 |
| 9 | 横切收尾（报表/导入/价格/通知/权限硬化） | ⬜ | 全部 |

排序逻辑：先打通最高频的"读+写"（搜索、出入库），再补能看库存的看板；然后让管理员能脱离 SQL 维护产品/BOM/仓库（4、5）；这之后才有条件做订单这条最复杂的业务线（6）；盘点和产能推衍相对独立可穿插；横切类（报表/导入/价格/通知/完整权限）放最后统一收。

## 通用规则（写在每刀指令开头都适用）

- 开始前确认已读 AGENTS.md，遵守其架构约束。
- 库存写操作只能通过查询层调 `op_*` 存储过程；推衍只读调 `fn_*` 函数；绝不在应用层 UPDATE/DELETE `inventory` 或 `stock_movement`。
- 所有写操作的 operator 取自当前登录用户（token），不由前端传、不写死。
- 存储过程抛的业务错误（库存不足等）捕获后返回 409 + 中文消息，不要变 500。
- 严格沿用文档里的表名/字段名/端点路径（注意订单表是 `order_doc`）。
- 遇不确定先问；给可运行的最小实现；做完说明怎么本地验证。

---

## 第 3 刀：库存看板 + 低库存预警

> 纯读，做起来快。让"现在仓里有什么、哪里不够"一目了然。出入库（第 2 刀）跑通后库里才有真实数据，这刀才有意义。

```
本刀只读，不涉及任何写操作。按 API 清单实现：

后端端点（均需登录）：
- GET /inventory               → 查 inventory 快照，支持 ?product= &warehouse= &slot= &quality=，可跨仓
- GET /inventory/summary?product= → 数量桶：总/可用/冻结。可用=在库−预留，用 fn_available 或按 reservation 汇总算
- GET /products/{id}/locations → 某产品在哪些库位有多少（按 product 聚合 slot）
- GET /slots/{id}/products     → 某库位上有哪些产品（按 slot 聚合 product）
- GET /reports/low-stock       → 低库存预警：按产品总库存(跨仓求和) < product.safety_stock 列出

前端：
- 库存看板页：按仓库/产品/质量态筛选的表格，可跨仓；列出 产品·库位·质量态·在库·可用·冻结
- 低库存预警：一个醒目列表/徽标，显示低于安全库存的产品

验收：
1. 入几笔库后，看板显示数量正确，可用随预留变化
2. 把某产品 safety_stock 设高于其总库存 → 出现在低库存列表
3. 确认全程无任何写操作
```

---

## 第 4 刀：产品主数据 + BOM 管理

> 让管理员能脱离 SQL 维护产品和配方。这刀打通后，客户才能自己录入真实的产品目录。

```
本刀分两部分。先做产品主数据，确认后再做 BOM。

════ 第一部分：产品主数据 ════
后端端点：
- POST   /products                       → 新增产品（生成唯一 ID，按 RM/SF/FG/ACC 前缀）。需 ADMIN
- PATCH  /products/{id}                   → 改产品，含改编码(=产品ID维护)。需 ADMIN
- DELETE /products/{id}                   → 停用：软删 active=false，绝不物理删除
- POST   /products/{id}/aliases           → 加人工别名（每产品≤10，可跨产品重复）。全角色
- DELETE /products/{id}/aliases/{aliasId} → 删别名
- POST   /products/{id}/images            → 传产品图（≤3）。图存对象存储(OSS/S3)，库里 product_image 只存 URL。需 ADMIN

前端：产品列表 + 新增/编辑表单 + 别名管理 + 图上传。复用搜索组件做查找。

════ 第二部分：BOM 管理（确认第一部分后做）════
后端端点：
- GET /products/{id}/bom            → 查看配方（含子项顺序 seq、用量 qty）
- PUT /products/{id}/bom            → 改配方。需 ADMIN
- POST /bom/regenerate-aliases      → 调 fn_regen_path_aliases() 全量重算路径别名。需 ADMIN
- GET /products/{id}/where-used     → 调 fn_where_used()
- GET /products/{id}/path-aliases   → 查 bom_path_alias

硬约束：
- 任何改 BOM 的操作成功后，必须调 fn_regen_path_aliases() 重算别名，别让别名和 BOM 脱节
- 子项顺序(seq)决定 -1/-2 编号，由管理员设定；前端要能调整顺序

前端：BOM 编辑器（加/删子项、设用量、拖动排序）；展示该产品的路径别名和 where-used。

验收：
1. 新建一个成品 + 两个半成品 + 原料，建好 BOM，调重算后路径别名正确生成
2. 改子项顺序 → 重算后 -1/-2 跟着变
3. 停用一个产品 → 它消失于列表但库里仍在（active=false）
4. 加的别名能被搜索（第1刀）搜到
```

---

## 第 5 刀：仓库与库位结构管理

> 让管理员能搭出三个仓库的物理结构。结构性操作按权限矩阵收口到管理员/老板。

```
后端端点（结构性操作需 ADMIN）：
- GET  /warehouses                         → 仓库列表（含外协库 has_slots=false）
- POST /warehouses                         → 新增仓库（类型：普通/模具/外协）
- GET  /warehouses/{id}/slots              → 库位列表
- POST /warehouses/{id}/slots:template     → 按"排×列×层×前中后(abc)"模板批量生成库位，编码如 W1-R03-C12-L2-A
- PATCH /slots/{id}                        → 改库位状态：可用/占用/不可用/合并（如不可用-原因"消防栓"）

前端：
- 仓库列表 + 新增
- 库位模板生成器：填排数/列数/层数/每层位置，预览将生成的编码，确认后批量建
- 库位状态编辑：把某库位标不可用并填原因，或标合并到另一库位

硬约束：
- 外协仓 has_slots=false，不生成库位
- 仓/排/列/层/筐数全部可配置，不要写死

验收：
1. 建一个仓库，用模板生成一批库位，编码格式正确
2. 把一个库位标"不可用-消防栓"，出入库时该库位不可选
3. 操作员登录时这些结构性操作不可用（403）
```

---

## 第 6 刀：订单 + 预留 + 缺料推衍

> 最复杂的业务线。建议拆成三部分逐步做。依赖第 4、5 刀（要有产品/BOM/库位）。

```
本刀分三部分，逐部分确认。

════ 第一部分：订单骨架 ════
- GET  /orders            → 列表，?type=PURCHASE|PRODUCTION &status=
- POST /orders            → 建单（表头 order_doc + 明细 order_line）
- GET  /orders/{id}       → 详情（表头 + 行级状态）
- PATCH /orders/{id}      → 改表头/状态
状态机（落在明细行 line_status）：
  采购单：待处理/部分到货/已入库/已完成/已取消
  生产单：待处理/部分缺料/已配料/生产中/已产出/已取消
关键规则：生产订单产出成品即结束，不含出库发货；采购/生产是仅有的两类。
前端：订单列表 + 建单 + 详情页（按类型显示对应状态机）。

════ 第二部分：预留 + 履约（确认后做）════
- POST /reservations              → 调 op_reserve（库位人工指定；冲突即提示占用/不足）
- POST /reservations/{id}/fulfill → 调 op_fulfill_reservation（冻结消耗、出库、挂回订单）
- POST /reservations/{id}/release → 调 op_release_reservation（取消，冻结回可用）
- GET  /orders/{id}/reservations  → 该订单预留明细
规则：预留只插 reservation、不改 on_hand；可用由 fn_available 自动算。
前端：订单详情里给每行做"预留(选库位)→履约"的操作。

════ 第三部分：采购到货 + 缺料推衍（确认后做）════
- POST /orders/{id}/receive  → 采购到货自动入库：调 op_inbound 并传 ref_order_id=该订单
- GET  /orders/{id}/mrp      → 调 fn_order_mrp，展示逐层净需求"差几个原料"
前端：采购单"到货"按钮触发入库；生产单详情展示缺料推衍结果（毛需求/在库/缺口，按层）。

硬约束：预留/履约/到货全走对应 op_* 存储过程，不直接改库存。

验收：
1. 建生产单 → 看 MRP 缺料结果，缺口数对得上库存
2. 预留一笔 → 可用下降、在库不变；履约 → 在库下降、流水挂回订单
3. 释放预留 → 可用回升
4. 采购单到货 → 自动生成入库流水，ref_order_id 指向该订单
```

---

## 第 7 刀：盘点

> 相对独立，可随时穿插。

```
后端端点：
- POST /stocktakes                    → 发起盘点
- POST /stocktakes/{id}/lines         → 录入实盘明细（系统带出账面 system_qty）
- POST /stocktake-lines/{id}/apply    → 调 op_apply_stocktake_line：审核→生成调整流水→库存归到实盘。需 ADMIN

关键规则：调整以实盘为准（op_apply_stocktake_line 内部实时读当前账面、把库存归到实盘数）。

前端：发起盘点 → 逐项录实盘 → 看差异 → 管理员审核应用。

验收：
1. 某库位账面 25，录实盘 33 → 应用后库存归 33，生成一条 ADJUST 流水
2. 实盘=账面 → 应用无动作（不生成流水）
3. 操作员不能应用（403），只有管理员能
```

---

## 第 8 刀：正向产能推衍（能做多少）

> 点击触发的计算工具，非实时渲染。依赖第 4 刀（要有 BOM）。

```
后端端点（只读）：
- GET /products/{id}/producible                        → 调 fn_max_producible（单层：直接子项口径）
- GET /products/{id}/producible?deep=true              → 调 fn_max_producible_deep（跨层，用半成品库存）
- GET /products/{id}/producible?deep=true&useSfStock=false → 全部从原料做起

前端：选一个半成品/成品 → 点"计算" → 显示最多能做多少 + 卡脖子的物料。
注意：是点击才算，不要随输入实时请求。

验收：
1. 选一个成品，深度计算结果 = 各共需料(含配件)里的最短板
2. 把卡脖子那个料补足 → 瓶颈正确转移到下一个料
3. 单层 vs 深度结果不同时，能看出深度版考虑了"半成品可由原料补做"
```

---

## 第 9 刀：横切收尾

> 前面每刀都是垂直功能，这刀把跨功能的东西统一补齐。可拆开分批做。

```
分模块做，每块独立可验收。

A. 报表与导出（✅ 已完成）：
- GET /reports/period?range=day|week|month → 日/周/月报（聚合 stock_movement）
- GET /reports/dead-stock                   → 呆滞库存（长期无流水）
- GET /reports/slot-utilization             → 库位利用率
- POST /export                              → 导出 Excel（库存/流水/报表）

B. 初始数据导入（✅ 已完成）：
- POST /import/inventory → 初始库存 Excel 导入（批量写 inventory + 对应 stock_movement）。需 ADMIN
- POST /import/products  → 产品批量导入。需 ADMIN
- POST /import/bom       → BOM 批量导入，导入后调 fn_regen_path_aliases()。需 ADMIN

C. 价格：
- GET /products/{id}/price → 查看价格（入货/加工/损耗/出货）。需 ADMIN
- PUT /products/{id}/price → 改价格。仅 BOSS

D. 通知 + 定时任务：
- 定时扫描低库存 → 邮件/企微推送
- 定时生成日/周/月报
- 与实时 API 分开跑（独立的 scheduler/worker），别拖慢正常出入库

E. 权限硬化 + 收尾：
- 按角色隐藏导航菜单（操作员只见日常操作；老板见报表/价格）
- 全量复核每个端点的 @Roles，确保权限矩阵无遗漏
- 操作日志查看页：GET /operation-logs（改 BOM/库位/登录等动作，需 ADMIN）
- 全局乐观锁：可变资源带 version，冲突返回 409 提示"刷新后重试"

验收：
1. 初始库存 Excel 导入后，看板数字对、且生成了对应流水
2. 操作员看不到价格菜单；管理员能看不能改；老板能改
3. 低库存定时任务能触发一条通知
4. 各端点权限和矩阵一致
```

---

## 收尾之后

跑完这九刀，你就有一套完整可用的 WMS。再往后是**上线相关**而非功能：
- 部署到云（前端 + 后端 + 托管 PostgreSQL），开 HTTPS
- **开数据库备份 / PITR**（流水是真相，这步上线前必须做）
- 配好对象存储桶
- 拿真实数据让嫂子和操作员试用一轮（UAT），按反馈微调

之后的增强项（功能清单里标了后续的）：伪 3D 货架可视化、BOM 版本化、ERP 集成、高级报表——都等核心跑顺、客户用上之后再说。
