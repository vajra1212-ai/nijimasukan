-- =============================================
-- v4: アルバイト管理・仕入れkg対応
-- =============================================

-- アルバイトマスタ
CREATE TABLE IF NOT EXISTS part_timers (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  hourly_wage INTEGER NOT NULL DEFAULT 1000,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE part_timers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all" ON part_timers FOR ALL USING (true) WITH CHECK (true);

-- 出勤記録
CREATE TABLE IF NOT EXISTS work_shifts (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date           DATE NOT NULL,
  part_timer_id  UUID NOT NULL REFERENCES part_timers(id) ON DELETE CASCADE,
  start_time     TIME NOT NULL,
  end_time       TIME NOT NULL,
  notes          TEXT,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(date, part_timer_id)
);
ALTER TABLE work_shifts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all" ON work_shifts FOR ALL USING (true) WITH CHECK (true);

-- daily_recordsに仕入れkg・金額を追加
ALTER TABLE daily_records
  ADD COLUMN IF NOT EXISTS purchase_weight_kg    NUMERIC(7,1),
  ADD COLUMN IF NOT EXISTS purchase_total_amount INTEGER;
