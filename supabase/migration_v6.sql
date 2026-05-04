-- =============================================
-- v6: マニュアル・顧客・経費・資料管理
-- =============================================

-- マニュアル
CREATE TABLE IF NOT EXISTS manuals (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category    TEXT NOT NULL DEFAULT 'general',
  -- 'weather'|'purchase'|'customer'|'season'|'general'
  format      TEXT NOT NULL DEFAULT 'procedure',
  -- 'procedure'|'script'|'caution'|'qa'
  title       TEXT NOT NULL,
  content     TEXT NOT NULL,
  importance  TEXT NOT NULL DEFAULT 'normal', -- 'high'|'normal'
  sort_order  INTEGER DEFAULT 0,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_by  TEXT,
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE manuals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all" ON manuals;
CREATE POLICY "allow_all" ON manuals FOR ALL USING (true) WITH CHECK (true);

-- trouble_recordsにマニュアルリンクを追加
ALTER TABLE trouble_records
  ADD COLUMN IF NOT EXISTS linked_manual_id UUID REFERENCES manuals(id);

-- 顧客マスタ
CREATE TABLE IF NOT EXISTS customers (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name             TEXT NOT NULL,
  type             TEXT NOT NULL DEFAULT 'individual',
  -- 'school'|'company'|'family'|'individual'|'other'
  contact_name     TEXT,
  phone            TEXT,
  email            TEXT,
  address          TEXT,
  notes            TEXT,
  first_visit_date DATE,
  last_visit_date  DATE,
  total_visits     INTEGER DEFAULT 0,
  is_active        BOOLEAN NOT NULL DEFAULT TRUE,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all" ON customers;
CREATE POLICY "allow_all" ON customers FOR ALL USING (true) WITH CHECK (true);

-- reservationsに顧客IDと来場者数を追加
ALTER TABLE reservations
  ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES customers(id),
  ADD COLUMN IF NOT EXISTS actual_participants INTEGER;

-- 経費管理（炭・備品・光熱費など）
CREATE TABLE IF NOT EXISTS expenses (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date        DATE NOT NULL,
  year_month  TEXT NOT NULL, -- '2025-05'
  category    TEXT NOT NULL DEFAULT 'other',
  -- 'charcoal'|'equipment'|'utility'|'cleaning'|'other'
  description TEXT NOT NULL,
  quantity    NUMERIC,
  unit        TEXT,   -- 'kg', '袋', '個', etc.
  unit_price  INTEGER,
  amount      INTEGER NOT NULL,
  created_by  TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all" ON expenses;
CREATE POLICY "allow_all" ON expenses FOR ALL USING (true) WITH CHECK (true);

-- 資料管理（チラシ・許可証など）
CREATE TABLE IF NOT EXISTS documents (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title       TEXT NOT NULL,
  category    TEXT NOT NULL DEFAULT 'other',
  -- 'flyer'|'permit'|'guide'|'supplier'|'other'
  file_url    TEXT NOT NULL,
  file_name   TEXT NOT NULL,
  file_size   INTEGER,
  notes       TEXT,
  created_by  TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all" ON documents;
CREATE POLICY "allow_all" ON documents FOR ALL USING (true) WITH CHECK (true);
