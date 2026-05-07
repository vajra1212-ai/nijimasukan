-- =============================================
-- migration_v7: invoices テーブル（納品書・請求書管理）
-- =============================================

CREATE TABLE IF NOT EXISTS invoices (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  -- 書類種別
  type              TEXT        NOT NULL DEFAULT 'invoice'
                    CHECK (type IN ('delivery_note', 'invoice')),
  -- 業者情報
  company_name      TEXT,
  invoice_number    TEXT,
  -- 日付
  invoice_date      DATE,
  received_date     DATE        NOT NULL DEFAULT CURRENT_DATE,
  -- 請求月・金額
  billing_month     TEXT        NOT NULL,  -- 'YYYY-MM' 形式
  amount            INTEGER     NOT NULL DEFAULT 0,
  payment_due_date  DATE        NOT NULL,  -- 翌月末日（自動計算して保存）
  -- 支払管理
  paid_at           TIMESTAMPTZ,
  paid_by           UUID        REFERENCES staff(id) ON DELETE SET NULL,
  -- ファイル
  file_url          TEXT,
  file_name         TEXT,
  -- 明細・備考
  line_items        JSONB,      -- [{"name":"..","quantity":N,"unit":"..","unit_price":N,"amount":N}]
  notes             TEXT,
  -- メタ
  created_by        UUID        REFERENCES staff(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all" ON invoices;
CREATE POLICY "allow_all" ON invoices FOR ALL USING (true);

-- インデックス
CREATE INDEX IF NOT EXISTS invoices_billing_month_idx ON invoices (billing_month);
CREATE INDEX IF NOT EXISTS invoices_payment_due_date_idx ON invoices (payment_due_date);
CREATE INDEX IF NOT EXISTS invoices_paid_at_idx ON invoices (paid_at);
