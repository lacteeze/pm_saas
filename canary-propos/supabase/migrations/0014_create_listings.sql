-- 0014_create_listings.sql
-- Creates the listings table with RLS policies.
-- RLS pattern: helper functions from 0003_rls_helpers.sql (org_id(), user_role())
-- Anon policy: allow SELECT of published listings only (public listing pages)

-- ============================================================
-- Listing status enum
-- ============================================================
CREATE TYPE public.listing_status AS ENUM ('draft', 'published', 'unlisted');

-- ============================================================
-- listings table
-- ============================================================
CREATE TABLE public.listings (
  id                   UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id               UUID          NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  unit_id              UUID          NOT NULL REFERENCES public.units(id) ON DELETE CASCADE,
  listing_title        TEXT          NOT NULL,
  listing_description  TEXT,
  highlights           TEXT[]        DEFAULT '{}',
  display_rent         NUMERIC(10,2),
  status               public.listing_status NOT NULL DEFAULT 'draft',
  available_from       DATE,
  created_at           TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ   NOT NULL DEFAULT now(),
  UNIQUE (unit_id)
);

ALTER TABLE public.listings ENABLE ROW LEVEL SECURITY;

CREATE INDEX ON public.listings (org_id);
CREATE INDEX ON public.listings (unit_id);
CREATE INDEX ON public.listings (status);

-- ============================================================
-- updated_at trigger
-- ============================================================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER listings_set_updated_at
  BEFORE UPDATE ON public.listings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- RLS policies
-- ============================================================

-- Staff (manager, employee, admin): full access within their org
CREATE POLICY "listings_select_staff"
ON public.listings
FOR SELECT
TO authenticated
USING (
  org_id = (SELECT public.org_id())
  AND (SELECT public.user_role()) IN ('manager', 'employee', 'admin')
);

CREATE POLICY "listings_insert_manager"
ON public.listings
FOR INSERT
TO authenticated
WITH CHECK (
  org_id = (SELECT public.org_id())
  AND (SELECT public.user_role()) IN ('manager', 'admin')
);

CREATE POLICY "listings_update_manager"
ON public.listings
FOR UPDATE
TO authenticated
USING (
  org_id = (SELECT public.org_id())
  AND (SELECT public.user_role()) IN ('manager', 'admin')
)
WITH CHECK (
  org_id = (SELECT public.org_id())
  AND (SELECT public.user_role()) IN ('manager', 'admin')
);

CREATE POLICY "listings_delete_manager"
ON public.listings
FOR DELETE
TO authenticated
USING (
  org_id = (SELECT public.org_id())
  AND (SELECT public.user_role()) IN ('manager', 'admin')
);

-- Anon: SELECT published listings only (public listing pages — no auth required)
CREATE POLICY "listings_anon_select_published"
ON public.listings
FOR SELECT
TO anon
USING (status = 'published');
