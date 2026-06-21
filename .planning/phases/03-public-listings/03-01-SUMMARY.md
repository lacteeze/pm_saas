---
plan: 03-01
phase: 03
status: complete
completed: 2026-06-21
---

# Plan 03-01: Schema Migrations + DB Push

## What Was Built

Two Supabase migrations adding the listings and inquiries tables, pushed to production with all RLS policies verified.

## Migrations Applied

| Migration | What It Creates |
|-----------|----------------|
| 0014_create_listings.sql | listings table (unit_id FK unique, org_id, listing_title, listing_description, highlights text[], display_rent, listing_status enum draft/published/unlisted, available_from, timestamps, RLS: managers full CRUD + anon SELECT published-only) |
| 0015_create_inquiries.sql | inquiries table (listing_id FK, org_id, inquiry_type enum inquiry/application, name, email, phone, move_in_date, budget, note, inquiry_status enum new/contacted/closed, created_at, RLS: managers SELECT/UPDATE + anon INSERT only) |

## Verification

- supabase db push: both migrations applied with no errors
- supabase gen types: src/types/supabase.ts updated with Tables['listings'] and Tables['inquiries']
- check-rls.ts: PASS — all public tables have Row Level Security enabled

## Self-Check: PASSED
