-- =============================================================
-- 汽配 WMS — 应用层业务逻辑 (PL/pgSQL)
-- 版本 V1.7 | 2026-06-28 | 依赖 wms_schema_v1.7.sql
--
-- 三组逻辑：
--   A. 路径别名生成   fn_regen_path_aliases()        —— 由 BOM 递归算出 A-1-1 并冻结入表
--   B. 规则引擎/缺料   fn_order_mrp(order)             —— 单订单逐层净需求展开，算“差几个原料”
--   C. 正向推衍       fn_where_used() / fn_max_producible()
-- 约定：库存按 GOOD 质量、跨仓汇总(库存可跨仓查)；缺料计算“不算其他订单已占用”，故用总在库。
-- =============================================================

BEGIN;

-- =============================================================
-- A. 路径别名生成
--    规则：父项 P 的第 seq 个子项 → 路径 "P-seq"，逐层向下延伸。
--    每个有子项的物料都作为一个“根”，所以同一物料会得到多条别名
--    (例：RM-E 同时是 FG-A 下的 FG-A-1-1、FG-A2 下的 FG-A2-1-1、SF-B 下的 SF-B-1)。
--    BOM 几乎固定，采用全量重建(幂等、确定性)；BOM 变更后调用一次即可。
-- =============================================================
CREATE OR REPLACE FUNCTION fn_regen_path_aliases() RETURNS integer AS $$
DECLARE v_count integer;
BEGIN
  TRUNCATE bom_path_alias;

  INSERT INTO bom_path_alias(product_id, root_product_id, path_text, generated_at)
  WITH RECURSIVE walk AS (
    -- 基础：每条 BOM 行 = “以父项为根”的第一段
    SELECT
      bl.parent_product_id                         AS root_id,
      bl.child_product_id                          AS product_id,
      bl.parent_product_id || '-' || bl.seq        AS path_text,
      ARRAY[bl.parent_product_id, bl.child_product_id] AS visited,
      1                                            AS depth
    FROM bom_line bl
    UNION ALL
    -- 递归：沿子项继续向下，路径追加 -seq
    SELECT
      w.root_id,
      bl.child_product_id,
      w.path_text || '-' || bl.seq,
      w.visited || bl.child_product_id,
      w.depth + 1
    FROM walk w
    JOIN bom_line bl ON bl.parent_product_id = w.product_id
    WHERE NOT (bl.child_product_id = ANY(w.visited))  -- 防环
      AND w.depth < 20                                -- 安全深度
  )
  SELECT product_id, root_id, path_text, now() FROM walk;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;   -- 生成的别名条数
END;
$$ LANGUAGE plpgsql;

-- =============================================================
-- B. 规则引擎：单订单逐层净需求(MRP)
--    逐层处理(父先于子)：净需求 = max(累计毛需求 − 总在库, 0)，
--    再把净需求按 BOM 用量下展开给子项。叶子层(原料)的净需求即“缺口”。
--    “不算其他订单已占用” → on_hand 用总在库，不扣预留。
-- =============================================================
CREATE OR REPLACE FUNCTION fn_order_mrp(p_order bigint)
RETURNS TABLE(
  product_id   text,
  ptype        text,
  lvl          int,
  gross_demand numeric,   -- 累计毛需求
  on_hand      numeric,   -- 总在库(GOOD,跨仓)
  net_required numeric    -- 净需求/缺口(需自制或采购)
) AS $$
#variable_conflict use_column
DECLARE v_lvl int; v_max int;
BEGIN
  DROP TABLE IF EXISTS _mrp;
  CREATE TEMP TABLE _mrp (
    product_id text PRIMARY KEY,
    ptype      text,
    lvl        int,
    demand     numeric NOT NULL DEFAULT 0,
    on_hand    numeric NOT NULL DEFAULT 0,
    net        numeric NOT NULL DEFAULT 0
  ) ON COMMIT DROP;

  -- 展开订单涉及的所有物料，lvl 取“最长路径深度”(保证父先于子的拓扑序)
  INSERT INTO _mrp(product_id, ptype, lvl)
  WITH RECURSIVE ex AS (
    SELECT ol.product_id, 0 AS lvl
    FROM order_line ol WHERE ol.order_id = p_order
    UNION ALL
    SELECT bl.child_product_id, ex.lvl + 1
    FROM ex JOIN bom_line bl ON bl.parent_product_id = ex.product_id
    WHERE ex.lvl < 30
  )
  SELECT e.product_id, p.type, max(e.lvl)
  FROM ex e JOIN product p USING(product_id)
  GROUP BY e.product_id, p.type;

  -- 顶层需求 = 订单行数量
  UPDATE _mrp m SET demand = s.q
  FROM (SELECT product_id, sum(qty)::numeric q FROM order_line WHERE order_id = p_order GROUP BY product_id) s
  WHERE m.product_id = s.product_id;

  -- 总在库(GOOD,跨仓)
  UPDATE _mrp m SET on_hand = COALESCE(t.q, 0)
  FROM (SELECT product_id, sum(qty_on_hand) q FROM inventory WHERE quality = 'GOOD' GROUP BY product_id) t
  WHERE m.product_id = t.product_id;

  SELECT max(lvl) INTO v_max FROM _mrp;
  FOR v_lvl IN 0 .. COALESCE(v_max, 0) LOOP
    -- 本层净需求
    UPDATE _mrp SET net = GREATEST(demand - on_hand, 0) WHERE lvl = v_lvl;
    -- 净需求按用量下展开到子项
    UPDATE _mrp c SET demand = c.demand + x.add
    FROM (
      SELECT bl.child_product_id AS cid, sum(m.net * bl.qty) AS add
      FROM _mrp m JOIN bom_line bl ON bl.parent_product_id = m.product_id
      WHERE m.lvl = v_lvl
      GROUP BY bl.child_product_id
    ) x
    WHERE c.product_id = x.cid;
  END LOOP;

  RETURN QUERY
  SELECT m.product_id, m.ptype, m.lvl,
         round(m.demand, 4), round(m.on_hand, 4), round(m.net, 4)
  FROM _mrp m ORDER BY m.lvl, m.product_id;
