-- 0014_create_listings.sql
-- Creates the listings table (Phase 3, D-01, D-02, D-03)
-- A listing is created by a manager to market a unit publicly.
-- One listing per unit (unique constraint on unit_id).

CREATE TYPE listing_status_enum AS ENUM ('draft', 'published', 'unlisted');

CREATE TABLE listings (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  unit_id         UUID NOT NULL REFERENCES units(id) ON DELETE CASCADE,
  listing_title   TEXT NOT NULL,
  listing_description TEXT,
  highlights      TEXT[],
  display_rent    NUMERIC(10, 2),        -- overrides unit.asking_rent for public display
  status          listing_status_enum NOT NULL DEFAULT 'draft',
  available_from  DATE,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT listings_unit_id_unique UNIQUE (unit_id)
);

-- RLS
ALTER TABLE listings ENABLE ROW LEVEL SECURITY;

-- Managers in the org can read/write all listings for their org
CREATE POLICY "managers_full_access_listings"
  ON listings
  FOR ALL
  TO authenticated
  USING (org_id = org_id())
  WITH CHECK (org_id = org_id());

-- Anon users can SELECT published listings only
CREATE POLICY "public_read_published_listings"
  ON listings
  FOR SELECT
  TO anon
  USING (status = 'published');

-- Updated_at trigger
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER listings_updated_at
  BEFORE UPDATE ON listings
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
