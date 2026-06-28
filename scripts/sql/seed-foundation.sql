BEGIN;

INSERT INTO warehouse (warehouse_id, name, type, has_slots)
VALUES
  ('W1', '一号仓库', 'NORMAL', true),
  ('W2', '二号仓库', 'NORMAL', true),
  ('W3', '三号仓库', 'NORMAL', true),
  ('OUTSOURCE', '外协库', 'OUTSOURCE', false)
ON CONFLICT (warehouse_id) DO NOTHING;

INSERT INTO app_user (name, role, warehouse_id)
SELECT 'operator', 'OPERATOR', 'W1'
WHERE NOT EXISTS (SELECT 1 FROM app_user WHERE name = 'operator');

INSERT INTO app_user (name, role, warehouse_id)
SELECT 'admin', 'ADMIN', NULL
WHERE NOT EXISTS (SELECT 1 FROM app_user WHERE name = 'admin');

INSERT INTO app_user (name, role, warehouse_id)
SELECT 'boss', 'BOSS', NULL
WHERE NOT EXISTS (SELECT 1 FROM app_user WHERE name = 'boss');

INSERT INTO app_user_password (user_id, password_hash)
SELECT user_id, crypt('operator123', gen_salt('bf')) FROM app_user WHERE name = 'operator'
ON CONFLICT (user_id) DO UPDATE SET password_hash = EXCLUDED.password_hash, updated_at = now();

INSERT INTO app_user_password (user_id, password_hash)
SELECT user_id, crypt('admin123', gen_salt('bf')) FROM app_user WHERE name = 'admin'
ON CONFLICT (user_id) DO UPDATE SET password_hash = EXCLUDED.password_hash, updated_at = now();

INSERT INTO app_user_password (user_id, password_hash)
SELECT user_id, crypt('boss123', gen_salt('bf')) FROM app_user WHERE name = 'boss'
ON CONFLICT (user_id) DO UPDATE SET password_hash = EXCLUDED.password_hash, updated_at = now();

INSERT INTO slot (warehouse_id, code, row_no, col_no, level_no, position, status)
VALUES
  ('W1', 'W1-R01-C01-L1-A', 1, 1, 1, 'A', 'AVAILABLE'),
  ('W1', 'W1-R01-C01-L1-B', 1, 1, 1, 'B', 'AVAILABLE'),
  ('W2', 'W2-R01-C01-L1-A', 1, 1, 1, 'A', 'AVAILABLE')
ON CONFLICT (code) DO NOTHING;

INSERT INTO product (
  product_id,
  type,
  name,
  has_tube,
  has_alu_plate,
  has_dust_cover,
  safety_stock,
  remark
)
VALUES
  ('FG-7L0199131F', 'FG', '7L0 199 131F 成品总成', true, true, true, 5, '客户常搜：带管子总成'),
  ('SF-7L0199131F-01', 'SF', '7L0 199 131F 半成品 01', true, false, false, 10, 'BOM 第一层半成品'),
  ('RM-0123', 'RM', '橡胶原材料 0123', false, false, false, 50, '用于半成品硫化'),
  ('ACC-DUST-COVER', 'ACC', '防尘罩配件', false, false, true, 20, '成品装配配件')
ON CONFLICT (product_id) DO NOTHING;

INSERT INTO product_alias (product_id, alias_text)
VALUES
  ('FG-7L0199131F', '带管子'),
  ('FG-7L0199131F', '7L0 199 131F'),
  ('SF-7L0199131F-01', '7L0 199 131F-1'),
  ('RM-0123', '7L0 199 131F-1-1'),
  ('ACC-DUST-COVER', '防尘罩')
ON CONFLICT (product_id, alias_text) DO NOTHING;

INSERT INTO bom_line (parent_product_id, child_product_id, qty, seq)
VALUES
  ('FG-7L0199131F', 'SF-7L0199131F-01', 1, 1),
  ('FG-7L0199131F', 'ACC-DUST-COVER', 1, 2),
  ('SF-7L0199131F-01', 'RM-0123', 2, 1)
ON CONFLICT (parent_product_id, child_product_id) DO NOTHING;

SELECT fn_regen_path_aliases();

WITH ids AS (
  SELECT
    (SELECT user_id FROM app_user WHERE role = 'ADMIN' ORDER BY user_id LIMIT 1) AS admin_user_id,
    (SELECT slot_id FROM slot WHERE code = 'W1-R01-C01-L1-A') AS slot_a,
    (SELECT slot_id FROM slot WHERE code = 'W1-R01-C01-L1-B') AS slot_b
)
SELECT op_inbound('RM-0123', 'W1', 100, ids.slot_a, NULL, 'GOOD', 'IN', '初始测试库存', NULL, ids.admin_user_id)
FROM ids
WHERE NOT EXISTS (
  SELECT 1 FROM stock_movement WHERE product_id = 'RM-0123' AND reason = '初始测试库存'
);

WITH ids AS (
  SELECT
    (SELECT user_id FROM app_user WHERE role = 'ADMIN' ORDER BY user_id LIMIT 1) AS admin_user_id,
    (SELECT slot_id FROM slot WHERE code = 'W1-R01-C01-L1-B') AS slot_b
)
SELECT op_inbound('ACC-DUST-COVER', 'W1', 30, ids.slot_b, NULL, 'GOOD', 'IN', '初始测试库存', NULL, ids.admin_user_id)
FROM ids
WHERE NOT EXISTS (
  SELECT 1 FROM stock_movement WHERE product_id = 'ACC-DUST-COVER' AND reason = '初始测试库存'
);

COMMIT;
