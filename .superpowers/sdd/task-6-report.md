# Task 6 Report - Frontend Warehouse Map Page

## 实现内容

- 新增 `apps/web/src/WarehouseMapPage.tsx`，实现仓库地图查询/可视化页。
- 接入 `warehouseMapApi.ts`、`warehouseMapModel.ts`、`searchApi.ts`、`authApi.ts` 和现有仓库列表 API。
- 新增页面组件：
  - `WarehouseSelector`
  - `WarehouseCanvas`
  - `RackElevationView`
  - `ProductLocationPanel`
  - `LayoutTemplatePanel`
- Locate mode：
  - 支持产品搜索，复用 `searchProducts(query, token)`。
  - 支持 `全部/RM/SF/FG/ACC` 类型筛选。
  - 选择产品后调用 `getProductVisualLocations`。
  - 仓库 rail 显示命中数量；当前仓库内 rack/cell 根据库存状态高亮。
  - 未映射库存行在位置面板中显示 `未映射到平面图位置`。
  - 页面不提供入库、出库、移库、BOM 编辑、订单创建或 MRP 编辑。
- View switch：
  - 支持 `俯视图` / `立面图`。
  - 俯视图显示 zone/rack canvas。
  - 立面图按 rack template 构造 bay/level/position cell。
- Design mode：
  - 仅 `ADMIN`/`BOSS` 显示 `定位/设计` 切换。
  - `OPERATOR` 不显示保存、创建、添加区域、添加货架控件。
  - 支持无布局时从仓库模板创建布局。
  - 支持添加 zone、添加 rack、拖动 zone/rack 改 `x/y`、编辑 zone 宽高、编辑 rack rotation、保存布局。
  - 保存使用当前 `version`；保存冲突错误显示 `布局已被其他人修改，请刷新后重试`。
- `apps/web/src/App.tsx`：
  - `ActiveView` 增加 `warehouseMap`。
  - 导航在 `库存看板` 后新增 `仓库地图`，保留原有模块入口和权限可见性。
  - `activeView === 'warehouseMap'` 时渲染 `<WarehouseMapPage token={token} user={auth.user} />`。
- `apps/web/src/styles.css`：
  - 桌面三栏：左仓库 rail、中地图、右产品定位 panel。
  - 移动端单列：搜索/筛选在上、仓库 rail 横向滚动、地图主体、位置列表在下。
  - 修复 admin 10 项顶层导航在移动宽度撑开页面的问题。
- `warehouseMapModel.ts`：
  - 新增 `buildWarehouseLayoutSaveInput`，统一生成保存 payload，并过滤前端临时负数 id。
- `warehouseMapModel.test.ts`：
  - 新增保存 payload 纯函数测试。

## 测试结果

- `pnpm --filter @zr-wms/web test`
  - 14 files passed, 30 tests passed.
- `pnpm --filter @zr-wms/web typecheck`
  - passed.
- `pnpm --filter @zr-wms/web build`
  - passed.
  - Vite 仍有既有大 chunk warning：`Some chunks are larger than 500 kB after minification`。

## 浏览器验证

- 使用 `./start.sh` 启动本地服务。
- Operator：
  - 登录 `operator / operator123`。
  - 导航保留 `出入库`、`订单`、`盘点`、`库存看板`、`仓库地图`。
  - `仓库地图` 可打开。
  - 页面未显示设计切换、创建布局、保存布局、添加区域、添加货架控件。
  - 搜索 `RM-0123` 可选中产品，位置面板显示 W1 库存行。
  - 未映射库存显示 `未映射到平面图位置`。
  - 点击位置卡切换到 W1。
- Admin：
  - 登录 `admin / admin123`。
  - 管理导航保留 `报表`、`导入`、`产品管理`、`仓库库位`、`操作日志`。
  - `仓库地图` 显示 `定位/设计` 切换。
  - W1 无布局时可创建布局，创建后显示 `v1`。
  - 添加区域并保存后显示 `v2` 和保存成功提示。
  - `产品管理` 仍含 BOM/产能相关区域。
  - `仓库库位` 仍管理仓库和库位模板/库位状态。
  - `订单` 仍包含创建订单等订单工作流。
  - `出入库` 仍包含入库/出库/移库控件。
- 移动宽度：
  - 将 Chrome 窗口缩至约 413px 内宽验证。
  - 修复前发现 `operation-card` 被 admin 导航撑到 920px。
  - 修复后 `innerWidth=413`，`scrollWidth=413`，无页面级横向溢出；地图布局单列，仓库 rail 横向滚动。

## 文件列表

- `apps/web/src/WarehouseMapPage.tsx`
- `apps/web/src/App.tsx`
- `apps/web/src/styles.css`
- `apps/web/src/warehouseMapModel.ts`
- `apps/web/src/warehouseMapModel.test.ts`
- `.superpowers/sdd/task-6-report.md`

## 自审

- 保留现有导航和模块归属，仓库地图是新增查询/可视化页，没有替代出入库、订单、盘点、库存看板、产品/BOM、仓库库位、报表、导入、操作日志。
- 页面没有调用 inbound/outbound/transfer/BOM/order/MRP 写 API。
- 权限按前端可见性处理：OPERATOR 无设计控件，ADMIN/BOSS 才有设计控件；后端仍应作为真正权限边界。
- 保存布局使用已有 `version`，并处理 409 文案。
- 采用 light canvas、neutral panel、dark rack block、yellow/red/gray 库存高亮，没有 3D、营销 hero 或装饰背景。
- 移动端做了真实浏览器宽度验证，并修复了 admin 导航横向溢出。

## 顾虑

- 当前后端 `rack_layout` 和前端 API model 只持久化 rack 的 `x/y/rotation`，没有 rack `width/height` 字段；本次只支持 zone 宽高编辑和 rack rotation 编辑，rack 宽高仍是前端固定尺寸。
- 本地浏览器验证按 brief 创建并保存了 W1 布局，属于本地数据库状态变化，不进入 git。
- 未添加组件级 React 测试；覆盖点集中在保存 payload 纯函数和现有 API/model 测试，主要交互通过真实浏览器验证。
