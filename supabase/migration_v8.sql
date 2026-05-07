-- =============================================
-- migration_v8: sessions テーブルに客層カラムを追加
-- =============================================

ALTER TABLE sessions
  ADD COLUMN IF NOT EXISTS customer_type TEXT
  CHECK (customer_type IN ('family', 'school', 'company', 'individual', 'other'));

-- 客層分析用インデックス
CREATE INDEX IF NOT EXISTS sessions_customer_type_idx ON sessions (customer_type);
CREATE INDEX IF NOT EXISTS sessions_date_customer_type_idx ON sessions (date, customer_type);
