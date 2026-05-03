-- =============================================
-- v2 マイグレーション: 天候・予約・前年データ
-- Supabase SQL Editorで実行してください
-- =============================================

-- 1. daily_records に天候・祝日フィールドを追加
ALTER TABLE daily_records
  ADD COLUMN IF NOT EXISTS weather TEXT CHECK (weather IN ('sunny', 'cloudy', 'rainy', 'stormy')),
  ADD COLUMN IF NOT EXISTS is_holiday BOOLEAN NOT NULL DEFAULT FALSE;

-- 2. 予約テーブル
CREATE TABLE IF NOT EXISTS reservations (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date                 DATE NOT NULL,
  type                 TEXT NOT NULL CHECK (type IN ('group_reservation', 'event', 'closure')),
  name                 TEXT,
  expected_participants INTEGER,
  time_slot            TEXT,
  memo                 TEXT,
  created_by           UUID REFERENCES staff(id),
  created_at           TIMESTAMPTZ DEFAULT NOW(),
  updated_at           TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE reservations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all" ON reservations FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS reservations_date_idx ON reservations(date);

-- 3. 前年月次実績テーブル
CREATE TABLE IF NOT EXISTS historical_monthly (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  year               INTEGER NOT NULL,
  month              INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
  total_participants INTEGER NOT NULL DEFAULT 0,
  total_consumption  INTEGER NOT NULL DEFAULT 0,
  total_revenue      INTEGER NOT NULL DEFAULT 0,
  total_sessions     INTEGER NOT NULL DEFAULT 0,
  memo               TEXT,
  created_at         TIMESTAMPTZ DEFAULT NOW(),
  updated_at         TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(year, month)
);

ALTER TABLE historical_monthly ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all" ON historical_monthly FOR ALL USING (true) WITH CHECK (true);

-- 4. daily_summary ビューを再作成（天候・祝日を含める）
DROP VIEW IF EXISTS daily_summary;
CREATE VIEW daily_summary AS
SELECT
  dr.date,
  dr.season_id,
  dr.weather,
  dr.is_holiday,
  COUNT(s.id)::INTEGER                   AS session_count,
  COALESCE(SUM(s.participants), 0)::INTEGER AS total_participants,
  COALESCE(SUM(s.salt_grilled_count + COALESCE(s.gutted_count,0) + s.takeaway_count + COALESCE(s.gift_count,0)), 0)::INTEGER AS total_consumption,
  dr.purchase_unit_price,
  dr.purchase_count,
  dr.closing_estimated_remaining
FROM daily_records dr
LEFT JOIN sessions s ON s.date = dr.date
GROUP BY
  dr.date, dr.season_id, dr.weather, dr.is_holiday,
  dr.purchase_unit_price, dr.purchase_count, dr.closing_estimated_remaining;
