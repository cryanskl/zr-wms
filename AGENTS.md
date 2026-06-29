# ZR WMS — AI 编码助手维护指南

本仓库是汽配仓库管理系统（WMS）的可运行实现。协作时用中文回复，先确认真实文件、命令和运行结果，再下结论。

## 当前状态

- 项目已按 `docs/WMS_实施计划_逐刀指令.md` 完成 0-9 刀：地基、搜索、鉴权、出入库、库存看板、产品/BOM、仓库库位、订单/预留/MRP、盘点、产能推衍、报表/导入/价格/通知/权限硬化。
- 后续任务默认是维护、修复、上线准备或小增量，不要重新设计数据库或重做已完成模块。
- 每完成一个值得提交的功能或操作，都要提交到 git；提交前先跑对应验证。

## 权威文档与 SQL

实现和维护以这些文件为准：

| 文件 | 用途 | 规则 |
|---|---|---|
| `docs/wms_schema_v1.7.sql` | 数据库 DDL | 权威。不要让 ORM 重新生成。 |
| `docs/wms_procedures_v1.7.sql` | 库存/业务写操作存储过程 | 权威。库存写操作必须走这里的 `op_*`。 |
| `docs/wms_logic_v1.7.sql` | 业务推衍函数 | 权威。MRP、产能、where-used、路径别名走 `fn_*`。 |
| `docs/WMS_API_接口清单_v1.7.md` | API 契约 | 端点、命名、权限优先按它核对。 |
| `docs/WMS_实施计划_逐刀指令.md` | 已实现竖切路线图 | 判断功能范围和验收口径。 |
| `docs/wms_er_diagram_v1.7.mermaid` | 表关系参考 | 理解关系用，不替代 SQL。 |

建库顺序固定：`schema -> procedures -> logic -> seed`。不要擅自改三份 SQL；若怀疑 SQL 有 bug，先说明证据，等用户确认。

## 技术栈与结构

- Monorepo：pnpm workspace。
- 后端：`apps/api`，Node + NestJS + TypeScript，当前以 `pg`/raw SQL 查询函数访问 PostgreSQL。
- 前端：`apps/web`，React + Vite + Ant Design + TanStack Query。
- 数据库：PostgreSQL 15+。
- 本地启动：`./start.sh`，会检查依赖、释放前后端端口、创建 `logs/<timestamp>/`、启动服务并打开浏览器。
- 手动命令：
  - `pnpm dev:api`
  - `pnpm dev:web`
  - `pnpm test`
  - `pnpm typecheck`
  - `pnpm build`
  - `pnpm db:setup` / `pnpm db:setup:reset`

## 不可违背的架构红线

1. 数据库是真相层，业务逻辑在库里。应用层不要重写库存逻辑。
2. 入库、出库、移库、预留、履约、盘点调整等库存写操作只能通过查询层调用对应 `op_*` 存储过程。
3. 应用层绝不直接 `UPDATE` / `DELETE` / `INSERT` `inventory` 或 `stock_movement`。流水只增不删，快照只能经存储过程变化。
4. 推衍类能力调用 `fn_*`：缺料、产能、where-used、路径别名等不要搬到应用层重算。
5. 改 BOM 后必须调用 `fn_regen_path_aliases()`，避免路径别名和 BOM 脱节。
6. 不要引入 Prisma / TypeORM 这类重 ORM；它们会和“逻辑在数据库里”的边界打架。
7. 操作人必须来自 JWT 当前用户，不能让前端传 `operator_id`，也不能写死。

常用红线扫描：

```bash
rg -n "\b(UPDATE|DELETE\s+FROM)\s+(inventory|stock_movement)\b|\b(inventory|stock_movement)\s+SET\b|INSERT\s+INTO\s+(inventory|stock_movement)" apps scripts start.sh -g '!scripts/sql/*.sql'
```

无输出才符合预期。

## 权限规则

三类角色：`OPERATOR`、`ADMIN`、`BOSS`。

- 三角色都可：查看库存、新增别名、入库、出库、库存调整、导出 Excel、查看 BOM。
- `ADMIN` 及以上：新增产品、改产品编码、改 BOM、查看价格、自定义仓库/货架结构、强制出库。
- 仅 `BOSS`：修改价格。
- 谁都不可：删除流水；只能冲正或作废。

权限必须落在后端 Guard / `@Roles()` 上；前端隐藏菜单只是体验优化，不能当权限边界。

## 关键业务规则

- 内部产品 ID（RM/SF/FG/ACC）终身不变；显示别名和 BOM 路径别名与 ID 分离。
- 订单只有采购单和生产单。生产单产出成品即结束，不含出库发货；采购到货自动联动入库。
- 批次只用于原材料；半成品、成品、配件不记批次。
- 库存粒度：产品 × 仓库 × 库位 × 质量态 × 批次（仅原材料）。
- 可用库存 = 在库 - 预留。
- 外协是无货架的内置仓库。
- 低库存预警按产品总库存判断。
- 可变资源使用 `version` 乐观锁；冲突返回 409，提示“刷新后重试”。

## 工作流

- 开始任务先分类：
  - 小修复：单文件、少量文案/样式/配置/类型修正，可直接做。
  - 功能/重构：跨文件或行为变化，先给短计划，再实现。
- 默认最小实现。不要主动扩张分类、自动刷新、权限模型、菜单系统等未要求能力。
- 严格沿用文档里的表名、字段名和端点路径；订单表是 `order_doc`，不要写成 SQL 保留字 `order`。
- 涉及 UI 改动要做浏览器验证；涉及后端行为要用 API 或测试验证。
- 每次改动后至少跑相关验证；跨模块改动跑 `pnpm test && pnpm typecheck && pnpm build`。
- 涉及库存写路径的改动，必须额外跑红线扫描。

## Git 安全

- 提交前必须运行：

```bash
git branch --show-current && git rev-parse --show-toplevel && git status --short
```

- 确认当前分支和 worktree 是 `/Users/zenith/Desktop/zr-wms` 后再提交。
- 不要执行破坏性命令，除非用户在当前消息明确授权：`git reset --hard`、`git checkout --`、`git clean -f`、`push --force`、`branch -D`、`rm -rf`、无 WHERE 的批量 `UPDATE` / `DELETE` / `truncate` / `drop`。
- pre-commit hook 失败时不要用 `--amend` 补救；修问题后重新 `git add` 并新建提交。

## 本地运行提示

首次运行前需要 `.env`，至少包含 `DATABASE_URL`。可从 `.env.example` 复制后填写。

```bash
cp .env.example .env
pnpm install
pnpm db:setup
./start.sh
```

`start.sh` 会把日志写到 `logs/<timestamp>/`，并更新 `logs/latest`。`logs/` 不进 git。
