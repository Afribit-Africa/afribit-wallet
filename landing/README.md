# Afribit Pay — Landing Page (v2)

Pre-launch marketing page for Afribit Pay. Next.js 15, Tailwind 4, anime.js 4.5
as the single scroll/text animation engine, Motion for state-driven transitions
inside the phone simulator only, Hyperspeed (React Bits) as the dark-mode hero
backdrop, KokonutUI attract-button on the CTA. Static output, no backend.

## Running it

Google Drive's filesystem breaks `npm install` (EBADF) and `.next` writes.
Work from a local copy:

```
robocopy "g:\My Drive\workspaces\Afribit-Pay\landing-page" %LOCALAPPDATA%\afribit-landing\app /E /XD node_modules .next
cd %LOCALAPPDATA%\afribit-landing\app
npm install
npm run dev
```

A working copy already exists at `%LOCALAPPDATA%\afribit-landing\app`.

**Note on source-of-truth**: this `landing/` folder in the main repo is a committed snapshot. Day-to-day editing happens in the Google Drive copy (`g:\My Drive\workspaces\Afribit-Pay\landing-page`) because that's what stays open across sessions; builds run from the local copy above because Drive's filesystem can't handle `npm install`/`.next`. Sync all three before relying on any one of them — see `docs/INFRASTRUCTURE.md` §9 in the main wallet repo for the full note on this.

## Deploying (live at pay.afribit.africa)

`next.config.ts` sets `output: "export"` — `npm run build` produces a plain
static `out/` folder (no Node server needed for the landing page itself).

The production domain `pay.afribit.africa` is already used by the
`afribit-daraja-callback` backend service (see the main wallet repo's
`docs/BLOCKERS.md` and `docs/INFRASTRUCTURE.md`). Rather than standing up a
second domain/tunnel, the landing page's static `out/` files are copied into
that service's `public/landing/` folder and served by its Express app via
`express.static`, mounted before the API router so it never shadows
`/health` or `/daraja/callback/*`.

To redeploy after a content change:
```
cd %LOCALAPPDATA%\afribit-landing\app
npm run build
robocopy %LOCALAPPDATA%\afribit-landing\app\out \\wsl.localhost\Ubuntu\home\primo\afribit-daraja-callback\public\landing /E /MIR
```
Then push `public/landing/` to the VM (`~/afribit-backend/services/daraja-callback/public/landing/`) and restart `afribit-daraja-callback.service`.
After a rebuild, restart `next start` fully: a running server keeps a stale
build manifest and serves 404 CSS.

## Animation system (one scroll engine)

Per the v2 brief, anime.js `onScroll`/ScrollObserver owns everything
scroll-linked; there is no second scroll engine on the page.

| Where | Technique |
|---|---|
| Hero + section titles | `splitText` chars, keyframed `animate()` drop-in with `outExpo` then `outBounce` settle, `stagger()` per char ([src/lib/anim.ts](src/lib/anim.ts) `splitIn`) |
| Section content | `unwind()`: every `[data-uw]` child rises 26px with `outExpo`, staggered 85ms, one direction and easing across the whole page |
| Wallet balance | `scrambleText` (digits only) on mount and after payment |
| Buttons, toggle, step rail | `waapi.animate()` for hover/press/spin, cheap and hardware accelerated |
| Phone screen changes | Motion `AnimatePresence`, state-driven only, never scroll |

`prefers-reduced-motion` disables all of it (content renders immediately).

## Theme system

System preference on arrival, toggle override stored in `localStorage`
(`ap-theme`), applied before first paint by an inline script. Semantic tokens
(`bg/fg/card/line/muted`) live in [globals.css](src/app/globals.css); a
`@custom-variant dark` keys Tailwind's `dark:` off `data-theme`. Dark is the
showcase mode: Hyperspeed light-trails render behind the hero, recolored to
brand (orange and copper cars on near-black road), lazy-loaded so light mode
never ships three.js, and skipped for reduced-motion users.

## The product tour (v3)

[ProductTour.tsx](src/components/ProductTour.tsx) is a pinned 3D stage: eight
wallet screens (home, scan, detected, confirm, settled, send, receive, buy)
zoom in from depth, hold centre stage while their micro-interactions play
(scanline sweep, hold-fill, QR pulse), then fly past the camera as the next
rises. Scroll position scrubs the whole sequence, so the visitor sets the
pace; below lg viewports or with reduced motion it degrades to a stacked
gallery. The scrub is hand-rolled scroll math (rAF + direct transforms), so
it cannot fight the anime.js ScrollObserver reveals.

## The interactive wallet

[PhoneSim.tsx](src/components/PhoneSim.tsx) is the product showcase: a coded
recreation of the real mockups in `../Mocks/screenshots`, tappable through
home → scan → detected → confirm → success, plus full Send (phone number or
Lightning address), Receive (QR + address) and Buy (KES keypad, M-Pesa STK
push sheet) flows. It uses the actual brand SVGs (fixing the approximated
"AP" branding in the PNG mockups), a deterministic pseudo-QR, a Lightning /
M-Pesa rail toggle, hold-to-pay, and a scrambling balance that tracks every
payment and purchase. Demo economics stay consistent with the mock's own
math: 100 sats = 1 KES.
The hero hosts a second live instance. The showcase step rail syncs both ways:
tapping the phone advances the rail, clicking a step jumps the phone.

## Known gaps, on purpose

- Confirm and success screens have no PNG source (blank exports in Mocks);
  they are designed in-system and labelled as such on the page.
- No photography exists in the repo; the Kibera frames stay labelled
  placeholders.
- Contact goes to eddie@afribit.africa (waitlist and partnership mailtos);
  Follow points at https://afribit.africa/. Footer carries both.
- higgsfield CLI is authenticated but image models need a paid plan
  (job_minimum_basic_plan_required), so no generated assets shipped.

## Component provenance

- `Hyperspeed.tsx` + presets: React Bits, installed via
  `shadcn add https://reactbits.dev/r/Hyperspeed-TS-TW.json` (MIT), recolored
  through its `effectOptions.colors` config.
- KokonutUI components were removed in v3 (the magnet button was off-brand);
  the CTA uses the in-house SettleButton (the settlement square drops in via
  waapi) and the phone's hold-to-pay is a brand-styled hold pattern.
