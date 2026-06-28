-- =============================================================
-- 汽配 WMS — 核心操作存储过程 (PL/pgSQL)
-- 版本 V1.7 | 2026-06-28 | 依赖 wms_schema_v1.7.sql
--
-- 设计原则：每个 op_* 函数 = 一个原子事务，内部完成
--   ① 写库存流水(append-only)  ② 更新当前库存快照  ③ 必要时动预留
-- 其中“可用 = 在库 − 预留(RESERVED)”始终由 fn_available 实时算出，不落库。
-- 并发：快照行通过 ON CONFLICT DO UPDATE 取得行锁，配合唯一粒度天然串行化；
--       version 列供应用层乐观锁(编辑冲突提示)使用。
-- =============================================================

BEGIN;

-- 给快照唯一约束起个稳定名字，便于 ON CONFLICT 引用（幂等）
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint
             WHERE conname = 'inventory_product_id_warehouse_id_slot_id_batch_id_quality_key') THEN
    ALTER TABLE inventory
      RENAME CONSTRAINT inventory_product_id_warehouse_id_slot_id_batch_id_quality_key
      TO uq_inventory_grain;
  END IF;
END $$;

-- -------------------------------------------------------------
-- 工具：对某粒度的快照施加带符号增量(+入/−出)，并维护非负约束
-- -------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_inventory_apply_delta(
  p_product   text,
  p_warehouse text,
  p_slot      bigint,
  p_batch     bigint,
  p_quality   text,
  p_delta     numeric,
  p_allow_negative boolean DEFAULT false
) RETURNS void AS $$
DECLARE
  v_now numeric;
BEGIN
  INSERT INTO inventory(product_id, warehouse_id, slot_id, batch_id, quality, qty_on_hand, version)
  VALUES (p_product, p_warehouse, p_slot, p_batch, p_quality, p_delta, 0)
  ON CONFLICT ON CONSTRAINT uq_inventory_grain
  DO UPDATE SET qty_on_hand = inventory.qty_on_hand + EXCLUDED.qty_on_hand,
                version     = inventory.version + 1,
                updated_at  = now()
  RETURNING qty_on_hand INTO v_now;

  IF NOT p_allow_negative AND v_now < 0 THEN
    RAISE EXCEPTION '库存不足：产品 % 在该库位将变为负数(% )', p_product, v_now
      USING ERRCODE = 'check_violation';
  END IF;
END;
$$ LANGUAGE plpgsql;

-- -------------------------------------------------------------
-- 工具：实时可用量 = 在库 − 预留(RESERVED)
-- 预留按 产品×库位×批次 汇总(预留只发生在有库位的仓)
-- -------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_available(
  p_product text, p_warehouse text, p_slot bigint, p_batch bigint, p_quality text DEFAULT 'GOOD'
) RETURNS numeric AS $$
  SELECT COALESCE((
            SELECT qty_on_hand FROM inventory
            WHERE product_id = p_product AND warehouse_id = p_warehouse
              AND slot_id  IS NOT DISTINCT FROM p_slot
              AND batch_id IS NOT DISTINCT FROM p_batch
              AND quality  = p_quality
         ), 0)
       - COALESCE((
            SELECT sum(qty) FROM reservation
            WHERE product_id = p_product AND status = 'RESERVED'
              AND slot_id  IS NOT DISTINCT FROM p_slot
              AND batch_id IS NOT DISTINCT FROM p_batch
         ), 0);
$$ LANGUAGE sql STABLE;

-- =============================================================
-- 1. 入库（原料/配件/半成品/成品/退货）
--    采购到货可传 p_ref_order，落 ref_order_id 实现“订单→入库”联动
-- =============================================================
CREATE OR REPLACE FUNCTION op_inbound(
  p_product   text,
  p_warehouse text,
  p_qty       numeric,
  p_slot      bigint  DEFAULT NULL,
  p_batch     bigint  DEFAULT NULL,
  p_quality   text    DEFAULT 'GOOD',
  p_type      text    DEFAULT 'IN',      -- IN | RETURN
  p_reason    text    DEFAULT NULL,
  p_ref_order bigint  DEFAULT NULL,
  p_operator  bigint  DEFAULT NULL
) RETURNS bigint AS $$
DECLARE v_mv bigint;
BEGIN
  IF p_qty <= 0 THEN RAISE EXCEPTION '入库数量必须 > 0'; END IF;
  IF p_type NOT IN ('IN','RETURN') THEN RAISE EXCEPTION '入库类型非法：%', p_type; END IF;

  PERFORM fn_inventory_apply_delta(p_product, p_warehouse, p_slot, p_batch, p_quality, p_qty);

  INSERT INTO stock_movement(product_id, warehouse_id, slot_id, batch_id, quality,
                             type, qty, reason, ref_order_id, operator_id)
  VALUES (p_product, p_warehouse, p_slot, p_batch, p_quality,
          p_type, p_qty, p_reason, p_ref_order, p_operator)
  RETURNING movement_id INTO v_mv;

  RETURN v_mv;
