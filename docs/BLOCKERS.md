# Afribit Pay — Current Blockers

Status: living document, updated 2026-07-26. Each entry: what's blocked, why, who needs to act, and current status.

---

## 1. BTCPay treasury Lightning node is down

**Blocks**: all real Lightning-funding tests for the M-Pesa off-ramp (Send Money/Paybill/Till). Nobody can currently fund `afribitpay@pay.bitcoin.co.ke` — every real wallet fails, one surfaced a 504.

**Root cause** (confirmed via live diagnostic, not guessed): the BTCPay instance's LND node isn't reporting Lightning sync status at all (`/api/v1/server/info` only shows the on-chain entry). Invoice history shows the node *was* working at some point and stopped — consistent with a crashed/stopped LND container. The LNURL-pay callback (the step that actually issues an invoice) hangs indefinitely rather than erroring, which is exactly what a dead backend node looks like from BTCPay's HTTP gateway.

**Needs**: direct server access — `docker ps`/`docker logs`/restart the LND container, or check disk/OOM causes. Not fixable from the app or the Greenfield API (the API key correctly lacks node-internal permissions — that's normal, not a misconfiguration).

**Owner**: Eddie has escalated to the third-party host (2026-07-25). Nothing further to do until they respond.

---

## 2. No Daraja callback receiver (async B2C/B2B results) — BUILT, deployed, publicly reachable, fully wired

**Status**: RESOLVED (2026-07-26). Built as a standalone Node.js/TypeScript/Express service (separate local repo, `/home/primo/afribit-daraja-callback`), deployed to the backend VM at `~/afribit-backend/services/daraja-callback/`. Parses both B2C and B2B callback envelopes, persists to SQLite (`node:sqlite`, no native compilation), idempotent on `OriginatorConversationID`, always acks 200 fast. Also has a read endpoint, `GET /daraja/callback/status/:originatorConversationId` (200 with the stored record, or 404 if not arrived yet). 14/14 backend tests passing.

**Public reachability — via Pinggy Pro tunnel**, not the original `pay.afribit.africa` A-record/gateway plan (see Blocker 5 for why that path was abandoned). A persistent SSH tunnel (`ssh -p 443 -R0:localhost:8080 <access-token>@pro.pinggy.io`) runs detached on the VM. Confirmed fully working end-to-end (real callback POST → parsed → stored → 200, and a real status-lookup round trip) via the live custom domain `https://pay.afribit.africa` with a valid Let's Encrypt cert.

**Mobile app wired up end-to-end**: `daraja-payout-provider.ts`'s `resultUrl`/`queueTimeoutUrl` point at the real endpoints. `getPayoutStatus()` checks the local in-memory cache first, then falls back to querying `GET /daraja/callback/status/:id` directly (5s timeout, maps `isSuccess` → `fulfilled`/`failed`, 404 → `processing`, network/unexpected-status errors → graceful `processing` fallback, never throws). 50/50 mobile daraja tests passing, `tsc:check` clean (independently re-verified, not just delegate self-report).

**Known gap, by design**: the status-lookup response can't reconstruct `destination` (not part of Safaricom's callback payload) — returns `""` when served from the backend fallback path; only the local in-memory cache (populated by `executePayout` in the same app session) has it. Documented inline as a deliberate tradeoff, not a bug.

**Persistence**: both the Node service and the Pinggy tunnel now run as systemd system services (`afribit-daraja-callback.service`, `afribit-pinggy-tunnel.service`, installed at `/etc/systemd/system/`, `enabled` for boot, `Restart=always`). Survives both SSH disconnect and a full VM reboot. Re-verified live (`/health` + a real status lookup) through the systemd-managed processes, not just the ad-hoc `nohup` ones.

**Owner**: nobody — fully done, nothing outstanding on this item.

---

## 3. `DARAJA_CERTIFICATE_PEM` still not obtained

**Blocks**: nothing right now — `DARAJA_SECURITY_CREDENTIAL` (pre-computed) is confirmed working and takes priority over the cert+password local-encryption path. The cert is only needed if the pre-computed credential ever needs to be regenerated (e.g. if it expires, or a production credential is needed later).

**Owner**: Eddie, low priority, whenever convenient.

---

## 4. App Check debug token unset

**Blocks**: nothing fatal — the app proceeds anyway — but every dev/debug launch logs a real error (`FirebaseException: Error returned from API. code: 400 body: The debug_token cannot be empty.`) and repeated rapid relaunches during testing can trip Firebase's own abuse-prevention ("Too many attempts"), which briefly degrades to the "self-custodial features temporarily disabled" fallback until it clears.

