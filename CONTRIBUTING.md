# Contributing to Afribit Pay

We build in the open and welcome help. A few ground rules keep it sane.

## Where things live

- `apps/mobile` — the wallet (React Native, forked from Blink; see FORK.md)
- `landing/` — the marketing site (Next.js)
- `brand/` — logo source and brand assets; regenerate, do not redraw
- `docs/` — PRD, roadmap, setup; fix docs in the same PR that changes reality

## Working on the wallet

Read `docs/SETUP.md` first. Sandbox credentials only through Phase 3 of the
roadmap: nobody needs live M-Pesa or real KES credentials to contribute.
Never commit `.env` or any real key. If a secret ever lands in git history,
rotate it immediately, do not just delete the file.

## Pull requests

- Small and focused beats large and heroic.
- If a step in the docs did not match reality, update the doc in the same PR.
- Screens and flows should match the brand system in `brand/` (colors,
  Manrope, the settlement-square motif). When in doubt, look at `landing/`.

## Security

Do not open public issues for security problems. Email
eddie@afribit.africa with details and we will respond as fast as we can.
