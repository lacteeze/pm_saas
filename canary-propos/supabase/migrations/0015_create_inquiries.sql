-- 0015_create_inquiries.sql
-- Creates the inquiries table (Phase 3, D-09, D-10)
-- Covers both showing requests (type='inquiry') and application interest (type='application').

CREATE TYPE inquiry_type_enum AS ENUM ('inquiry', 'application');
CREATE TYPE inquiry_status_enum AS ENUM ('new', 'contacted', 'closed');

CREATE TABLE inquiries (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  listing_id    UUID NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  type          inquiry_type_enum NOT NULL,
  name          TEXT NOT NULL,
  email         TEXT NOT NULL,
  phone         TEXT,
  move_in_date  DATE,
  budget        NUMERIC(10, 2),   -- populated for type='inquiry' only
  note          TEXT,
  status        inquiry_status_enum NOT NULL DEFAULT 'new',
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE inquiries ENABLE ROW LEVEL SECURITY;

-- Managers in the org can read/update all inquiries for their org
CREATE POLICY "managers_full_access_inquiries"
  ON inquiries
  FOR ALL
  TO authenticated
  USING (org_id = org_id());

-- Anon users can INSERT new inquiries (form submissions — T-03-13: server action validates org_id)
CREATE POLICY "anon_insert_inquiries"
  ON inquiries
  FOR INSERT
  TO anon
  WITH CHECK (true);
