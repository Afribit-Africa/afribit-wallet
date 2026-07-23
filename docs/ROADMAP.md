# Afribit Pay — Roadmap
Status: Draft v1 · Living document, update as phases complete or shift

This roadmap is sequenced deliberately: nothing that touches real money happens before the compliance and liquidity groundwork is in place, but almost everything else can and should happen in parallel rather than waiting in a queue.

## Phase 0 — Foundation (current)
- [x] Brand identity direction (name, color, typography)
- [ ] Phase 1 vector logo, constructed properly (in progress)
- [ ] Landing page v1 and v2 animation pass (in progress)
- [x] Core docs: README, PRD, Roadmap, Contributing, Setup (this batch)
- [x] Repo restructured into the layout described in README.md

## Phase 1 — Wallet core
- [x] Rebase `AfriBit-wallet` fork onto current Blink 3.0 / Spark-based core
- [x] Confirm non-custodial account flow works end to end (recovery phrase, self-custody, unilateral exit path)
- [x] Basic send/receive Lightning working in the rebased app
- [ ] Afribit Pay branding and theming (light/dark, system-default) applied throughout — Home/Send/Receive/Scan done; Settings and the new Buy screen still pending

## Phase 2 — On-ramp
- [x] Integrate Bitika sandbox API (2026-07-23)
- [x] Buy flow: M-Pesa amount → STK push → sats delivered to user's own wallet
- [ ] Test against Bitika's sandbox limits and webhook confirmations before any live-money work — code path is in place (polls `/api/v1/transactions/code/{code}`); an actual end-to-end sandbox run with real API responses (incl. the `000001`/`000002` decline scenarios) hasn't been exercised on-device yet

## Phase 3 — Off-ramp foundation (sandbox only)
- [ ] KE-QR parsing: recognize till, paybill, and send-money QR formats — v1 done (2026-07-23): generic EMVCo/Safaricom KE-QR detection + "Detected automatically" sheet on the Scan screen; does not yet distinguish till vs. paybill vs. send-money sub-types
- [x] Lightning invoice/address recognition in the same scan flow (already existed, now shown via the same detected-sheet UI as KE-QR)
- [ ] Payout engine: rate quoting, sats debit, idempotency — built and tested entirely in sandbox — not started; scanning a KE-QR today shows an honest "coming soon" state instead
- [ ] Resolve Splice Africa vs. IntaSend vs. direct Daraja, based on direct conversations, not assumptions
- [ ] Confirm the Splice/Tando ownership question before treating Splice as a settled vendor choice

## Phase 4 — Compliance and structure
- [ ] Formal legal read: VASP classification for the off-ramp specifically
- [ ] Decide entity structure: does the off-ramp sit inside Afribit's existing entity or a separate one
- [ ] Design tiered KYC appropriate to real transaction sizes
- [ ] Begin VASP registration process once regulations are finalized

## Phase 5 — Pilot
- [ ] Secure a small, real KES float sized to pilot volume, not projected scale
- [ ] Go live with a defined small set of Kibera merchants
- [ ] Reconciliation and monitoring in place before the first real transaction, not after
- [ ] Collect real settlement-time and reliability data against the "almost instant" bar

## Phase 6 — Public launch
- [ ] Broader merchant onboarding based on pilot learnings
- [ ] Revisit brand book, marketing push, and merchandise — deliberately deferred until here
- [ ] Open contribution process fully active, with a real backlog of good-first-issues for outside contributors

## Explicitly not sequenced yet
Full 25-section brand book, merchandise, motion/marketing assets beyond the landing page, and any sub-brand ecosystem (Afribit Merchant, POS, etc.) — these come after Phase 5, once there's a live product to build them around.