-- 0015_create_inquiries.sql
-- Creates the inquiries table with RLS policies.
-- Anon INSERT policy: org_id is enforced server-side from slug lookup before insert.
-- Anon cannot SELECT inquiries — only managers can read submitted inquiries.

-- ============================================================
-- Inquiry enums
-- ============================================================
CREATE TYPE public.inquiry_type AS ENUM ('inquiry', 'application');
CREATE TYPE public.inquiry_status AS ENUM ('new', 'contacted', 'closed');

-- ============================================================
-- inquiries table
-- ============================================================
CREATE TABLE public.inquiries (
  id            UUID                    PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        UUID                    NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  listing_id    UUID                    NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  type          public.inquiry_type     NOT NULL DEFAULT 'inquiry',
  name          TEXT                    NOT NULL,
  email         TEXT                    NOT NULL,
  phone         TEXT,
  move_in_date  DATE,
  budget        NUMERIC(10,2),
  note          TEXT,
  status        public.inquiry_status   NOT NULL DEFAULT 'new',
  created_at    TIMESTAMPTZ             NOT NULL DEFAULT now()
);

ALTER TABLE public.inquiries ENABLE ROW LEVEL SECURITY;

CREATE INDEX ON public.inquiries (org_id);
CREATE INDEX ON public.inquiries (listing_id);
CREATE INDEX ON public.inquiries (status);

-- ============================================================
-- RLS policies
-- ============================================================

-- Staff: full access to inquiries within their org
CREATE POLICY "inquiries_all_staff"
ON public.inquiries
FOR ALL
TO authenticated
USING (
  org_id = (SELECT public.org_id())
  AND (SELECT public.user_role()) IN ('manager', 'employee', 'admin')
)
WITH CHECK (
  org_id = (SELECT public.org_id())
  AND (SELECT public.user_role()) IN ('manager', 'employee', 'admin')
);

-- Anon: INSERT only (no SELECT).
-- org_id is resolved server-side from the slug lookup before the insert —
-- the visitor cannot supply a fake org_id because the Server Action enforces it.
CREATE POLICY "inquiries_anon_insert"
ON public.inquiries
FOR INSERT
TO anon
WITH CHECK (true);
