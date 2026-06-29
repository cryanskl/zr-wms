# WMS 仓库可视化设计

日期：2026-06-29
状态：待用户评审
范围：前端样式重构 + 仓库平面图/货架立面图 + 产品跨仓定位
依据：当前 WMS 已完成仓库、库位、库存、产品搜索、产品位置查询等基础能力；本设计不改变库存写入路径。

## 目标

为 WMS 增加一层“仓库空间可视化”：

- 管理员能为 4 个不同仓库分别设计平面图。
- 管理员能复用仓库模板和货架模板，再按真实现场拖拽微调。
- 操作员选择产品类型和产品后，能从图中看到产品所在仓库、货架、层位、库位。
- 一个产品分布在多个仓库或多个货架时，必须全部高亮并列出明细。
- 支持俯视图和仰视/货架立面图切换：俯视图定位到仓库/货架，立面图定位到层和格。

## 非目标

- 不做库存写入逻辑重构。
- 不在前端直接改 `inventory` 或 `stock_movement`。
- 不做完整 3D 仓库。第一版是可配置 2D/2.5D 视图，后续可升级 Three.js。
- 不自动推荐出库库位。第一版只做视觉定位。
- 不要求每个仓库必须有同一套形状；4 个仓库可以完全不同。

## 用户角色

### 管理员

管理员负责设计仓库空间：

- 新建/编辑每个仓库的平面图。
- 套用仓库模板：平行货架、密集窄巷、分区混合、外协无货架。
- 套用货架模板：排 × 列 × 层 × A/B/C。
- 拖动货架、通道、收发货区、质检区、暂存区等元素。
- 将真实 `slot` 绑定到可视化货架格位。
- 保存布局版本。

### 操作员

操作员只使用定位视图：

- 搜索或筛选产品类型：成品、半成品、原材料、配件。
- 查看产品在哪些仓库、货架、库位、质量态、数量。
- 点击某个位置卡片后，图中定位并高亮。
- 切换俯视图和立面图，看清库位在仓库中的空间位置。

## 信息架构

新增一个主入口：`仓库地图`。

建议导航拆分：

- `库存看板`：继续保留表格、低库存预警、筛选查询。
- `仓库库位`：继续保留仓库与库位主数据管理。
- `仓库地图`：新增空间可视化与产品定位。

`仓库地图` 内部有两个模式：

- `定位模式`：默认给所有已登录用户，用于查产品位置。
- `设计模式`：仅管理员及以上可见，用于编辑仓库布局。

## 页面布局

### 桌面端

采用三栏结构：

- 左栏：4 个仓库卡片。
  - 每张卡显示仓库名、类型、库位数、占用率、小缩略图。
  - 产品命中时，在相关仓库卡片上显示高亮和命中数量。
- 中栏：仓库画布。
  - 顶部工具条：俯视图/立面图切换、缩放、适配屏幕、保存布局。
  - 俯视图显示货架、通道、收发货区、质检区、暂存区。
  - 立面图显示选中货架的列、层、A/B/C 位置。
- 右栏：产品定位面板。
  - 产品搜索框。
  - 产品类型 segmented control：RM/SF/FG/ACC。
  - 位置卡片列表：仓库、货架、库位、质量态、数量、批次。
  - 点击卡片后，中间画布定位到对应空间位置。

### 移动端

采用上下结构：

- 顶部：产品搜索和类型筛选。
- 中部：仓库横向卡片。
- 主体：可缩放平面图。
- 底部抽屉：位置列表和库存明细。

移动端默认进入定位模式；设计模式可以允许查看，但不优先支持精细拖拽。

## 视觉规则

- 颜色不按单一蓝/紫主题；采用工作型界面：白底、浅灰画布、绿色/黄色/红色状态点。
- 货架是深灰块，库位格是小矩形。
- 当前选中产品：
  - 良品：黄色高亮。
  - 不良品：红色高亮。
  - 其他有库存但非当前产品：绿色。
  - 空库位：浅灰。
- 多仓分布时，所有命中仓库在左栏同步高亮。
- 位置卡片和画布高亮状态必须双向联动。

## 数据模型设计

新增数据只描述可视化布局，不做库存真相。

### `warehouse_layout`

每个仓库可以有一个当前生效布局，也可以保留历史版本。

字段建议：

- `layout_id bigint primary key`
- `warehouse_id text references warehouse(warehouse_id)`
- `name text`
- `version int`
- `is_active boolean`
- `canvas_width numeric`
- `canvas_height numeric`
- `grid_size numeric`
- `created_by bigint references app_user(user_id)`
- `updated_by bigint references app_user(user_id)`
- `created_at timestamptz`
- `updated_at timestamptz`