END;
$$ LANGUAGE plpgsql;

-- =============================================================
-- 2. 出库（成品/半成品/配件/损耗）
--    库存不足时默认禁止；p_allow_negative=true 表示管理员确认强制出库
-- =============================================================
CREATE OR REPLACE FUNCTION op_outbound(
  p_product   text,
  p_warehouse text,
  p_qty       numeric,
  p_slot      bigint  DEFAULT NULL,
  p_batch     bigint  DEFAULT NULL,
  p_quality   text    DEFAULT 'GOOD',
  p_type      text    DEFAULT 'OUT',     -- OUT | LOSS
  p_reason    text    DEFAULT NULL,
  p_ref_order bigint  DEFAULT NULL,
  p_operator  bigint  DEFAULT NULL,
  p_allow_negative boolean DEFAULT false
) RETURNS bigint AS $$
DECLARE v_mv bigint; v_avail numeric;
BEGIN
  IF p_qty <= 0 THEN RAISE EXCEPTION '出库数量必须 > 0'; END IF;
  IF p_type NOT IN ('OUT','LOSS') THEN RAISE EXCEPTION '出库类型非法：%', p_type; END IF;

  v_avail := fn_available(p_product, p_warehouse, p_slot, p_batch, p_quality);
  IF NOT p_allow_negative AND v_avail < p_qty THEN
    RAISE EXCEPTION '库存不足：可用 %, 需出 %（如需强制请管理员确认）', v_avail, p_qty
      USING ERRCODE = 'check_violation';
  END IF;

  PERFORM fn_inventory_apply_delta(p_product, p_warehouse, p_slot, p_batch, p_quality, -p_qty, p_allow_negative);

  INSERT INTO stock_movement(product_id, warehouse_id, slot_id, batch_id, quality,
                             type, qty, reason, ref_order_id, operator_id)
  VALUES (p_product, p_warehouse, p_slot, p_batch, p_quality,
          p_type, -p_qty, p_reason, p_ref_order, p_operator)
  RETURNING movement_id INTO v_mv;

  RETURN v_mv;
END;
$$ LANGUAGE plpgsql;

-- =============================================================
-- 3. 移库（库位间转移，对产品总量零和；产出 出库腿 + 入库腿 两条流水）
-- =============================================================
CREATE OR REPLACE FUNCTION op_transfer(
  p_product   text,
  p_qty       numeric,
  p_wh_from   text,
  p_slot_from bigint,
  p_wh_to     text,
  p_slot_to   bigint,
  p_batch     bigint  DEFAULT NULL,
  p_quality   text    DEFAULT 'GOOD',
  p_reason    text    DEFAULT '移库',
  p_operator  bigint  DEFAULT NULL
) RETURNS bigint[] AS $$
DECLARE v_out bigint; v_in bigint; v_avail numeric;
BEGIN
  IF p_qty <= 0 THEN RAISE EXCEPTION '移库数量必须 > 0'; END IF;

  v_avail := fn_available(p_product, p_wh_from, p_slot_from, p_batch, p_quality);
  IF v_avail < p_qty THEN
    RAISE EXCEPTION '源库位可用不足：可用 %, 需移 %', v_avail, p_qty
      USING ERRCODE = 'check_violation';
  END IF;

  PERFORM fn_inventory_apply_delta(p_product, p_wh_from, p_slot_from, p_batch, p_quality, -p_qty);
  PERFORM fn_inventory_apply_delta(p_product, p_wh_to,   p_slot_to,   p_batch, p_quality,  p_qty);

  INSERT INTO stock_movement(product_id, warehouse_id, slot_id, batch_id, quality, type, qty, reason, operator_id)
  VALUES (p_product, p_wh_from, p_slot_from, p_batch, p_quality, 'TRANSFER', -p_qty, p_reason, p_operator)
  RETURNING movement_id INTO v_out;

  INSERT INTO stock_movement(product_id, warehouse_id, slot_id, batch_id, quality, type, qty, reason, operator_id)
  VALUES (p_product, p_wh_to, p_slot_to, p_batch, p_quality, 'TRANSFER', p_qty, p_reason, p_operator)
  RETURNING movement_id INTO v_in;

  RETURN ARRAY[v_out, v_in];
END;
$$ LANGUAGE plpgsql;

