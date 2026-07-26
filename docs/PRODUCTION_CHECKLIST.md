# Afribit Pay — Production Readiness Checklist

Status: living document, created 2026-07-26. This is the gate before any real money moves through this app — mainnet Bitcoin, real M-Pesa payouts, or real user funds of any kind. Cross-reference `docs/BLOCKERS.md` for anything currently stuck, `docs/ROADMAP.md` for the phase sequencing this checklist assumes (nothing here happens before Phase 4), and **`docs/INFRASTRUCTURE.md`** for the full inventory of every service/host/software this app depends on and why — read that first if you're new to this project and need to understand what actually has to be stood up and paid for.

Check off items only when actually verified, not when "probably fine."

---

## 1. Compliance & legal (Phase 4 gate — nothing below matters until this is real)

- [ ] Formal legal opinion: does the off-ramp (M-Pesa payout) trigger VASP classification under Kenya's VASP Act
- [ ] Entity structure decided: off-ramp inside Afribit's existing entity, or a separate regulated entity
- [ ] Tiered KYC design appropriate to real transaction sizes (not just a UI mockup — actual verification flow, provider chosen, data retention policy)
- [ ] VASP registration filed and approved (if required)
- [ ] AML/CFT policy written and, if required, filed
- [ ] Terms of Service + Privacy Policy reviewed by counsel, published, versioned, and accepted in-app before any transaction
- [ ] Data protection compliance reviewed (Kenya Data Protection Act — this app handles phone numbers, transaction history, potentially KYC documents)

## 2. Backend infrastructure

(Full detail and rationale for everything below: `docs/INFRASTRUCTURE.md`.)

- [x] Production backend VM reachable and hardened (SSH key-only confirmed working end to end, sudo confirmed working — 2026-07-26, see Blocker 5)
- [x] Directory structure on the VM organized by service, not files dumped in root — `~/afribit-backend/{services,scripts,docs}/`, done 2026-07-26
- [x] Daraja callback receiver (`ResultURL`/`QueueTimeOutURL`) deployed, reachable over HTTPS at `pay.afribit.africa` via a Pinggy Pro tunnel, verified end-to-end against Safaricom's actual callback format — 2026-07-26
- [x] Both the callback service and its tunnel run as `systemd` services (`Restart=always`, boot-enabled) — survive both SSH disconnect and a VM reboot, 2026-07-26
- [ ] Callback receiver verifies request authenticity (Safaricom doesn't sign callbacks — confirm IP allowlisting or another mitigation is in place so this endpoint can't be spoofed to fake payout results)
- [ ] Idempotency confirmed end-to-end: a duplicate callback, a duplicate B2C/B2B submission, and a duplicate mobile-app retry all resolve to the same result, not a double-payout (the storage layer itself is upsert-idempotent on `OriginatorConversationID`, confirmed by test; full end-to-end retry behavior from the mobile app side not yet exercised)
- [ ] Backend logging/error tracking wired up (currently structured console logging only — no external log aggregation or error tracking service)
- [ ] Backend secrets (Daraja creds, Pinggy tokens, any DB credentials) stored properly — currently a plain `.env` on the VM (gitignored, not committed, not hardcoded) but not in a real secrets manager and not rotated
- [ ] Backup/restore process for whatever the backend persists (payout records, idempotency keys, callback history) — tested, not just assumed
- [ ] VM resource ceiling confirmed adequate under real load (currently Hyper-V dynamic memory, 512MB floor / 8GB ceiling — fine for early dev, needs a real load check before pilot volume)
- [ ] Monitoring/alerting for backend downtime — if the callback receiver *or* the Pinggy tunnel goes down, payouts silently stop resolving; nothing currently pages anyone
- [ ] Decide on a fallback plan for the Pinggy tunnel being a single point of failure for public reachability (no secondary path to the VM exists today — see `docs/INFRASTRUCTURE.md` §4)
- [ ] Push the `afribit-daraja-callback` repo to a real remote (GitHub/GitLab) — currently only exists on one dev machine and as a non-git tarball on the VM
- [ ] Automated deploy process with a record of what's currently live (a deploy log at minimum; see `docs/INFRASTRUCTURE.md`'s note on self-hosted deploy platforms) — currently a manual scripted `tar`+SSH deploy with no history

## 3. BTCPay / Lightning treasury

