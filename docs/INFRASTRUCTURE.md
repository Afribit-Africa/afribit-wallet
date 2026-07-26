# Afribit Pay — Infrastructure & Software Inventory

Status: living document, created 2026-07-26. This is the answer to "what does it actually take to run this thing" — every service, host, and piece of software Afribit Pay depends on today, why it was chosen, who operates it, and what's still a gap before this can be handed to a stranger to stand up or scale to real public launch. Cross-reference `docs/PRODUCTION_CHECKLIST.md` (the gate before real money moves) and `docs/BLOCKERS.md` (what's currently stuck).

Keep this current: when a service is added, swapped, or dropped, update this file in the same change.

---

## 1. Mobile app (the product itself)

| Piece | What / version | Why |
|---|---|---|
| Base | Fork of [blinkbitcoin/blink-mobile](https://github.com/blinkbitcoin/blink-mobile) at commit `3d69cfbf8f28...` (MIT) | Mature, audited, open-source Bitcoin/Lightning wallet UI and plumbing — building this from scratch would mean re-solving problems Blink already solved. See `apps/mobile/FORK.md`. |
| Framework | React Native 0.85.3, React 19.2.3, TypeScript | Matches the Blink base; single codebase for Android + iOS. |
| Wallet engine | `@breeztech/breez-sdk-spark-react-native` (Breez SDK, Spark implementation) | Provides the actual self-custodial Lightning node-in-app. **This is why there is no self-hosted Galoy/GraphQL backend** — despite Blink's original architecture expecting one, Afribit Pay's self-custodial flow talks directly to Lightning infrastructure via this SDK. The only backend Afribit Pay itself operates is the small Daraja callback receiver (§2). |
| Crash/analytics | `@react-native-firebase/{app,app-check,crashlytics,messaging,remote-config,analytics}` | Standard, free-tier-capable mobile observability; App Check specifically guards backend calls from non-genuine app instances. |
| Country detection fallback | ipinfo.io → proxycheck.io → geo.ipify.org → ipapi.co (in priority order, each optional via API key) | Used only when a user has no phone number on file; free tiers are enough at this stage, each has a key-optional free tier so the chain degrades gracefully rather than hard-failing. |
| Package manager | Yarn 1.x (`apps/mobile`) | Matches the upstream Blink fork's tooling. |
| Dev environment | WSL2 (Ubuntu) on Windows, or native Linux/Mac | Native Windows hits 6 distinct real bugs (see `docs/SETUP.md`) — not a preference, a requirement. |

## 2. Backend — Daraja callback receiver

The **only** backend service Afribit Pay operates itself. Everything else (wallet ledger, Lightning node, GraphQL) lives inside the user's own phone via the Breez SDK (§1) — this service exists purely because Safaricom's M-Pesa payout APIs are asynchronous and need somewhere to receive the result.

| Piece | What | Why |
|---|---|---|
| Repo | `afribit-daraja-callback` — **separate git repo**, not part of this monorepo, currently only on the dev machine (`/home/primo/afribit-daraja-callback` in WSL) and deployed (as a tarball, no `.git`) to the VM | Kept separate because it's an independently deployable service with its own lifecycle, not mobile-app code. **Gap: no remote (GitHub/GitLab) configured yet — the only copies right now are one dev machine and the VM. If either is lost, so is the history.** |
| Runtime | Node.js 24.18.0 (via nvm) | Matches the mobile app's own Node version requirement; nvm avoids needing sudo just to get a modern Node. |
| Framework | Express | Minimal, well-understood, sufficient for ~4 routes — no need for anything heavier. |
| Storage | `node:sqlite` (Node's built-in `DatabaseSync`), not `better-sqlite3` | `better-sqlite3` needs native compilation (`node-gyp`/`make`), which needed sudo the VM didn't have at the time. Node 24's built-in SQLite avoids that entirely. Revisit if/when concurrent-write volume outgrows SQLite. |
| Static assets | `public/landing/` — the marketing landing page's static export (§4), served via `express.static` | `pay.afribit.africa` is shared between the API and the landing page (see §4) rather than provisioning a second domain/tunnel. |
| What it does | Receives Safaricom's B2C/B2B `ResultURL`/`QueueTimeOutURL` callbacks, persists by `OriginatorConversationID` (idempotent upsert), exposes a read endpoint so the mobile app can poll status | Safaricom's payout APIs ack immediately and deliver the real result later via webhook — without this, the app has no way to know if a payout actually succeeded. |
| Tests | Vitest, 14/14 passing | |

## 3. Backend hosting — the VM

| Piece | What | Why |
|---|---|---|
| Host | Envisioned Systems Research ("Novyrix") | Eddie's existing hosting relationship; first VM provisioned for Afribit Pay 2026-07-26. |
| Spec | Ubuntu 24.04 LTS, hostname `afribit1`, user `eddie` (sudo). Hyper-V Dynamic Memory: idles ~512MB-900MB, hot-adds to an 8GB ceiling under load. ~88GB disk free. | Fine for the current footprint (one small Node service + static files). **Not yet load-tested — see Production Checklist §2.** |
| Access | SSH key-only (`ssh afribit-backend` alias), sudo via a real password (see `~/.ssh/config` comment, never in git/memory) | Standard hardening; password-based sudo was a one-time PAM flow Eddie completed personally after the account's temp-password expired. |
| Process management | **systemd** — `afribit-daraja-callback.service` and `afribit-pinggy-tunnel.service`, both `enabled` (survive reboot) and `Restart=always` | Replaced an earlier `setsid`+`nohup` approach that survived SSH disconnect but not a reboot. Standard, no extra software needed — the VM already runs systemd. |
| Layout | `~/afribit-backend/{services,scripts,docs}/` — one directory per deployable service, not flat files in root | Eddie's explicit instruction from day one, to keep this scalable past a single service. |
| Deploy method | `tar` of the working tree (excluding `node_modules`/`.git`/`dist`) piped over SSH, then `npm install && npm run build` on the VM, then `systemctl restart` | No CI/CD pipeline yet — this is a manual, scripted deploy. **Gap: no automated deploy, no deploy history/rollback tracking** — see §6 open questions and the "self-hosted Vercel" discussion below. |

## 4. Public reachability — Pinggy Pro tunnel

| Piece | What | Why |
|---|---|---|
| Problem it solves | The VM sits behind Envisioned Systems Research's own network gateway, which intercepts **all** external inbound traffic regardless of port (confirmed directly with root access — nothing reaches the box from outside no matter what's listening). Not fixable from inside the VM. | |
| Why not Cloudflare Tunnel | Cloudflare Tunnel's free/quick tunnels work standalone, but routing a **custom domain** through a **named** tunnel requires the domain's DNS zone to be fully active on Cloudflare (nameservers delegated away from the current registrar). Eddie can't move `afribit.africa`'s nameservers off Bluehost — Bluehost also serves the main site and email for that domain. A plain CNAME at Bluehost pointing at Cloudflare's tunnel hostname does **not** work without that zone activation (confirmed: the hostname doesn't even resolve without it). | |
| Chosen solution | **Pinggy Pro** (pinggy.io) — `ssh -p 443 -R0:localhost:8080 <access-token>@pro.pinggy.io`, run persistently under systemd | Supports a custom domain via a **plain CNAME at the existing DNS provider** (target like `xxxxx.a.pinggy.link`) — no nameserver move needed. Pinggy issues its own Let's Encrypt cert once the CNAME validates. This is the only option evaluated that satisfies the "can't touch Bluehost's nameservers" constraint. |
| Cost/plan | Eddie has a **Pinggy Pro** subscription (paid) — exact pricing/limits not tracked in this doc; check the Pinggy dashboard. | |
| Credentials | Two distinct credential types exist (easy to confuse): a REST/dashboard "API key" and a separate tunnel "Access Token" (used as the SSH username). Both stored only in `~/afribit-backend/services/daraja-callback/.env` on the VM (gitignored) — never in this repo or memory. | |
| **Known risk — single point of failure** | The tunnel is one SSH connection to one third-party service. If Pinggy has an outage, changes its custom-domain behavior, or the subscription lapses, `pay.afribit.africa` goes dark with no automatic fallback. There is currently no secondary path to the VM. | **This is the single biggest open risk in "make it available for everyone" — worth a deliberate decision before real public launch, not just accepted by default.** |

