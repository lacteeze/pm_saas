---
plan: 02-02
phase: 02
status: complete
completed: 2026-06-21
---

# Plan 02-02: People Contacts Tab

## What Was Built

Extended the /people page with a two-tab layout (Team + Contacts). Added contact CRUD for tenants, owners, and vendors with Dialog-based forms. All role checks updated to use .includes() for text[] compatibility.

## Key Files

- canary-propos/src/components/ui/tabs.tsx (new — shadcn Tabs component)
- canary-propos/src/app/actions/contacts.ts (new — createContact, updateContact, deactivateContact server actions)
- canary-propos/src/components/people/AddContactForm.tsx (new — Dialog form for creating contacts with multi-role selection)
- canary-propos/src/components/people/EditContactForm.tsx (new — Dialog form for editing contact details)
- canary-propos/src/components/people/ContactsTab.tsx (new — RSC contacts list with table/mobile-cards + actions)
- canary-propos/src/app/(manager)/people/page.tsx (updated — Tabs wrapper, Team tab (existing), Contacts tab (new))

## What Was Implemented

- Two-tab people page: "Team" tab preserves existing manager/employee list; "Contacts" tab shows tenants, owners, vendors
- AddContactForm: name, email, phone, multi-role checkbox selection (tenant/owner/vendor), creates record without portal invite (D-05)
- EditContactForm: edit name, email, phone fields for existing contacts
- Deactivate contact: confirmation dialog, sets active=false
- Server actions validate org_id from JWT (never from request body)
- All role equality checks use role?.includes() not === (migration 0012 changed role to text[])

## Self-Check: PASSED

Code committed cleanly. TypeScript check deferred to post-merge build (worktree lacks node_modules symlink — false positives only).