- [ ] Treasury Lightning node confirmed healthy and monitored (not just "worked once" — real uptime monitoring, since Blocker 1 already showed this node can silently die)
- [ ] Treasury has real inbound Lightning liquidity/channels sized to expected payout volume — a node with zero inbound capacity will accept connections but fail to receive
- [ ] Process defined for converting collected BTC (from users cashing out) back into KES to refill the M-Pesa float — this is a real, recurring operational task, not automatic
- [ ] Alerting on treasury balance thresholds (both BTC float and the Safaricom shortcode's KES balance)
- [ ] Decision made and documented on `pay.afribit.africa` vs `pay.bitcoin.co.ke` for the treasury address long-term (currently staying on `pay.bitcoin.co.ke` per explicit instruction — revisit before claiming this is final)

## 4. Daraja / M-Pesa production credentials

- [ ] Production Daraja app approved (separate from the sandbox app currently in use) — realistic timeline was estimated at 2-4 weeks from application per `docs/DARAJA_INTEGRATION.md`
- [ ] Real M-Pesa shortcode obtained and linked (sandbox uses `174379`; production needs Afribit's own)
- [ ] Production `InitiatorName`/`InitiatorPassword`/`SecurityCredential` obtained and stored the same secure way as sandbox (never hardcoded, never in a memory file, never committed)
- [ ] Production Daraja base URL confirmed and swapped in (currently `DARAJA_SANDBOX_BASE_URL`)
- [ ] Real end-to-end sandbox test performed for every `PayoutDestinationType` (PhoneNumber/PayBill/TillNumber) including decline/failure scenarios, not just the happy path — not yet done even in sandbox (blocked on Blocker 1)
- [ ] Rate limits and Safaricom's own uptime/maintenance windows understood and designed around

## 5. Bitika / on-ramp

- [ ] Production Bitika API key obtained (currently sandbox: `bk_test_...`)
- [ ] Bitika's actual sandbox limits and webhook confirmation flow exercised end-to-end with real API responses, including documented decline codes (`000001`/`000002`) — per `docs/ROADMAP.md`, this hasn't been done yet even in sandbox
- [ ] Bitika production terms/liability reviewed (who's responsible if a buy fails after M-Pesa charges the user but sats never arrive)

## 6. Mobile app / mainnet cutover

- [ ] `BREEZ_NETWORK` and `SPARK_TOKEN_IDENTIFIER` swapped from regtest to mainnet values, in a build-flavor or remote-config-driven way — NOT a hardcoded default flip (the current regtest pin exists specifically so this can't happen by accident; changing it needs to be deliberate and reversible)
- [ ] Production `BREEZ_API_KEY` obtained (current key is scoped for dev/regtest use)
- [ ] Production Firebase project (App Check, Crashlytics, Remote Config) separated from whatever dev project is in use, with a real (non-empty) App Check setup for both platforms
- [ ] Full send/receive/buy/off-ramp flow tested on real mainnet with small real amounts before any user-facing launch
- [ ] Store listing (Play Store / App Store) content, screenshots, and permissions justification prepared and reviewed
- [ ] Crash-free rate and performance baseline established on a real device matrix, not just the one dev test device used throughout this build

## 7. Security

- [ ] Dependency audit (`yarn audit` or equivalent) clean or explicitly triaged, not ignored
- [ ] No secrets in git history — confirm nothing sensitive ever got committed before `.env.local` conventions were established
- [ ] Self-custodial key storage reviewed (seed phrase handling, secure keystore usage) against current best practice, not just "it works"
- [ ] Backend callback endpoint security-reviewed specifically (this is the app's first public-facing backend surface, and it's a payment webhook — a natural target)
- [ ] Rate limiting on any new backend endpoints
- [ ] Incident response plan: who gets paged if the treasury node goes down again, if a payout duplicates, or if a security issue is reported

## 8. Testing & QA

- [ ] Full send-bitcoin-screen suite green (currently 114/114, 15 suites — keep this true as new work lands)
- [ ] Daraja + BTCPay suites green (currently 50/50 across 3 suites)
- [ ] General polish pass fully closed — Confirm/Paid screens and dark-mode Scan/Buy still pending (Blocker 10)
- [ ] Real device testing across light AND dark mode, at minimum on the primary test device plus one other form factor
- [ ] A defined, rehearsed rollback plan if a production release needs to be pulled

## 9. Pilot readiness (Phase 5, after everything above)

- [ ] Real KES float secured, sized to pilot volume specifically — not projected scale
- [ ] Defined small set of pilot merchants (Kibera, per `docs/ROADMAP.md`) onboarded with clear expectations set
- [ ] Reconciliation process in place and tested BEFORE the first real transaction, not after
- [ ] A way to collect real settlement-time and reliability data against the "almost instant" bar the product promises

---

## How to use this document

- Don't check an item off from a code review alone if it requires a real-world action (legal filing, credential rotation, a live test with real money) — note the date and who verified it.
- When `docs/BLOCKERS.md` resolves an item that unblocks something here, update both documents in the same pass.
- This checklist will grow — treat gaps found during implementation as new items, not silent scope cuts.
