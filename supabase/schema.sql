-- =============================================
-- ニジマスつかみ取り管理システム スキーマ
-- =============================================

-- シーズン管理
CREATE TABLE seasons (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  year       INTEGER NOT NULL UNIQUE,
  start_date DATE NOT NULL,
  end_date   DATE NOT NULL,
  is_active  BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- スタッフ
CREATE TABLE staff (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  role       TEXT NOT NULL CHECK (role IN ('staff', 'admin')),
  pin_hash   TEXT NOT NULL,
  is_active  BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 開催回記録
CREATE TABLE sessions (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date               DATE NOT NULL,
  session_number     INTEGER NOT NULL CHECK (session_number BETWEEN 1 AND 5),
  participants       INTEGER NOT NULL DEFAULT 0,
  salt_grilled_count INTEGER NOT NULL DEFAULT 0,
  takeaway_count     INTEGER NOT NULL DEFAULT 0,
  loss_count         INTEGER NOT NULL DEFAULT 0,
  memo               TEXT,
  created_by         UUID REFERENCES staff(id),
  created_at         TIMESTAMPTZ DEFAULT NOW(),
  updated_at         TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(date, session_number)
);

-- 日次記録
CREATE TABLE daily_records (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date                        DATE NOT NULL UNIQUE,
  season_id                   UUID REFERENCES seasons(id),
  purchase_count              INTEGER NOT NULL DEFAULT 0,
  purchase_unit_price         INTEGER NOT NULL DEFAULT 0,
  opening_estimated_remaining INTEGER,
  closing_estimated_remaining INTEGER,
  notes                       TEXT,
  closed_by                   UUID REFERENCES staff(id),
  closed_at                   TIMESTAMPTZ,
  created_at                  TIMESTAMPTZ DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ DEFAULT NOW()
);

-- 備品マスタ
CREATE TABLE equipment_items (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL UNIQUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active  BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 備品チェック日次記録
CREATE TABLE equipment_checks (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date              DATE NOT NULL,
  equipment_item_id UUID NOT NULL REFERENCES equipment_items(id),
  status            TEXT NOT NULL CHECK (status IN ('in_stock','low','order_required','unnecessary','ordered')),
  memo              TEXT,
  updated_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_by        UUID REFERENCES staff(id),
  UNIQUE(date, equipment_item_id)
);

-- 業者連絡・発注記録
CREATE TABLE supplier_contacts (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_datetime       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  memo                   TEXT,
  has_order              BOOLEAN NOT NULL DEFAULT FALSE,
  order_count            INTEGER,
  expected_delivery_date DATE,
  delivery_confirmed     BOOLEAN DEFAULT FALSE,
  delivery_confirmed_at  TIMESTAMPTZ,
  created_by             UUID REFERENCES staff(id),
  created_at             TIMESTAMPTZ DEFAULT NOW()
);

-- 引き継ぎメモ
CREATE TABLE handover_memos (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date         DATE NOT NULL UNIQUE,
  urgency      TEXT NOT NULL DEFAULT 'normal' CHECK (urgency IN ('normal','caution','urgent')),
  content      TEXT NOT NULL,
  created_by   UUID REFERENCES staff(id),
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  confirmed_by UUID REFERENCES staff(id),
  confirmed_at TIMESTAMPTZ
);

-- クレーム・トラブル記録
CREATE TABLE trouble_records (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  occurred_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  category     TEXT NOT NULL CHECK (category IN ('complaint','trouble','incident','improvement')),
  title        TEXT NOT NULL,
  situation    TEXT NOT NULL,
  resolution   TEXT,
  status       TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress','resolved','needs_review')),
  admin_note   TEXT,
  created_by   UUID REFERENCES staff(id),
  updated_by   UUID REFERENCES staff(id),
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

-- 設定
CREATE TABLE settings (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by UUID REFERENCES staff(id)
);

-- =============================================
-- 初期データ
-- =============================================

INSERT INTO equipment_items (name, sort_order) VALUES
  ('炭',         1), ('箸',          2), ('皿',     3),
  ('塩',         4), ('釣り銭',      5), ('持ち帰り袋', 6),
  ('軍手',       7), ('トング',      8), ('着火剤', 9),
  ('網',        10), ('アルミホイル', 11), ('ゴミ袋', 12);

INSERT INTO settings (key, value) VALUES
  ('participation_fee',     '500'),
  ('takeaway_fee',          '400'),
  ('salt_grilled_fee',      '700'),
  ('stock_alert_threshold', '100'),
  ('supplier_name',         ''),
  ('supplier_contact_name', ''),
  ('supplier_phone',        '');

INSERT INTO seasons (year, start_date, end_date, is_active) VALUES
  (2026, '2026-04-29', '2026-10-31', TRUE);

-- =============================================
-- 日次集計ビュー
-- =============================================

CREATE VIEW daily_summary AS
SELECT
  s.date,
  dr.season_id,
  COUNT(DISTINCT s.id)                                      AS session_count,
  COALESCE(SUM(s.participants), 0)                          AS total_participants,
  COALESCE(SUM(s.salt_grilled_count), 0)                    AS total_salt_grilled,
  COALESCE(SUM(s.takeaway_count), 0)                        AS total_takeaway,
  COALESCE(SUM(s.salt_grilled_count + s.takeaway_count), 0) AS total_consumption,
  COALESCE(SUM(s.loss_count), 0)                            AS total_loss,
  COALESCE(dr.purchase_count, 0)                            AS purchase_count,
  COALESCE(dr.purchase_unit_price, 0)                       AS purchase_unit_price,
  dr.opening_estimated_remaining,
  dr.closing_estimated_remaining,
  dr.closed_at
FROM sessions s
LEFT JOIN daily_records dr ON s.date = dr.date
GROUP BY
  s.date, dr.season_id, dr.purchase_count, dr.purchase_unit_price,
  dr.opening_estimated_remaining, dr.closing_estimated_remaining, dr.closed_at;

-- =============================================
-- RLS（行レベルセキュリティ）
-- =============================================

ALTER TABLE sessions         ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_records    ENABLE ROW LEVEL SECURITY;
ALTER TABLE equipment_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplier_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE handover_memos   ENABLE ROW LEVEL SECURITY;
ALTER TABLE trouble_records  ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings         ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff            ENABLE ROW LEVEL SECURITY;
ALTER TABLE equipment_items  ENABLE ROW LEVEL SECURITY;
ALTER TABLE seasons          ENABLE ROW LEVEL SECURITY;

-- anon キーで全操作を許可（PIN認証はアプリ側で管理）
CREATE POLICY "allow_all" ON sessions          FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON daily_records     FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON equipment_checks  FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON supplier_contacts FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON handover_memos    FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON trouble_records   FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON settings          FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON staff             FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON equipment_items   FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON seasons           FOR ALL USING (true) WITH CHECK (true);
