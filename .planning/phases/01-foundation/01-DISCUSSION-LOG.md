# Phase 1: Foundation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-19
**Phase:** 1-Foundation
**Areas discussed:** Onboarding flow, Sign-in experience, Invite & join UX, Session & device policy

---

## Onboarding Flow

| Option | Description | Selected |
|--------|-------------|----------|
| Guided setup wizard | Step-by-step: org name → logo → province → invite first manager → dashboard | ✓ |
| Empty dashboard + prompts | Land on dashboard with contextual 'Get started' cards | |
| You decide | Claude picks best approach | |

**User's choice:** Guided setup wizard
**Notes:** Org name and province are required; rest skippable. Canary goes through the same onboarding as any SaaS customer (no special seed bypass).

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — skip to dashboard anytime | Incomplete setup shows persistent banner | ✓ |
| Required for core fields only | Org name + province required; rest optional | (implied by above) |
| Fully required | Must complete all steps | |

**User's choice:** Required for core fields only (org name + province mandatory, rest optional with persistent banner reminder)

---

## Sign-in Experience

| Option | Description | Selected |
|--------|-------------|----------|
| One URL, role-based redirect | Single login page; JWT role determines redirect destination | ✓ |
| Separate sign-in URLs per portal | tenants./, owners./ etc | |
| Public site with sign-in button | Marketing at root, app at subdomain | |

**User's choice:** One URL, role-based redirect
**Notes:** Domain is canarypm.ca (not .com — user clarified they own the .ca). App at app.canarypm.ca.

| Option | Description | Selected |
|--------|-------------|----------|
| app.canarypm.com | Single app subdomain | |
| canarypm.com/app | Everything under one domain | |
| Decide later | Use localhost for now | |

**User's choice:** app.canarypm.ca (clarified domain ownership — .ca not .com)

| Option | Description | Selected |
|--------|-------------|----------|
| canarypm.ca/listings (Canary only) | Only Canary's listings; SaaS customers get subdomains in Phase 11 | ✓ |
| Each org gets listings page now | Multi-tenant listings from Phase 3 | |
| You decide | Claude picks | |

**User's choice:** canarypm.ca/listings (Canary only for now)

---

## Invite & Join UX

| Option | Description | Selected |
|--------|-------------|----------|
| Property + unit + move-in date + sign-up link | Context in email before clicking | ✓ |
| Just a sign-up link | Context shown after login | |
| You decide | Claude picks | |

**User's choice:** Property + unit + move-in date + sign-up link

| Option | Description | Selected |
|--------|-------------|----------|
| Land directly on their portal | Invite pre-configures everything | ✓ |
| Short welcome screen first | 10-second greeting then portal | |
| Profile setup first | Set password/name/photo before first use | |

**User's choice:** Land directly on their portal

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — pending/accepted status | 'Invite sent' vs 'Active' badge on person record | ✓ |
| No — just send and forget | No tracking | |

**User's choice:** Yes — pending/accepted status in people list

---

## Session & Device Policy

| Option | Description | Selected |
|--------|-------------|----------|
| 7 days with activity extension | Extends on each visit; expires after 7 days idle | ✓ |
| 24 hours always | Daily login required | |
| 30 days | Long-lived, minimal friction | |

**User's choice:** 7 days with activity extension

| Option | Description | Selected |
|--------|-------------|----------|
| Immediate revocation | Session invalidated server-side instantly | ✓ |
| Soft revocation on next request | JWT expires naturally (up to 1 hour) | |
| You decide | Claude picks | |

**User's choice:** Immediate revocation via Supabase Auth admin API

| Option | Description | Selected |
|--------|-------------|----------|
| No restrictions — unlimited devices | Standard SaaS behavior | ✓ |
| One active session only | New login invalidates previous | |
| You decide | Claude picks | |

**User's choice:** No restrictions — unlimited devices/tabs

---

## Claude's Discretion

- Error message copy for auth failures (invalid credentials, expired magic link, revoked session)
- Loading states during OAuth redirect flows
- Form validation approach on sign-up/invite forms

## Deferred Ideas

- SaaS customer public listings subdomains (e.g., acmerealty.canarypm.ca) — Phase 11
- Per-org custom domain support — post-v1
- SSO / SAML for enterprise PM companies — post-v1
