-- =============================================
-- v5: 仕入れ支払管理テーブル
-- =============================================

CREATE TABLE IF NOT EXISTS purchase_payments (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  year_month       TEXT NOT NULL UNIQUE,  -- '2025-05'
  total_amount     INTEGER NOT NULL DEFAULT 0,
  payment_due_date DATE NOT NULL,
  paid_at          TIMESTAMPTZ,
  notes            TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE purchase_payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all" ON purchase_payments;
CREATE POLICY "allow_all" ON purchase_payments FOR ALL USING (true) WITH CHECK (true);
