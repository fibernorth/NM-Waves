# NM Waves — Release Readiness Audit & Monday Plan

_Audit date: 2026-07-03. Method: 6-dimension parallel code audit (purpose, frontend, backend/payments, security, UX, build/release) with an adversarial verification pass on every critical/high finding. 71 findings total; severities below are post-verification._

---

## 1. What this app actually is

A **full club-operations platform** for the Waves travel softball club — far more complete than its own docs claim. Four surfaces:

1. **Public marketing site** — home, about, rosters, schedule, photo gallery, sponsors, contact, tryout registration, privacy/terms.
2. **Member portal** (role-adaptive nav) — parents get "My Players", linked-child profiles, invoices and online payment; coaches add teams, players, schedules, equipment, volunteers, documents, media, player metrics; admins add the full finance suite + 501(c)(3) compliance.
3. **Sponsor portal** — sponsor role can fund players and view payment history.
4. **Tokenized Stripe payment flow** (`/pay/:token`) backed by Cloud Functions (checkout, webhook, invoice tokens, receipt emails).

**Roles (6, stored as an array):** visitor, parent, coach, admin, master-admin, sponsor.

**What's genuinely built and production-hardened:** the money spine (Stripe → invoice tokens/QR → double-entry general ledger → nonprofit reports: trial balance, balance sheet, cash flow, functional-expense 990 allocation, budget-vs-actual, aged AR/AP, fixed assets/depreciation, year-end close), tournament workflow, roster/team management, and media (with AI moderation + OCR). `tsc --noEmit` passes clean. There are **zero "coming soon" stubs** — every one of ~55 routed pages is a real implementation.

**The docs are actively misleading** — README/PROJECT_STATUS/IMPLEMENTATION_SUMMARY describe an old "90% scaffold" with 8 unbuilt features that are, in fact, all shipped. Ignore the docs; grade from code.

---

## Remediation status (updated this session)

Fixes landed on `claude/nm-waves-live-repo-ojckav` (all build/type-check clean).
Rules changes require `firebase deploy --only firestore:rules,storage` and the
functions changes require `firebase deploy --only functions` to take effect.

**Done:**
- P0-1 `functions.config()` → env vars (`functions/.env`), template added. Deploy blocker cleared.
- P0-2 Checkout amount bound to the invoice token's finance record; token marked "used" only when the payment actually satisfies the invoice.
- P0-3 `/players` no longer anonymously readable; public rosters served via `getPublicRoster` callable (safe fields only).
- P0-4 Coach self-signup removed (UI + Firestore users-create rule forces `parent`).
- P0-5 `invoiceTokens` no longer publicly listable; public pay page uses `getInvoiceByToken` callable; parents read only their children's.
- P0-7 Sponsor blanket finance read removed; sponsor pay flow uses `getPlayerFinanceSummary` callable (minimal summary).
- P0-8 / P0-9 Both hooks-order crashes fixed. P0-10 ErrorBoundary added. ESLint config added (was missing).
- P0-11 Parent onboarding save routed through `updateLinkedPlayerContact` callable.
- P0-12 Parent dashboard/nav dead buttons removed; `Stats` restricted to coach+.
- Build predeploy hooks added; committed `functions/lib` re-synced with source.