-- =============================================================
-- 4. 预留（订单占用：可用→冻结；库位人工指定）
--    不改 on_hand；available 由 fn_available 自动减少。冲突即库存不足
-- =============================================================
CREATE OR REPLACE FUNCTION op_reserve(
  p_order    bigint,
  p_product  text,
  p_slot     bigint,
  p_qty      numeric,
  p_batch    bigint  DEFAULT NULL,
  p_operator bigint  DEFAULT NULL
) RETURNS bigint AS $$
DECLARE v_res bigint; v_wh text; v_avail numeric;
BEGIN
  IF p_qty <= 0 THEN RAISE EXCEPTION '预留数量必须 > 0'; END IF;
  SELECT warehouse_id INTO v_wh FROM slot WHERE slot_id = p_slot;
  IF v_wh IS NULL THEN RAISE EXCEPTION '库位 % 不存在', p_slot; END IF;

  v_avail := fn_available(p_product, v_wh, p_slot, p_batch, 'GOOD');
  IF v_avail < p_qty THEN
    RAISE EXCEPTION '预留失败：该库位可用 %, 需预留 %（已被其他订单占用或库存不足）', v_avail, p_qty
      USING ERRCODE = 'check_violation';
  END IF;

  INSERT INTO reservation(order_id, product_id, slot_id, batch_id, qty, status)
  VALUES (p_order, p_product, p_slot, p_batch, p_qty, 'RESERVED')
  RETURNING reservation_id INTO v_res;

  INSERT INTO operation_log(entity_type, entity_id, action, operator_id, detail)
  VALUES ('reservation', v_res::text, 'RESERVE', p_operator,
          jsonb_build_object('order', p_order, 'product', p_product, 'slot', p_slot, 'qty', p_qty));

  RETURN v_res;
END;
$$ LANGUAGE plpgsql;

-- =============================================================
-- 5. 预留 → 出库（履约：冻结消耗、on_hand 减、写出库流水并挂回订单）
-- =============================================================
CREATE OR REPLACE FUNCTION op_fulfill_reservation(
  p_reservation bigint,
  p_operator    bigint DEFAULT NULL
) RETURNS bigint AS $$
DECLARE r reservation%ROWTYPE; v_wh text; v_mv bigint;
BEGIN
  SELECT * INTO r FROM reservation WHERE reservation_id = p_reservation FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION '预留 % 不存在', p_reservation; END IF;
  IF r.status <> 'RESERVED' THEN RAISE EXCEPTION '预留 % 状态为 %，不可履约', p_reservation, r.status; END IF;

  SELECT warehouse_id INTO v_wh FROM slot WHERE slot_id = r.slot_id;

  -- on_hand 减：此处不再做可用校验，因为该数量已是本预留冻结的
  PERFORM fn_inventory_apply_delta(r.product_id, v_wh, r.slot_id, r.batch_id, 'GOOD', -r.qty);

  INSERT INTO stock_movement(product_id, warehouse_id, slot_id, batch_id, quality,
                             type, qty, reason, ref_order_id, operator_id)
  VALUES (r.product_id, v_wh, r.slot_id, r.batch_id, 'GOOD',
          'OUT', -r.qty, '预留履约出库', r.order_id, p_operator)
  RETURNING movement_id INTO v_mv;

  UPDATE reservation SET status = 'CONSUMED', version = version + 1 WHERE reservation_id = p_reservation;

  INSERT INTO operation_log(entity_type, entity_id, action, operator_id, detail)
  VALUES ('reservation', p_reservation::text, 'FULFILL', p_operator,
          jsonb_build_object('movement', v_mv, 'order', r.order_id, 'qty', r.qty));

  RETURN v_mv;
END;
$$ LANGUAGE plpgsql;

-- 预留释放（订单取消：冻结挪回可用）
CREATE OR REPLACE FUNCTION op_release_reservation(
  p_reservation bigint, p_operator bigint DEFAULT NULL
) RETURNS void AS $$
DECLARE r reservation%ROWTYPE;
BEGIN
  SELECT * INTO r FROM reservation WHERE reservation_id = p_reservation FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION '预留 % 不存在', p_reservation; END IF;
  IF r.status <> 'RESERVED' THEN RAISE EXCEPTION '预留 % 状态为 %，不可释放', p_reservation, r.status; END IF;

  UPDATE reservation SET status = 'RELEASED', version = version + 1 WHERE reservation_id = p_reservation;
  -- 无需改 on_hand：available 随 RESERVED 消失自动回升

  INSERT INTO operation_log(entity_type, entity_id, action, operator_id, detail)
  VALUES ('reservation', p_reservation::text, 'RELEASE', p_operator, jsonb_build_object('order', r.order_id, 'qty', r.qty));
END;
$$ LANGUAGE plpgsql;

