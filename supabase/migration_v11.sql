-- =============================================
-- migration_v11: シフト管理に「予定 / 実績」区別を追加
-- =============================================

-- work_shifts に is_planned フラグを追加
-- is_planned = true  → 出勤予定（事前入力）
-- is_planned = false → 実績（日次締め時に確認済み）
ALTER TABLE work_shifts
  ADD COLUMN IF NOT EXISTS is_planned BOOLEAN NOT NULL DEFAULT FALSE;

-- 既存レコードはすべて「実績」として扱う（デフォルトFALSEで対応済み）

CREATE INDEX IF NOT EXISTS work_shifts_is_planned_idx ON work_shifts (is_planned);
CREATE INDEX IF NOT EXISTS work_shifts_date_idx ON work_shifts (date);