## 5. DNS — `afribit.africa`

| Piece | What | Why |
|---|---|---|
| Registrar/DNS host | Bluehost | Pre-existing — also serves `afribit.africa`'s main site and email, which is exactly why nameservers can't move to Cloudflare (see §4). |
| Current records relevant here | `pay.afribit.africa` → CNAME → Pinggy's assigned hostname (no A record on that subdomain — can't have both) | |
| Known caveat | DNS changes here can take hours to propagate through resolvers that cached the previous record, even after the authoritative record is correct — **this already happened once** (an old A record cached widely, causing real "site won't load" reports from both Eddie and this session, even though the authoritative record and the server itself were both already correct). Not fixable, just needs awareness when cutting over DNS in the future — keep TTLs low ahead of a planned change. | |

## 6. Treasury — Lightning liquidity

| Piece | What | Why |
|---|---|---|
| Node | A **third-party-hosted** BTCPay Server instance at `pay.bitcoin.co.ke` (`afribitpay@pay.bitcoin.co.ke` LNURL address) | Not operated by Afribit — an existing relationship, used as the treasury's Lightning liquidity source. |
| **Known risk** | This node has already gone down once with no monitoring catching it (Blocker 1) — Eddie had to escalate manually to the third-party host. No uptime monitoring or alerting exists on Afribit's side for this dependency. | A treasury outage silently breaks every Lightning-funded off-ramp transaction. |
| Open decision | Whether to stay on `pay.bitcoin.co.ke` long-term or move to Afribit's own `pay.afribit.africa` address is explicitly undecided — see Production Checklist §3. | |

