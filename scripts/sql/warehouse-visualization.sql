BEGIN;

CREATE TABLE IF NOT EXISTS warehouse_layout_template (
  template_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  default_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS rack_template (
  template_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code text NOT NULL UNIQUE,
  name text NOT NULL UNIQUE,
  bay_count integer NOT NULL CHECK (bay_count > 0),
  level_count integer NOT NULL CHECK (level_count > 0),
  positions text[] NOT NULL CHECK (array_length(positions, 1) > 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS warehouse_layout (
  layout_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  warehouse_id text NOT NULL REFERENCES warehouse(warehouse_id),
  layout_template_id bigint REFERENCES warehouse_layout_template(template_id),
  name text NOT NULL,
  version integer NOT NULL DEFAULT 1,
  is_active boolean NOT NULL DEFAULT true,
  canvas_width numeric NOT NULL DEFAULT 1200,
  canvas_height numeric NOT NULL DEFAULT 720,
  grid_size numeric NOT NULL DEFAULT 20,
  created_by bigint REFERENCES app_user(user_id),
  updated_by bigint REFERENCES app_user(user_id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS warehouse_layout_one_active_idx
  ON warehouse_layout (warehouse_id)
  WHERE is_active;

CREATE TABLE IF NOT EXISTS layout_zone (
  zone_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  layout_id bigint NOT NULL REFERENCES warehouse_layout(layout_id) ON DELETE CASCADE,
  code text NOT NULL,
  name text NOT NULL,
  x numeric NOT NULL DEFAULT 0,
  y numeric NOT NULL DEFAULT 0,
  width numeric NOT NULL DEFAULT 0,
  height numeric NOT NULL DEFAULT 0,
  color text,
  seq integer NOT NULL DEFAULT 0,
  created_by bigint REFERENCES app_user(user_id),
  updated_by bigint REFERENCES app_user(user_id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (layout_id, code)
);

CREATE TABLE IF NOT EXISTS rack_layout (
  rack_layout_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  layout_id bigint NOT NULL REFERENCES warehouse_layout(layout_id) ON DELETE CASCADE,
  template_id bigint NOT NULL REFERENCES rack_template(template_id),
  zone_id bigint REFERENCES layout_zone(zone_id) ON DELETE SET NULL,
  code text NOT NULL,
  name text NOT NULL,
  x numeric NOT NULL DEFAULT 0,
  y numeric NOT NULL DEFAULT 0,
  rotation numeric NOT NULL DEFAULT 0,
  seq integer NOT NULL DEFAULT 0,
  created_by bigint REFERENCES app_user(user_id),
  updated_by bigint REFERENCES app_user(user_id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (layout_id, code),
  UNIQUE (rack_layout_id, layout_id)
);

CREATE TABLE IF NOT EXISTS rack_slot_map (
  map_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  rack_layout_id bigint NOT NULL,
  layout_id bigint NOT NULL,
  slot_id bigint NOT NULL REFERENCES slot(slot_id),
  bay_no integer NOT NULL CHECK (bay_no > 0),
  level_no integer NOT NULL CHECK (level_no > 0),
  position text NOT NULL CHECK (position IN ('A','B','C')),
  created_by bigint REFERENCES app_user(user_id),
  updated_by bigint REFERENCES app_user(user_id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (rack_layout_id, layout_id)
    REFERENCES rack_layout(rack_layout_id, layout_id) ON DELETE CASCADE,
  UNIQUE (rack_layout_id, bay_no, level_no, position),
  UNIQUE (layout_id, slot_id)
);

CREATE INDEX IF NOT EXISTS idx_layout_zone_layout ON layout_zone(layout_id);
CREATE INDEX IF NOT EXISTS idx_rack_layout_layout ON rack_layout(layout_id);
CREATE INDEX IF NOT EXISTS idx_rack_layout_template ON rack_layout(template_id);
CREATE INDEX IF NOT EXISTS idx_rack_slot_map_rack ON rack_slot_map(rack_layout_id);
CREATE INDEX IF NOT EXISTS idx_rack_slot_map_slot ON rack_slot_map(slot_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_warehouse_layout_updated'
  ) THEN
    CREATE TRIGGER trg_warehouse_layout_updated BEFORE UPDATE ON warehouse_layout
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_layout_zone_updated'
  ) THEN
    CREATE TRIGGER trg_layout_zone_updated BEFORE UPDATE ON layout_zone
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_rack_layout_updated'
  ) THEN
    CREATE TRIGGER trg_rack_layout_updated BEFORE UPDATE ON rack_layout
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_rack_slot_map_updated'
  ) THEN
    CREATE TRIGGER trg_rack_slot_map_updated BEFORE UPDATE ON rack_slot_map
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END;
$$;

INSERT INTO warehouse_layout_template (code, name, description, default_config)
VALUES
  ('PARALLEL_RACKS', '平行货架', '规则平行货架布局', '{"pattern":"parallel_racks"}'::jsonb),
  ('NARROW_AISLE', '密集窄巷', '密集窄通道布局', '{"pattern":"narrow_aisle"}'::jsonb),
  ('MIXED_ZONES', '分区混合', '多区域混合布局', '{"pattern":"mixed_zones"}'::jsonb),
  ('OUTSOURCE_AREA', '外协无货架', '外协仓无货架布局', '{"pattern":"outsource_area"}'::jsonb)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  default_config = EXCLUDED.default_config;

INSERT INTO rack_template (name, code, bay_count, level_count, positions)
VALUES
  ('标准三层货架', 'STANDARD', 4, 3, ARRAY['A','B','C']),
  ('托盘货架', 'PALLET', 6, 4, ARRAY['A','B']),
  ('轻型层板', 'SHELF', 5, 5, ARRAY['A','B','C'])
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  bay_count = EXCLUDED.bay_count,
  level_count = EXCLUDED.level_count,
  positions = EXCLUDED.positions;

COMMIT;
