-- =============================================
-- migration_v9: ショートメール送信履歴テーブル
-- =============================================

CREATE TABLE IF NOT EXISTS message_logs (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_type  TEXT        NOT NULL CHECK (recipient_type IN ('customer', 'supplier')),
  recipient_name  TEXT        NOT NULL,
  phone           TEXT        NOT NULL,
  message         TEXT        NOT NULL,
  sent_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sent_by         UUID        REFERENCES staff(id) ON DELETE SET NULL,
  customer_id     UUID        REFERENCES customers(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE message_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all" ON message_logs;
CREATE POLICY "allow_all" ON message_logs FOR ALL USING (true);

CREATE INDEX IF NOT EXISTS message_logs_sent_at_idx ON message_logs (sent_at DESC);
CREATE INDEX IF NOT EXISTS message_logs_recipient_type_idx ON message_logs (recipient_type);