**Needs**: generate a real Android debug token (run the app once, Firebase's debug provider logs a token to register), add it to the Firebase Console's App Check debug-token allowlist, then set `APP_CHECK_ANDROID_DEBUG_TOKEN` in `.env.local`.

**Owner**: whoever has Firebase Console access for this project (unconfirmed if that's Eddie or someone else).

---

## 5. Production backend VM — fully set up: access, sudo, public reachability all resolved

**Status**: RESOLVED (2026-07-26) — the real private key was found at `G:\My Drive\workspaces\servers\Novyrix\id_ed25519` (Eddie's initial paste was just the public half, which isn't usable for authentication on its own). SSH access confirmed working (`ssh afribit-backend`, config alias set up). Directory structure created at `~/afribit-backend/` (`services/`, `scripts/`, `docs/`, plus a README). Node.js 24.18.0 installed via nvm.

**Sudo**: initially blocked (no password set on the account at all). Yogi (server admin) set a temporary password, which triggered a forced-change flow that briefly locked out ALL SSH access (even key-based) until Eddie completed it interactively — that step couldn't be automated safely and correctly needed a human at a real terminal. Confirmed working now.

**Public reachability — the real saga**: this VM sits behind Envisioned Systems Research's own network gateway, which intercepts ALL external inbound traffic (tested directly with root access: nginx isn't even installed, yet external requests on both port 80 and 8080 get a generic placeholder response instead of reaching anything actually running on the box). Tried Cloudflare Tunnel next — the tunnel mechanism itself works, but routing a **custom domain** through it turned out to genuinely require full Cloudflare zone activation (nameserver delegation away from Bluehost), which Eddie can't do (Bluehost also serves the main site/mail for `afribit.africa`). **Landed on Pinggy Pro** instead — supports custom domains via a plain CNAME at the existing DNS provider (no nameserver move needed), confirmed working end-to-end. See Blocker 2 for the service-specific details.

**Owner**: nobody — this is done. Only remaining housekeeping is making the tunnel + service survive a VM reboot via systemd (easy now that sudo works, just not done yet).

---

## 6. On-chain-from-USD conversion not built

**Blocks**: nothing critical — the real bug (raw USD cents sent to the SDK as if satoshis for on-chain sends) is guarded against by hiding USD as a sender option specifically for on-chain payment types. Full conversion support (mirroring the Lightning path) is a deliberate future enhancement, not started.

**Owner**: unassigned, not currently prioritized.

---

## 7. M-Pesa logo asset still PDF-only

**Blocks**: cosmetic only — the M-Pesa tile grid uses placeholder icons instead of the real M-Pesa wordmark. Every automated PDF→SVG/PNG conversion attempt failed in this dev environment (missing system packages, no sudo, a WSL/Windows path bug in one tool).

**Needs**: someone exports an SVG/PNG from `Logo/Mpesa/M-PESA-logo-pdf.pdf` on a machine with proper design tooling (Illustrator, Inkscape, or an online converter).

**Owner**: unassigned, low priority.

---

## 8. No local recipient-history for M-Pesa confirmation text

**Blocks**: nothing — this was scoped out deliberately. Safaricom offers no phone/till-to-name lookup API we have access to (the one that exists, Mobile Number Validation, needs the recipient's National ID and is a separately-onboarded paid product). Current confirmation text is a clean echo of what the user typed, not a real identity lookup. A future enhancement could cache "you paid this number before" locally, but that's unbuilt.

**Owner**: unassigned, not prioritized.

---

## 9. Mainnet cutover — not started, gated deliberately

**Blocks**: the entire app is pinned to Regtest (Breez SDK) per the Phase 1 sandbox-only mandate. This is intentional, not a bug — real money moves only after Phase 4 (compliance/VASP registration) per `docs/ROADMAP.md`. Listed here as a reminder, not something to "fix."

**Owner**: Eddie — needs an explicit go-ahead before any mainnet work starts, and that go-ahead shouldn't happen before the Phase 4 compliance items are further along.

---

## 10. General polish pass — partially done, rest blocked

**Status**: Home, Scan, and Buy confirmed clean in light mode (2026-07-25/26). Confirm/Paid screens and dark-mode Scan/Buy not yet re-verified — reaching Confirm/Paid needs either real funds or a working Lightning path, both currently blocked behind Blocker 1.

**Owner**: us, once Blocker 1 clears (or once there's another way to reach those screens without live payments).