END;
$$ LANGUAGE plpgsql;

-- =============================================================
-- C1. where-used：某物料用在哪些半成品/成品里
-- =============================================================
CREATE OR REPLACE FUNCTION fn_where_used(p_product text, p_recursive boolean DEFAULT false)
RETURNS TABLE(parent_product_id text, ptype text, lvl int) AS $$
BEGIN
  IF p_recursive THEN
    RETURN QUERY
    WITH RECURSIVE up AS (
      SELECT bl.parent_product_id, 1 AS lvl
      FROM bom_line bl WHERE bl.child_product_id = p_product
      UNION ALL
      SELECT bl.parent_product_id, up.lvl + 1
      FROM up JOIN bom_line bl ON bl.child_product_id = up.parent_product_id
      WHERE up.lvl < 30
    )
    SELECT u.parent_product_id, p.type, min(u.lvl)
    FROM up u JOIN product p ON p.product_id = u.parent_product_id
    GROUP BY u.parent_product_id, p.type
    ORDER BY 3, 1;
  ELSE
    RETURN QUERY
    SELECT bl.parent_product_id, p.type, 1
    FROM bom_line bl JOIN product p ON p.product_id = bl.parent_product_id
    WHERE bl.child_product_id = p_product
    ORDER BY 1;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- =============================================================
-- C2. 正向推衍：当前库存能做多少个 p_target(单层，用直接子项的在库)
--     返回上限数量 + 卡脖子的物料。点击触发计算，非实时渲染。
-- =============================================================
CREATE OR REPLACE FUNCTION fn_max_producible(p_target text)
RETURNS TABLE(target text, max_make numeric, limiting_product text, limiting_on_hand numeric) AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM bom_line WHERE parent_product_id = p_target) THEN
    RAISE EXCEPTION '% 没有 BOM 子项(原料/配件不可制造)', p_target;
  END IF;

  RETURN QUERY
  WITH cap AS (
    SELECT bl.child_product_id AS cid,
           bl.qty AS per,
           COALESCE((SELECT sum(qty_on_hand) FROM inventory
                     WHERE product_id = bl.child_product_id AND quality = 'GOOD'), 0) AS oh
    FROM bom_line bl
    WHERE bl.parent_product_id = p_target
  ), calc AS (
    SELECT cid, oh, floor(oh / per) AS can FROM cap
  )
  SELECT p_target,
         COALESCE(min(can), 0),
         (SELECT cid FROM calc ORDER BY can ASC, cid LIMIT 1),
         (SELECT oh  FROM calc ORDER BY can ASC, cid LIMIT 1)
  FROM calc;
END;
$$ LANGUAGE plpgsql;