### `layout_zone`

表示通道、区域、收发货区、质检区等非货架元素。

字段建议：

- `zone_id bigint primary key`
- `layout_id bigint references warehouse_layout(layout_id)`
- `type text`：`AISLE` / `DOCK` / `QC` / `TEMP` / `OFFICE` / `CUSTOM`
- `label text`
- `x numeric`
- `y numeric`
- `width numeric`
- `height numeric`
- `rotation numeric`
- `style jsonb`

### `rack_template`

货架模板，可跨仓库复用。

字段建议：

- `template_id bigint primary key`
- `name text`
- `rack_kind text`：`STANDARD` / `PALLET` / `SHELF` / `CUSTOM`
- `bay_count int`
- `level_count int`
- `position_codes text[]`：例如 `A,B,C`
- `default_width numeric`
- `default_height numeric`
- `created_by bigint`
- `created_at timestamptz`

### `rack_layout`

表示某个仓库平面图中的一个货架实例。

字段建议：

- `rack_layout_id bigint primary key`
- `layout_id bigint references warehouse_layout(layout_id)`
- `template_id bigint references rack_template(template_id)`
- `rack_code text`：例如 `R03`
- `label text`
- `x numeric`
- `y numeric`
- `width numeric`
- `height numeric`
- `rotation numeric`
- `status text`：`ACTIVE` / `DISABLED`

### `rack_slot_map`

把真实库位 `slot.slot_id` 绑定到可视化货架格位。

字段建议：

- `map_id bigint primary key`
- `rack_layout_id bigint references rack_layout(rack_layout_id)`
- `slot_id bigint references slot(slot_id)`
- `bay_no int`
- `level_no int`
- `position_code text`

约束：

- 同一 `layout_id` 下，一个 `slot_id` 只能绑定一次。
- 外协仓 `has_slots=false` 不要求 `rack_slot_map`，可使用 `layout_zone` 表示供应商区或暂存区。

## API 设计

所有接口都使用现有 JWT 鉴权。

### 布局读取

`GET /warehouse-layouts?warehouse=W1`

返回当前生效布局：

- 仓库画布尺寸。
- zones。
- racks。
- rack-slot mappings。
- 模板信息。

权限：登录即可查看。

### 保存布局

`PUT /warehouse-layouts/{layoutId}`

保存管理员对布局元素的调整。

权限：`ADMIN` / `BOSS`。

行为：

- 校验仓库存在。
- 校验绑定的 `slot_id` 属于该仓库。
- 校验外协仓不绑定真实货架库位。
- 使用 `version` 做乐观锁，冲突返回 409 “刷新后重试”。

### 创建布局

`POST /warehouse-layouts`

用于给某个仓库创建初始布局。

权限：`ADMIN` / `BOSS`。

输入：

- `warehouse_id`
- `template_id` 可选
- `name`
- `canvas_width`
- `canvas_height`

### 仓库模板

`GET /warehouse-layout-templates`

返回系统内置模板：

- 平行货架
- 密集窄巷
- 分区混合
- 外协无货架

第一版模板可以写在应用配置或数据库 seed 中；如果后续客户频繁新增模板，再做模板管理页。

### 货架模板

`GET /rack-templates`

返回货架模板。

`POST /rack-templates`

新增货架模板。

权限：`ADMIN` / `BOSS`。

### 产品空间定位

`GET /products/{id}/visual-locations`

返回产品所有库存位置，聚合现有库存和布局映射。

返回字段建议：

- `product_id`
- `warehouse_id`
- `warehouse_name`
- `slot_id`
- `slot_code`
- `rack_layout_id`
- `rack_code`
- `bay_no`
- `level_no`
- `position_code`
- `quality`
- `batch_id`
- `qty_on_hand`
- `available_qty`
- `highlight_kind`

权限：登录即可查看。

实现约束：

- 只读查询 `inventory`、`warehouse`、`slot`、`rack_slot_map` 等表。
- 不写 `inventory` 或 `stock_movement`。
- 若某库位未绑定可视化格位，仍要在右侧列表显示，并标记为“未映射到平面图”。

## 前端组件设计

### `WarehouseMapPage`

页面容器，负责模式切换和数据协调。

状态：

- 当前仓库。
- 当前产品。
- 当前视图：`top` / `elevation`。
- 当前模式：`locate` / `design`。
- 当前高亮位置。

### `WarehouseSelector`

左侧仓库卡片列表。

职责：

- 展示 4 个仓库。
- 展示占用率、库位数和产品命中数。
- 点击切换仓库。