-- =============================================================
-- 6. 冲正（对一条流水做反向条目：原流水作废，写 REVERSE 反向流水，快照回滚）
--    注：移库由两条流水组成，需对两条腿各冲正一次
-- =============================================================
CREATE OR REPLACE FUNCTION op_reverse_movement(
  p_movement bigint,
  p_operator bigint DEFAULT NULL,
  p_reason   text   DEFAULT '冲正'
) RETURNS bigint AS $$
DECLARE m stock_movement%ROWTYPE; v_rev bigint;
BEGIN
  SELECT * INTO m FROM stock_movement WHERE movement_id = p_movement FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION '流水 % 不存在', p_movement; END IF;
  IF m.voided THEN RAISE EXCEPTION '流水 % 已作废，不能重复冲正', p_movement; END IF;
  IF EXISTS (SELECT 1 FROM stock_movement WHERE reverses_id = p_movement) THEN
    RAISE EXCEPTION '流水 % 已被冲正过', p_movement;
  END IF;

  -- 反向施加：原流水对快照的增量为 m.qty(带符号)，回滚即 −m.qty
  PERFORM fn_inventory_apply_delta(m.product_id, m.warehouse_id, m.slot_id, m.batch_id, m.quality, -m.qty);

  INSERT INTO stock_movement(product_id, warehouse_id, slot_id, batch_id, quality,
                             type, qty, reason, ref_order_id, reverses_id, operator_id)
  VALUES (m.product_id, m.warehouse_id, m.slot_id, m.batch_id, m.quality,
          'REVERSE', -m.qty, p_reason, m.ref_order_id, p_movement, p_operator)
  RETURNING movement_id INTO v_rev;

  UPDATE stock_movement SET voided = true WHERE movement_id = p_movement;  -- 只作废，不删除

  RETURN v_rev;
END;
$$ LANGUAGE plpgsql;

-- =============================================================
-- 7. 盘点：审核某盘点明细 → 生成调整流水 → 更新快照
--    diff = 实盘 − 账面（由 stocktake_line 生成列得出）
-- =============================================================
-- 以“实盘为准”：调整时实时读当前账面，把库存归到实盘数；
-- stocktake_line.system_qty/diff 为录入时快照，仅供复核展示，不参与最终计算。
CREATE OR REPLACE FUNCTION op_apply_stocktake_line(
  p_stline   bigint,
  p_operator bigint DEFAULT NULL
) RETURNS bigint AS $$
DECLARE l stocktake_line%ROWTYPE; v_wh text; v_cur numeric; v_delta numeric; v_mv bigint;
BEGIN
  SELECT * INTO l FROM stocktake_line WHERE stline_id = p_stline FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION '盘点明细 % 不存在', p_stline; END IF;
  IF l.adj_movement_id IS NOT NULL THEN RAISE EXCEPTION '盘点明细 % 已生成过调整单', p_stline; END IF;
  IF l.counted_qty IS NULL THEN RAISE EXCEPTION '盘点明细 % 未录入实盘数', p_stline; END IF;

  IF l.slot_id IS NOT NULL THEN
    SELECT warehouse_id INTO v_wh FROM slot WHERE slot_id = l.slot_id;
  ELSE
    RAISE EXCEPTION '外协/无库位明细请用 op_inbound/op_outbound 手工调整';
  END IF;

  -- 实时当前账面（锁定该快照行，避免并发漂移）
  SELECT qty_on_hand INTO v_cur FROM inventory
  WHERE product_id = l.product_id AND warehouse_id = v_wh
    AND slot_id IS NOT DISTINCT FROM l.slot_id
    AND batch_id IS NOT DISTINCT FROM l.batch_id
    AND quality = 'GOOD'
  FOR UPDATE;
  v_cur := COALESCE(v_cur, 0);

  v_delta := l.counted_qty - v_cur;   -- 归到实盘
  IF v_delta = 0 THEN RETURN NULL; END IF;

  PERFORM fn_inventory_apply_delta(l.product_id, v_wh, l.slot_id, l.batch_id, 'GOOD', v_delta);

  INSERT INTO stock_movement(product_id, warehouse_id, slot_id, batch_id, quality,
                             type, qty, reason, operator_id)
  VALUES (l.product_id, v_wh, l.slot_id, l.batch_id, 'GOOD',
          'ADJUST', v_delta,
          format('盘点调整(实盘 %s / 调整时账面 %s)', l.counted_qty, v_cur), p_operator)
  RETURNING movement_id INTO v_mv;

  UPDATE stocktake_line SET adj_movement_id = v_mv WHERE stline_id = p_stline;

  RETURN v_mv;
END;
$$ LANGUAGE plpgsql;

COMMIT;
