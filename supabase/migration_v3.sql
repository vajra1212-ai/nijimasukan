-- =============================================
-- v3 マイグレーション: 日次過去データ・分析用
-- Supabase SQL Editorで実行してください
-- =============================================

-- 日次過去データテーブル（Squareデータ取込先）
CREATE TABLE IF NOT EXISTS historical_daily (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date                   DATE NOT NULL UNIQUE,
  total_revenue          INTEGER NOT NULL DEFAULT 0,
  participation_revenue  INTEGER NOT NULL DEFAULT 0,
  salt_grilled_revenue   INTEGER NOT NULL DEFAULT 0,
  gutted_revenue         INTEGER NOT NULL DEFAULT 0,
  takeaway_revenue       INTEGER NOT NULL DEFAULT 0,
  other_revenue          INTEGER NOT NULL DEFAULT 0,
  estimated_participants INTEGER NOT NULL DEFAULT 0,
  weather                TEXT CHECK (weather IN ('sunny', 'cloudy', 'rainy', 'stormy')),
  is_holiday             BOOLEAN NOT NULL DEFAULT FALSE,
  notes                  TEXT,
  data_source            TEXT NOT NULL DEFAULT 'manual',
  created_at             TIMESTAMPTZ DEFAULT NOW(),
  updated_at             TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE historical_daily ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all" ON historical_daily FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS historical_daily_date_idx ON historical_daily(date);
CREATE INDEX IF NOT EXISTS historical_daily_year_idx ON historical_daily(EXTRACT(YEAR FROM date)::INTEGER, EXTRACT(MONTH FROM date)::INTEGER);