### `WarehouseCanvas`

中间俯视画布。

职责：

- 渲染区域、通道、货架。
- 在定位模式中显示产品高亮。
- 在设计模式中允许拖拽/调整尺寸。

第一版建议用 DOM + CSS transform 实现，不引入 canvas/Three.js。原因：

- 与 Ant Design/React 状态更容易集成。
- 可访问性和点击事件更简单。
- 第一版主要是 2D 平面编辑，不需要 3D 引擎成本。

### `RackElevationView`

货架仰视/立面图。

职责：

- 展示选中货架的列、层、A/B/C。
- 高亮当前产品所在层位。
- 点击层位可反向选中右侧位置卡片。

### `ProductLocationPanel`

右侧定位列表。

职责：

- 复用现有产品搜索能力。
- 支持类型筛选：RM、SF、FG、ACC。
- 展示跨仓位置卡片。
- 点击卡片驱动画布定位。

### `LayoutTemplatePanel`

设计模式下显示。

职责：

- 套用仓库模板。
- 套用货架模板。
- 新增区域/货架。
- 保存布局。

## 数据流

### 定位模式

1. 用户搜索产品。
2. 前端调用现有搜索接口选中产品。
3. 前端调用 `GET /products/{id}/visual-locations`。
4. 前端按 `warehouse_id` 聚合命中位置。
5. 用户点击仓库或位置卡片。
6. `WarehouseCanvas` 高亮对应货架/库位；`RackElevationView` 高亮层位。

### 设计模式

1. 管理员选择仓库。
2. 前端调用 `GET /warehouse-layouts?warehouse={warehouse_id}`。
3. 若无布局，提示套用模板创建。
4. 管理员拖拽货架/区域或绑定库位。
5. 前端本地维护 draft。
6. 保存时调用 `PUT /warehouse-layouts/{layoutId}`。
7. 后端校验 `version` 和 slot 归属。

## 错误处理

- 布局不存在：显示“该仓库尚未设计平面图”，引导管理员套模板。
- 产品有库存但库位未映射：右侧列表显示，画布不高亮，提示“未绑定平面图位置”。
- 布局版本冲突：409，提示“布局已被其他人修改，请刷新后重试”。
- 外协仓无库位：显示供应商/区域卡片，不显示货架层位。
- 产品跨质量态：良品、不良、不可用分色显示。

## 权限与安全

- 布局查看：所有登录用户。
- 布局编辑、模板新增：`ADMIN` / `BOSS`。
- 价格权限不受影响。
- 库存写操作不受影响，仍走 `op_*` 存储过程。
- 产品定位 API 是只读能力，不能暴露任何可直接更新库存的字段。

## 测试策略

后端：

- 查询构造测试：产品位置查询必须只读，不能包含 `UPDATE` / `DELETE` `inventory` / `stock_movement`。
- 布局保存测试：slot 必须属于该仓库。
- 乐观锁测试：version 冲突返回 409。
- 外协仓测试：不允许绑定货架库位。

前端：

- API helper 测试：布局和产品位置 URL 构造正确。
- 组件状态测试：点击位置卡片后，当前仓库和高亮库位更新。
- 浏览器验证：管理员能进入设计模式，操作员只能定位。
- 响应式验证：桌面三栏、移动端上下结构不重叠。

验收：

- 4 个仓库可以各自保存不同平面图。
- 管理员可以通过模板创建仓库布局。
- 管理员可以通过货架模板生成货架格位。
- 搜索一个产品后，能同时看到它在不同仓库、不同货架、不同库位的位置。
- 俯视图能定位到货架，立面图能定位到层位。
- 未映射库位不会丢失，仍在列表中显示。
- 红线扫描无应用层库存直写。

## 实施顺序建议

1. 增加布局数据表和只读/保存 API，不接入复杂拖拽。
2. 做 `仓库地图` 页面，先用静态布局数据渲染 4 仓库和产品定位。
3. 接入真实 `visual-locations` 查询，高亮多仓多库位。
4. 增加管理员设计模式：拖动货架、保存布局。
5. 增加仓库模板和货架模板创建/套用。
6. 做移动端适配和浏览器验收。

## 设计结论

第一版采用“可配置 2D 平面图 + 货架立面图”的方案。它能满足客户每个仓库不同、管理员需要设计仓库、需要仓库模板和货架模板、产品跨仓定位清晰这四个核心诉求，同时避免过早引入完整 3D 的成本。

后续如果客户明确需要沉浸式展示，可在同一套 `warehouse_layout` / `rack_layout` 数据上叠加 Three.js 3D 视图。
