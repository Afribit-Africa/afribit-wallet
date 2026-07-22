# Afribit Pay — Environment Setup

Status: verified against this repo on 2026-07-22 (Windows 11 host, physical Android device). The mobile base in `apps/mobile` is current blink-mobile (see `apps/mobile/FORK.md` for the exact commit).

## Expected stack

Based on both the existing `AfriBit-wallet` fork and Blink's current core, expect:

- **React Native** for the mobile app
- **TypeScript** throughout
- **GraphQL** client against the wallet backend, with codegen — run codegen after pulling changes that touch queries or the schema
- Package management: **yarn 1.x** for `apps/mobile` (yarn.lock), npm for `landing/`
- Node **24+** (`apps/mobile` engines field requires >=24), React Native 0.85

## Suggested first-time setup

1. **Clone the repo.** On Windows, clone to a local NTFS path (not a Google Drive folder — npm and gradle fail on Drive's filesystem).
2. **Install dependencies**: `cd apps/mobile && yarn install`.
3. **Java + Android**: no separate JDK install needed if Android Studio is present — set `JAVA_HOME` to `C:\Program Files\Android\Android Studio\jbr` (OpenJDK 21). `ANDROID_HOME` should point at the SDK (default `%LOCALAPPDATA%\Android\Sdk`).
4. **Device**: enable USB debugging, plug in, confirm with `adb devices`.
5. **Environment variables** — repo root `.env.example` → `.env` (GitHub token, Bitika sandbox key later). In `apps/mobile`, `.env.local.example` → `.env.local` if you need non-default endpoints. Never commit real credentials.
6. **Run codegen** if the GraphQL schema has changed since the last pull.
7. **Run the app**: `yarn start` (Metro) in one terminal, `yarn android` in another. First gradle build downloads SDK components and takes a while.
8. **Run linting and formatting** (Prettier/ESLint) to confirm your environment matches what CI will expect.

## Sandbox credentials, not live ones

Everything through Phase 3 of the roadmap should run against sandbox environments only — Bitika's sandbox API, and whichever off-ramp provider's sandbox once that decision is made. Nobody should need live M-Pesa or real KES credentials to contribute at this stage.

## If something here is wrong

This document was written before the repo rebase was complete, from what's known about the prior fork and Blink's public setup. If a step doesn't match reality once you're actually in the repo, fix this file in the same PR — don't just work around it silently.