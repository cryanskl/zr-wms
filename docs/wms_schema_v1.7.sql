-- =============================================================
-- 汽配 WMS — PostgreSQL 建表 DDL
-- 版本 V1.7 | 2026-06-28
-- 要求：PostgreSQL 15+（inventory 唯一约束用到 NULLS NOT DISTINCT）
-- 设计要点：
--   1. 产品内部 ID(product_id)为稳定业务主键，终身不变；其余表用代理主键。
--   2. inventory 是“当前库存快照”读模型；stock_movement 是“只增不删”的数量真相。
--   3. 可用 = 在库 − 预留(冻结)，由 reservation 汇总算出，不单独存。
--   4. 批次只用于原材料；半成品/成品的 batch_id 恒为 NULL。
--   5. 外协 = 无库位的仓库(has_slots=false)，对应 inventory.slot_id 为 NULL。
-- =============================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS pg_trgm;   -- 模糊搜索(名称/别名/路径/备注)

-- =============================================================
-- 通用：自动维护 updated_at
-- =============================================================
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =============================================================
-- 1. 仓库 / 用户（被多数表引用，先建）
-- =============================================================
CREATE TABLE warehouse (
  warehouse_id  text PRIMARY KEY,                       -- 如 'W1'
  name          text NOT NULL,
  type          text NOT NULL DEFAULT 'NORMAL'
                  CHECK (type IN ('NORMAL','MOLD','OUTSOURCE')),  -- 普通/模具/外协
  has_slots     boolean NOT NULL DEFAULT true,          -- 外协 = false
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE app_user (
  user_id       bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name          text NOT NULL,
  role          text NOT NULL
                  CHECK (role IN ('OPERATOR','ADMIN','BOSS')),    -- 操作员/管理员/老板
  warehouse_id  text REFERENCES warehouse(warehouse_id),         -- 操作员归属仓(可空)
  active        boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- =============================================================
-- 2. 产品主数据
-- =============================================================
CREATE TABLE product (
  product_id    text PRIMARY KEY,                        -- RM-0123 / SF-0045 / FG-7L0199131F
  type          text NOT NULL
                  CHECK (type IN ('RM','SF','FG','ACC')),         -- 原材料/半成品/成品/配件
  name          text NOT NULL,
  has_tube      boolean NOT NULL DEFAULT false,          -- 是否带管子
  has_alu_plate boolean NOT NULL DEFAULT false,          -- 是否带铝板
  has_dust_cover boolean NOT NULL DEFAULT false,         -- 是否带防尘罩
  attrs         jsonb NOT NULL DEFAULT '{}'::jsonb,      -- 其他可扩展属性
  safety_stock  numeric(14,4),                           -- 安全库存(按总库存)；NULL=不预警
  remark        text,
  active        boolean NOT NULL DEFAULT true,           -- 停用走软删，永不物理删除
  created_by    bigint REFERENCES app_user(user_id),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_by    bigint REFERENCES app_user(user_id),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER trg_product_updated BEFORE UPDATE ON product
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 人工别名（每产品 ≤10，可跨产品重复）
CREATE TABLE product_alias (
  alias_id      bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  product_id    text NOT NULL REFERENCES product(product_id),
  alias_text    text NOT NULL,
  created_by    bigint REFERENCES app_user(user_id),
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (product_id, alias_text)                        -- 同一产品内别名不重复(跨产品可重复)
);

-- 产品图（≤3）
CREATE TABLE product_image (
  image_id      bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  product_id    text NOT NULL REFERENCES product(product_id),
  url           text NOT NULL,
  seq           smallint NOT NULL CHECK (seq BETWEEN 1 AND 3),
  UNIQUE (product_id, seq)
);

-- 价格（1:1，后续阶段；仅老板可改 → 应用层控制）
CREATE TABLE price (
  product_id    text PRIMARY KEY REFERENCES product(product_id),
  cost_in       numeric(14,4),                           -- 入货
  cost_process  numeric(14,4),                           -- 加工
  cost_loss     numeric(14,4),                           -- 损耗
  price_out     numeric(14,4),                           -- 出货
  updated_by    bigint REFERENCES app_user(user_id),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER trg_price_updated BEFORE UPDATE ON price
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- =============================================================
-- 3. BOM / 配方
-- =============================================================
CREATE TABLE bom_line (
  bom_line_id       bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  parent_product_id text NOT NULL REFERENCES product(product_id),
  child_product_id  text NOT NULL REFERENCES product(product_id),
  qty               numeric(14,4) NOT NULL CHECK (qty > 0),   -- 用量(数量)
  seq               smallint NOT NULL,                        -- 子项顺序 → 决定 -1/-2，由管理员/老板设定
  CHECK (parent_product_id <> child_product_id),
  UNIQUE (parent_product_id, child_product_id),
  UNIQUE (parent_product_id, seq)
);
CREATE INDEX idx_bom_child ON bom_line(child_product_id);

-- 路径别名（由 BOM 自动生成后冻结；一物可多行，供搜索）
CREATE TABLE bom_path_alias (
  path_alias_id   bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  product_id      text NOT NULL REFERENCES product(product_id),     -- 指向的物料
  root_product_id text NOT NULL REFERENCES product(product_id),     -- 路径根(A/A2/B)
  path_text       text NOT NULL UNIQUE,                             -- 'A-1-1'
  generated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_path_alias_product ON bom_path_alias(product_id);

-- =============================================================
-- 4. 库位
-- =============================================================
CREATE TABLE slot (
  slot_id       bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  warehouse_id  text NOT NULL REFERENCES warehouse(warehouse_id),
  code          text NOT NULL UNIQUE,                    -- 'W1-R03-C12-L2-A'
  row_no        smallint,                                -- 排
  col_no        smallint,                                -- 列
  level_no      smallint,                                -- 层
  position      char(1) CHECK (position IN ('A','B','C')),  -- 前/中/后
  status        text NOT NULL DEFAULT 'AVAILABLE'
                  CHECK (status IN ('AVAILABLE','OCCUPIED','UNUSABLE','MERGED')),
  status_reason text,                                    -- 如“消防栓”
  merged_into   bigint REFERENCES slot(slot_id)          -- 合并目标(自引用)
);
CREATE INDEX idx_slot_warehouse ON slot(warehouse_id);

-- =============================================================
-- 5. 批次（仅原材料）
-- =============================================================
CREATE TABLE batch (
  batch_id      bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  product_id    text NOT NULL REFERENCES product(product_id),  -- 应为 type='RM'
  batch_no      text NOT NULL,
  received_date date,
  source        text,                                    -- 供应商 / 采购订单号
  UNIQUE (product_id, batch_no)
);

-- =============================================================
-- 6. 订单（ORDER 为保留字，表名用 order_doc）
-- =============================================================
CREATE TABLE order_doc (
  order_id      bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  order_type    text NOT NULL CHECK (order_type IN ('PURCHASE','PRODUCTION')),  -- 采购/生产
  partner       text,                                    -- 客户(生产) / 供应商(采购)
  due_date      date,
  status        text NOT NULL DEFAULT 'PENDING',         -- 表头汇总状态
  created_by    bigint REFERENCES app_user(user_id),
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_order_type_status ON order_doc(order_type, status);

CREATE TABLE order_line (
  order_line_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  order_id      bigint NOT NULL REFERENCES order_doc(order_id) ON DELETE CASCADE,
  product_id    text NOT NULL REFERENCES product(product_id),
  qty           numeric(14,4) NOT NULL CHECK (qty > 0),  -- 需求量
  qty_done      numeric(14,4) NOT NULL DEFAULT 0,        -- 已产出(生产) / 已到货(采购)
  -- 采购单: PENDING/PARTIAL_RECEIVED/RECEIVED/DONE/CANCELLED
  -- 生产单: PENDING/SHORTAGE/PICKED/IN_PRODUCTION/PRODUCED/CANCELLED
  line_status   text NOT NULL DEFAULT 'PENDING'
);
CREATE INDEX idx_order_line_order ON order_line(order_id);
CREATE INDEX idx_order_line_product ON order_line(product_id);

-- =============================================================
-- 7. 库存预留（库位人工指定；进入“已预留”时可用→冻结）
-- =============================================================
CREATE TABLE reservation (
  reservation_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  order_id       bigint NOT NULL REFERENCES order_doc(order_id),
  product_id     text NOT NULL REFERENCES product(product_id),
  slot_id        bigint NOT NULL REFERENCES slot(slot_id),       -- 人工指定
  batch_id       bigint REFERENCES batch(batch_id),              -- 仅原料
  qty            numeric(14,4) NOT NULL CHECK (qty > 0),         -- 冻结量
  status         text NOT NULL DEFAULT 'RESERVED'
                   CHECK (status IN ('RESERVED','RELEASED','CONSUMED')),
  version        bigint NOT NULL DEFAULT 0,                      -- 乐观锁
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_reservation_order ON reservation(order_id);
CREATE INDEX idx_reservation_active ON reservation(product_id, slot_id) WHERE status = 'RESERVED';

-- =============================================================
-- 8. 当前库存快照（读模型）
--    粒度：product × warehouse × slot × batch × quality
-- =============================================================
CREATE TABLE inventory (
  inventory_id  bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  product_id    text NOT NULL REFERENCES product(product_id),
  warehouse_id  text NOT NULL REFERENCES warehouse(warehouse_id),
  slot_id       bigint REFERENCES slot(slot_id),         -- 外协仓为 NULL
  batch_id      bigint REFERENCES batch(batch_id),       -- 仅原料
  quality       text NOT NULL DEFAULT 'GOOD'
                  CHECK (quality IN ('GOOD','DEFECTIVE','UNUSABLE')),  -- 良/不良/不可用
  qty_on_hand   numeric(14,4) NOT NULL DEFAULT 0,        -- 在库(总)
  version       bigint NOT NULL DEFAULT 0,               -- 乐观锁(并发)
  updated_at    timestamptz NOT NULL DEFAULT now(),
  -- 唯一粒度；NULLS NOT DISTINCT 让 NULL 的 slot/batch 也参与去重(PG15+)
  UNIQUE NULLS NOT DISTINCT (product_id, warehouse_id, slot_id, batch_id, quality)
);
CREATE INDEX idx_inv_product ON inventory(product_id);
CREATE INDEX idx_inv_slot ON inventory(slot_id);
CREATE INDEX idx_inv_warehouse ON inventory(warehouse_id);
CREATE TRIGGER trg_inventory_updated BEFORE UPDATE ON inventory
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- =============================================================
-- 9. 库存流水（只增不删；作废用 voided，冲正用 reverses_id）
--    当前库存 = 初始 + 入库 − 出库 + 移库 + 调整 + 冲正
-- =============================================================
CREATE TABLE stock_movement (
  movement_id   bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  product_id    text NOT NULL REFERENCES product(product_id),
  warehouse_id  text NOT NULL REFERENCES warehouse(warehouse_id),
  slot_id       bigint REFERENCES slot(slot_id),         -- 外协为 NULL
  batch_id      bigint REFERENCES batch(batch_id),       -- 仅原料
  quality       text NOT NULL DEFAULT 'GOOD'
                  CHECK (quality IN ('GOOD','DEFECTIVE','UNUSABLE')),
  type          text NOT NULL
                  CHECK (type IN ('IN','OUT','TRANSFER','ADJUST','REVERSE','LOSS','RETURN')),
  qty           numeric(14,4) NOT NULL,                  -- 带符号(+入 / −出)
  reason        text,                                    -- 盘点差异 / 人工修正 等
  ref_order_id  bigint REFERENCES order_doc(order_id),   -- 采购到货→入库 的来源单
  reverses_id   bigint REFERENCES stock_movement(movement_id),  -- 冲正引用原流水
  voided        boolean NOT NULL DEFAULT false,          -- 作废(不物理删除)
  operator_id   bigint REFERENCES app_user(user_id),
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_mv_product_time ON stock_movement(product_id, created_at DESC);
CREATE INDEX idx_mv_slot ON stock_movement(slot_id);
CREATE INDEX idx_mv_operator ON stock_movement(operator_id, created_at DESC);
CREATE INDEX idx_mv_order ON stock_movement(ref_order_id);

-- 禁止物理删除流水(只能作废)
CREATE OR REPLACE FUNCTION forbid_movement_delete() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION '库存流水不可删除，只能作废(voided=true)';
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER trg_mv_no_delete BEFORE DELETE ON stock_movement
  FOR EACH ROW EXECUTE FUNCTION forbid_movement_delete();

-- =============================================================
-- 10. 操作日志（记录所有动作：改 BOM / 改库位 / 登录等，区别于库存流水）
-- =============================================================
CREATE TABLE operation_log (
  log_id        bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  entity_type   text NOT NULL,                           -- 'product'/'bom'/'slot'/...
  entity_id     text,
  action        text NOT NULL,                           -- 'CREATE'/'UPDATE'/'LOGIN'/...
  detail        jsonb,
  operator_id   bigint REFERENCES app_user(user_id),
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_log_entity ON operation_log(entity_type, entity_id);
CREATE INDEX idx_log_operator ON operation_log(operator_id, created_at DESC);

-- =============================================================
-- 11. 盘点（实盘→差异→调整单→更新库存）
-- =============================================================
CREATE TABLE stocktake (
  stocktake_id  bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  warehouse_id  text REFERENCES warehouse(warehouse_id),
  status        text NOT NULL DEFAULT 'DRAFT'
                  CHECK (status IN ('DRAFT','COUNTING','REVIEW','DONE','CANCELLED')),
  created_by    bigint REFERENCES app_user(user_id),
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE stocktake_line (
  stline_id     bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  stocktake_id  bigint NOT NULL REFERENCES stocktake(stocktake_id) ON DELETE CASCADE,
  product_id    text NOT NULL REFERENCES product(product_id),
  slot_id       bigint REFERENCES slot(slot_id),
  batch_id      bigint REFERENCES batch(batch_id),
  system_qty    numeric(14,4),                           -- 账面
  counted_qty   numeric(14,4),                           -- 实盘
  diff          numeric(14,4) GENERATED ALWAYS AS (counted_qty - system_qty) STORED,  -- 差异
  adj_movement_id bigint REFERENCES stock_movement(movement_id)  -- 审核后生成的调整流水
);
CREATE INDEX idx_stline_stocktake ON stocktake_line(stocktake_id);

-- =============================================================
-- 12. 最近使用（按人；支撑“最近填写/最近订单的产品 id”）
-- =============================================================
CREATE TABLE recent_use (
  user_id       bigint NOT NULL REFERENCES app_user(user_id),
  product_id    text NOT NULL REFERENCES product(product_id),
  context       text NOT NULL,                           -- 'FILL' / 'ORDER'
  last_used_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, product_id, context)
);
CREATE INDEX idx_recent_user ON recent_use(user_id, last_used_at DESC);

-- =============================================================
-- 13. 模糊搜索索引(pg_trgm GIN)——客户首要诉求“查得快查得准”
-- =============================================================
CREATE INDEX idx_trgm_product_name  ON product        USING gin (name gin_trgm_ops);
CREATE INDEX idx_trgm_product_remark ON product       USING gin (remark gin_trgm_ops);
CREATE INDEX idx_trgm_alias         ON product_alias  USING gin (alias_text gin_trgm_ops);
CREATE INDEX idx_trgm_path          ON bom_path_alias USING gin (path_text gin_trgm_ops);

COMMIT;