**Still open (must decide before launch):**
- **P0-6 Storage `documents/**` role-gating** — needs Firebase Auth **custom claims** (storage rules can't read Firestore roles). This is a deploy-side change (a user→claims sync trigger + a one-time backfill) that must be integration-tested; not safe to land blind. Interim mitigation: closing coach self-signup means only admin-provisioned accounts hold privileged roles, and only authenticated users can reach the bucket at all.
- **Deploy the rules and functions** — the fixes above are inert until deployed.
- **Finer-grained `/players` read scoping** (authed users can still read all player docs) and **link-any-player** hardening were intentionally deferred: they require reworking the child-link flow and integration testing, which isn't safe to rush pre-launch. Tracked as the top fast-follow.
- P1 money-path items (refund `pi_`/`cs_` linkage, webhook 500-on-error, transactional idempotency, invite-token expiry) — not yet started.

## 2. Verdict

**Not safe to launch to parents on Monday as-is — but reachable.** Two things stand between here and a safe Monday:

- **A hard deploy blocker:** all Cloud Functions read secrets via `functions.config()`, an API Google **shut down at the end of 2025**. `firebase deploy --only functions` will fail or deploy with all secrets undefined (emails silently stop, Stripe webhook can't verify). Nothing ships until this is migrated.
- **Live exposures & guaranteed crashes** (see §3). Several security findings are not hypothetical pre-launch risks — this repo shows every sign of already being **live in production** (54 ad-hoc balance-fix scripts against real player data), which means **minors' medical notes, DOB, and emergency contacts are world-readable right now.**

The P0 list below is roughly **1.5–2 focused days**. A Monday launch is realistic if P0 is done and verified over the weekend.

---

## 3. Release blockers (P0 — must fix before Monday)

Deduplicated across dimensions; each was independently verified.

| # | Issue | Where | Why it blocks | Fix effort |
|---|-------|-------|---------------|-----------|
| P0-1 | **`functions.config()` is EOL** — functions won't deploy; SMTP & Drive secrets have no env fallback so all email silently stops | `stripe.ts:9,177`, `emails.ts:8,37`, `googleDrive.ts:39`, `accountSetup.ts:8`, `sendInvites.ts:8` | Deploy blocker + silent email failure | **M** (~½ day, 7 call sites → `defineSecret`/`.env`, redeploy, retest webhook) |
| P0-2 | **Checkout amount is client-controlled; token marked paid regardless of amount** — anyone can pay $0.50 against a $1,500 invoice and it's marked paid; token isn't tied to the financeId | `functions/src/stripe.ts:36-84,571-590` | Direct revenue loss / broken invoices | **S–M** |
| P0-3 | **Minors' PII world-readable** — `/players` has `allow read: if true`; docs include medicalNotes, DOB, emergency contacts | `firestore.rules:57` | Live child-safety/privacy exposure | **M** (lock read + sanitized public roster source) |
| P0-4 | **Anyone can self-assign the Coach role at signup** — unlocks roster write + all-player PII; rules only block `admin`/`master-admin` | `SignupPage.tsx:139-143`, `authStore.ts:130-153`, `firestore.rules:79` | Privilege escalation | **S** (remove from dropdown + rule forces `['parent']`) |
| P0-5 | **`invoiceTokens` collection publicly listable** — leaks every child's name, fee breakdown, scholarship amount, and the secret pay token | `firestore.rules:256-261` | Financial/PII leak + payment-token theft | **M** (callable get-by-token; deny list) |
| P0-6 | **Org documents in Storage readable/writable by any authed user** (open signup makes "authed" trivial) | `storage.rules:25-28` | Data exposure + arbitrary upload | **S** |
| P0-7 | **Sponsor role can read every player's finances** (no per-player scoping) | `firestore.rules:183-186` | Financial over-share | **M** |
| P0-8 | **Guaranteed hooks-order crash: ParentInvoicesPage** — white-screens for every parent with a child (the pay-my-invoice page) | `ParentInvoicesPage.tsx:168,177` | Core parent flow dead | **S** (reorder hooks above early returns) |
| P0-9 | **Guaranteed hooks-order crash: Billing → Payment History** — white-screens the admin's payment-recording screen | `BillingPage PaymentHistoryDialog:896-903` | Core admin flow dead | **S** |
| P0-10 | **No ErrorBoundary anywhere** — any render error unmounts the whole app to a permanent white screen | `App.tsx` / `main.tsx` | Turns any bug into a total outage | **S** (~40-line wrapper) |
| P0-11 | **Parent onboarding "Save & Continue" always fails** — parents can't write to `/players`; onboarding popup never clears | `ParentOnboardingDialog.tsx:139-157`, `firestore.rules:56` | Every new parent's first action errors | **M** (callable fn or field-scoped rule) |
| P0-12 | **Parent dashboard dead buttons + Stats tab errors for parents** — Quick Actions/stat cards route to coach-only pages that silently bounce; "Stats" nav always errors for parents | `DashboardPage.tsx:202,209,476,520-528`; `Sidebar.tsx:101`, `App.tsx:201` | "Nothing works" week-one support flood | **S** (role-gate nav/actions) |

---

## 4. Should-fix before real money/email flows (P1 — same weekend if time allows)

| Issue | Where | Effort |
|-------|-------|--------|
| Refund webhook can never find the original payment (`payment_intent` `pi_` vs stored Checkout Session `cs_` id) — dashboard refunds never post to the books | `stripe.ts:627-656` | M |
| Webhook returns **HTTP 200 on processing errors** — a transient Firestore blip permanently loses a paid transaction (no retry, no dead-letter) | `stripe.ts:613-619,767-771` | S |
| Webhook idempotency is **non-transactional** and absent when the finance doc is missing → duplicate income/GL on retry (gets worse once #above returns 500) | `stripe.ts:232-242,373-388,430-534` | M |
| Non-atomic payment writes (`getDoc`→push→`updateDoc`); cascade-delete matches income by amount and can delete the wrong record; GL/income failures only `console.error` | `src/lib/api/finances.ts addPayment/removePayment` | M |
| Invite tokens **never expire and stay valid after activation** → account takeover from an old invite email | `accountSetup.ts:66-108`, `emails.ts:297` | S |
| `syncToBilling` re-includes quit players and re-charges them, undoing `redistributeAfterQuit` | `src/lib/api/costCalculation.ts:45-223` | M |
| Sign-in sets a global `loading` flag that unmounts the app mid-submit → failed logins clear the form, never show the inline error | `authStore.ts:106`, `App.tsx:142`, `LoginPage.tsx` | S |
| Any parent can link **any** player with zero verification → sees another family's balance/payments | `LinkChildDialog.tsx:39-84`, `users.ts:147-153` | M–L |
| Webhook signature verification has an **unsigned fallback path** (runs with no webhook secret) | `stripe.ts:177-214` | S |
| Currency stored/summed as floating-point dollars; processing fee hardcoded (never reversed on refund); refunded payments still count toward `totalPaid` | `stripe.ts`, finance calcs | M |

---

## 5. Fast-follow (P2 — after launch)

- **Zero tests / zero CI** on an app that moves real money — add vitest smoke tests for the money paths (webhook amount math, GL balance invariant) + a GitHub Actions `tsc`+`build`+`lint` gate. (Ongoing; smoke subset = M.)
- **`npm run lint` is broken** — no ESLint config exists, so the rules-of-hooks crashes above shipped undetected. Add `.eslintrc`. (S — do this early; it surfaces P0-8/9.)
- **No predeploy hooks** in `firebase.json` — deploys ship whatever stale `dist/` / `functions/lib/` is on disk. Add build predeploys. (M)
- `strict-ssl=false` committed in `.npmrc` (disables TLS for every install); Stripe returnUrl allowlist permits `localhost` in prod; `.env.example` ships `http://localhost`. (M)
- **Branding decision:** repo/docs say "NM Waves / Northern Michigan"; the entire shipped UI says "TC Waves / Traverse City." Pick one before public launch. (Also fix the hardcoded donation-receipt EIN/city noted in the ops analysis.) (M)
- Rewrite/retire the 6 stale docs (they even instruct enabling Firestore "Test mode"). (M)
- No pagination anywhere in the Firestore layer (full `players` fetch on every dashboard load); single 2.5 MB JS bundle, no code splitting. (M each)
- Orphaned public pages (`/staff`, `/parent-resources`, `/pricing`); tryout-applicants have no admin read UI. (S–M)
- 54 operational scripts with real player names + `firebase-admin` committed to the frontend repo. (Cleanup/relocate.)

---

## 6. Capability gaps to "fully run the club" (beyond bugs)

The money/tournament/roster/media spine is built. The **people-facing loops** are the real product gaps (each has a July stopgap):

1. **No communication fan-out** — announcements are in-app only; no email/SMS blast. #1 operational need mid-season. _Stopgap: TeamSnap/BAND/GroupMe._
2. **No RSVP/attendance.** _Stopgap: TeamSnap availability or a Google Form._
3. **Scheduling friction** — no recurring events, no cancellation state, one-time `.ics` only (no calendar subscribe). _Stopgap: shared Google Calendar per team._
4. **No payment plans/autopay** — Stripe is one-time only. _Stopgap: partial-payment honor system + aged-AR chasing (both already work)._
5. **Registration/tryout pipeline dead-ends** — public form writes to Firestore but no admin view and no applicant→player conversion; no season-registration-with-waiver-and-fee flow. _Stopgap: Firebase console + manual player create (last year's pattern)._
6. **501(c)(3) leaks:** fundraiser and cash donations bypass income/GL (understated contribution revenue); donation receipts are print-only and never emailed, with a **hardcoded wrong EIN/city.** _Stopgap: double-enter in Income; hand-email receipts after fixing the org info._
7. **Operator dependence on developer scripts** for routine ops (balance fixes, invoice rebuilds, bank/stats import). A non-technical treasurer can't run this alone yet.

---

## 7. Recommended weekend sequence

1. **Sat AM:** Add ESLint config (surfaces the hooks bugs) → fix P0-8, P0-9, P0-10 (crashes + ErrorBoundary). Add predeploy hooks.
2. **Sat PM:** Lock down `firestore.rules` + `storage.rules` (P0-3, P0-5, P0-6, P0-7) and the signup role hole (P0-4, P0-11 rule/callable). Deploy rules first — these are **live exposures today.**
3. **Sun AM:** Migrate `functions.config()` → `defineSecret`/`.env` (P0-1); redeploy functions; end-to-end test the Stripe webhook in live mode.
4. **Sun PM:** Fix checkout amount validation (P0-2) and parent dashboard role-gating (P0-12). Retest a full parent journey: sign up → link child → view invoice → pay → receipt.
5. **Buffer:** Pick off P1 money-path items (refund linkage, webhook 500-on-error + transactional idempotency) as time allows — or gate them behind "record payments manually until patched."

If P0 slips, the honest fallback is a **soft launch**: rules + crashes + deploy fix are non-negotiable, but you can delay opening self-serve online payment (keep admins recording payments) until P0-2 and the P1 webhook items are done.
