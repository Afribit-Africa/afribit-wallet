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
3. **Java + Android**: no separate JDK install needed if Android Studio is present. **`JAVA_HOME` must be set as a real persistent environment variable** (System Properties > Environment Variables, or `[Environment]::SetEnvironmentVariable('JAVA_HOME', 'C:\Program Files\Android\Android Studio\jbr', 'User')` in PowerShell) — without it, `gradlew.bat` fails with a confusing "is not recognized as an internal or external command" error that looks like a PATH/missing-file problem but is actually gradlew's own JAVA_HOME check failing. Setting it only for one terminal session (`$env:JAVA_HOME = ...`) is not enough; a process tree already running (including an IDE integrated terminal) won't see a registry change until that root process restarts. `ANDROID_HOME` should point at the SDK (default `%LOCALAPPDATA%\Android\Sdk`).
4. **Device**: enable USB debugging, plug in, confirm with `adb devices`.
5. **Environment variables** — repo root `.env.example` → `.env` (GitHub token, Bitika sandbox key later). In `apps/mobile`, `.env.local.example` → `.env.local` if you need non-default endpoints. Never commit real credentials.
6. **Run codegen** if the GraphQL schema has changed since the last pull.
7. **Run the app.** `yarn android` (react-native-community/cli-platform-android) has a real Windows bug in this repo as of RN 0.85.3/CLI: it fails with `'gradlew.bat' is not recognized as an internal or external command` even with `JAVA_HOME` set correctly and even from a native PowerShell session — the wrapper's own child-process spawn doesn't resolve the local `.bat` file the way running it directly does. Workaround, run each step directly instead of through the `yarn android` wrapper:
   1. `adb reverse tcp:8081 tcp:8081` (lets the USB-connected device reach Metro on the host)
   2. `yarn start` in `apps/mobile` (Metro, its own terminal/background process)
   3. From `apps/mobile/android`: `.\gradlew.bat app:installDebug -PreactNativeDevServerPort=8081` (with `JAVA_HOME` set in that session)
   4. Launch it on-device: `adb shell monkey -p com.galoyapp -c android.intent.category.LAUNCHER 1` (or tap the app icon)

   First gradle build downloads Gradle 8.13 + NDK 27.3 and takes a while.
8. **Run linting and formatting** (Prettier/ESLint) to confirm your environment matches what CI will expect.

## Sandbox credentials, not live ones

Everything through Phase 3 of the roadmap should run against sandbox environments only — Bitika's sandbox API, and whichever off-ramp provider's sandbox once that decision is made. Nobody should need live M-Pesa or real KES credentials to contribute at this stage.

## If something here is wrong

This document was written before the repo rebase was complete, from what's known about the prior fork and Blink's public setup. If a step doesn't match reality once you're actually in the repo, fix this file in the same PR — don't just work around it silently.