## 7. On-ramp — buying Bitcoin with M-Pesa

| Piece | What | Why |
|---|---|---|
| Provider | Bitika (`bitikaserver.up.railway.app`) | Chosen after evaluating alternatives; provides M-Pesa STK push → sats delivery. Currently sandbox credentials only (`bk_test_...`). |
| Status | Integrated and working in sandbox (2026-07-23); full sandbox limit/decline-code testing (`000001`/`000002`) not yet exercised end-to-end. | |

## 8. Off-ramp — spending Bitcoin via M-Pesa

| Piece | What | Why |
|---|---|---|
| Provider | Safaricom Daraja API, direct (not via an aggregator) | Decided 2026-07-24 after comparing Splice Africa, IntaSend, and direct Daraja — direct integration chosen. See `docs/DARAJA_INTEGRATION.md`. |
| Status | Sandbox only. Production Daraja app application takes an estimated 2-4 weeks once filed. | |
| Callback path | Handled by the service in §2, publicly reachable via §4. | |

## 9. Landing / marketing page

| Piece | What | Why |
|---|---|---|
| Stack | Next.js 15, Tailwind 4, anime.js (scroll/text animation), Motion (state-driven transitions), Three.js/Hyperspeed (dark-mode hero) | Static marketing page — no backend logic of its own (confirmed: no API routes, middleware, or server actions in the source). |
| Build mode | `output: "export"` — plain static HTML/CSS/JS, no Node server required to serve it | Deliberately chosen over running `next start` as a live process: nothing on the page needs server-side rendering, so a static export is strictly faster and avoids running a second always-on Node process on an already resource-constrained VM. |
| Source locations | Edited at `g:\My Drive\workspaces\Afribit-Pay\landing-page` (Google Drive breaks `npm install`/`.next` — see `docs/gdrive-npm-workaround` in project memory); built from a local working copy at `%LOCALAPPDATA%\afribit-landing\app`; a version-controlled snapshot also lives in this monorepo at `landing/` | **Three locations for one project is a known wrinkle** — the Drive copy is where editing happens, the local copy is where building happens (Drive's filesystem can't handle it), and `landing/` in this repo is the last committed snapshot. Keep these in sync manually when deploying; don't assume `landing/` reflects the latest edit. |
| Deployed to | `public/landing/` inside the Daraja callback service (§2), served at `pay.afribit.africa/` via `express.static`, sharing the domain/tunnel/VM with the API | Avoided standing up a second domain, Pinggy custom-domain link, and cert-issuance wait for what is, functionally, just static files. |

## 10. Development tooling (not shipped — how this gets built, not what runs in production)

| Piece | What | Why |
|---|---|---|
| Delegate coding agents | "Nova" (backend) and "Atlas" (UI) — persistent `opencode` sessions running `deepseek-v4-pro`, orchestrated/verified by Claude via `git diff` review | Splits implementation work from review/verification; every delegated change is independently rebuilt and re-tested, not trusted on the delegate's self-report alone. See project memory `named-delegate-agents`. |
| CI | None yet | No automated test/build/deploy pipeline exists for either the mobile app or the backend service — everything above is run manually. |

---

## Open questions before "ship it for everyone"

These aren't blockers today (pre-launch, sandbox-only), but they're real gaps between "works for us" and "works for the public" — distinct from the compliance/legal gate in `docs/PRODUCTION_CHECKLIST.md` §1:

1. **Single point of failure on the tunnel** (§4) — no fallback if Pinggy has an outage or the subscription lapses.
2. **No deploy history or rollback mechanism** for the backend service — a deploy is "run a script and hope," with no record of what's currently live versus what was live an hour ago. See the "lightweight deploy log" idea discussed below rather than a full self-hosted PaaS.
3. **No monitoring/alerting** on the backend service, the tunnel, or the treasury node (§6) — all three currently fail silently until someone happens to test manually.
4. **No secrets manager** — credentials live in a plain `.env` on the VM (gitignored, not committed, but not rotated/managed either).
5. **No off-machine backup** for the `afribit-daraja-callback` repo (§2) — dev machine and VM only.
6. **VM resource ceiling untested under real load** — fine for development traffic, not yet verified for pilot-scale concurrent users.
7. **Landing page has three source locations** (§9) — fine solo, will need a single source of truth before anyone else touches it.

## On self-hosting a "Vercel" for deploy tracking

Discussed 2026-07-26: a full self-hosted PaaS (Coolify, CapRover, etc.) was considered and deliberately **not** adopted yet — those platforms are Docker-based and carry real memory overhead for their own management layer, which is disproportionate for a VM currently running two lightweight services. If deploy visibility becomes a real pain point, a simple append-only deploy log (git commit hash + timestamp + who, written on every deploy) gets most of the practical value at near-zero cost. Revisit a full platform once there are enough services to justify the overhead.