-- =============================================================
-- C3. 深度正向推衍：当前库存最多能做多少个 p_target（跨层）
--     正确处理你提醒的三件事：
--       · 一个成品需多个半成品/配件“一起” → 取所有共需料的最短板(min)
--       · 配件(ACC)同样是会卡脖子的消耗料 → 按叶子参与约束
--       · 同一原料被多个分支共用 → 用量逐层累加
--     做法：对产量 N 二分搜索；每个 N 跑一遍逐层净需求(半成品库存可选用)，
--           只要任一“叶子料”(无 BOM 的原料/配件)出现缺口即不可行。
--     p_use_sf_stock=true 时会消耗现有半成品库存（“厂里现有的料最多出几个成品”）。
-- -------------------------------------------------------------
-- 内部：对给定产量 N，在会话临时表 _deep 上跑净需求，返回叶子料最大缺口
-- （用 EXECUTE 动态访问 _deep，避免建函数时的表依赖）
CREATE OR REPLACE FUNCTION fn__deep_shortage(p_n numeric, p_maxlvl int)
RETURNS numeric AS $$
DECLARE v_lvl int; v_short numeric;
BEGIN
  EXECUTE 'UPDATE _deep SET demand = 0, net = 0';
  EXECUTE 'UPDATE _deep SET demand = $1 WHERE lvl = 0' USING p_n;
  FOR v_lvl IN 0 .. p_maxlvl LOOP
    EXECUTE 'UPDATE _deep SET net = GREATEST(demand - stock_use, 0) WHERE lvl = $1' USING v_lvl;
    EXECUTE '
      UPDATE _deep c SET demand = c.demand + x.add
      FROM (SELECT bl.child_product_id AS cid, sum(d.net * bl.qty) AS add
            FROM _deep d JOIN bom_line bl ON bl.parent_product_id = d.product_id
            WHERE d.lvl = $1 GROUP BY bl.child_product_id) x
      WHERE c.product_id = x.cid' USING v_lvl;
  END LOOP;
  EXECUTE 'SELECT COALESCE(max(net), 0) FROM _deep WHERE is_leaf' INTO v_short;
  RETURN v_short;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION fn_max_producible_deep(
  p_target       text,
  p_use_sf_stock boolean DEFAULT true
)
RETURNS TABLE(
  target            text,
  max_make          numeric,
  limiting_product  text,
  limiting_on_hand  numeric,
  limiting_demand   numeric    -- 该料在 max+1 时的需求（即卡点）
) AS $$
#variable_conflict use_column
DECLARE
  v_max int; v_lo bigint := 0; v_hi bigint := 1;
  v_mid bigint; v_cap bigint := 1000000000;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM bom_line WHERE parent_product_id = p_target) THEN
    RAISE EXCEPTION '% 没有 BOM 子项(原料/配件不可制造)', p_target;
  END IF;

  DROP TABLE IF EXISTS _deep;
  CREATE TEMP TABLE _deep(
    product_id text PRIMARY KEY,
    ptype      text,
    lvl        int,
    is_leaf    boolean,
    stock_use  numeric NOT NULL DEFAULT 0,
    demand     numeric NOT NULL DEFAULT 0,
    net        numeric NOT NULL DEFAULT 0
  ) ON COMMIT DROP;

  -- 展开目标的整棵 BOM；lvl 取最长路径(拓扑序)；标记叶子；定计算用在库
  INSERT INTO _deep(product_id, ptype, lvl, is_leaf, stock_use)
  WITH RECURSIVE ex AS (
    SELECT p_target AS product_id, 0 AS lvl
    UNION ALL
    SELECT bl.child_product_id, ex.lvl + 1
    FROM ex JOIN bom_line bl ON bl.parent_product_id = ex.product_id
    WHERE ex.lvl < 30
  )
  SELECT e.product_id, p.type, max(e.lvl),
         NOT EXISTS (SELECT 1 FROM bom_line b WHERE b.parent_product_id = e.product_id),
         CASE
           WHEN e.product_id = p_target THEN 0                         -- 目标从零做，不计自身库存
           WHEN p.type = 'SF' AND NOT p_use_sf_stock THEN 0            -- 选择不用半成品库存
           ELSE COALESCE((SELECT sum(qty_on_hand) FROM inventory
                          WHERE product_id = e.product_id AND quality = 'GOOD'), 0)
         END
  FROM ex e JOIN product p ON p.product_id = e.product_id
  GROUP BY e.product_id, p.type;

  SELECT max(lvl) INTO v_max FROM _deep;

  -- 倍增找上界（首个不可行的 N）
  LOOP
    EXIT WHEN fn__deep_shortage(v_hi, v_max) > 0;
    v_lo := v_hi; v_hi := v_hi * 2;
    EXIT WHEN v_hi > v_cap;
  END LOOP;

  -- 二分：v_lo 可行 / v_hi 不可行
  WHILE v_hi - v_lo > 1 LOOP
    v_mid := (v_lo + v_hi) / 2;
    IF fn__deep_shortage(v_mid, v_max) > 0 THEN v_hi := v_mid; ELSE v_lo := v_mid; END IF;
  END LOOP;

  -- 在 v_lo+1 处定位卡脖子的叶子料
  PERFORM fn__deep_shortage(v_lo + 1, v_max);

  target := p_target;
  max_make := v_lo;
  SELECT d.product_id, d.stock_use, d.demand
    INTO limiting_product, limiting_on_hand, limiting_demand
  FROM _deep d WHERE d.is_leaf AND d.net > 0
  ORDER BY d.net DESC, d.product_id LIMIT 1;

  RETURN NEXT;
END;
$$ LANGUAGE plpgsql;

COMMIT;
