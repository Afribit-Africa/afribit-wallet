# Afribit Pay — Environment Setup

Status: verified against this repo on 2026-07-23. The mobile base in `apps/mobile` is current blink-mobile (see `apps/mobile/FORK.md` for the exact commit).

## Expected stack

- **React Native** for the mobile app
- **TypeScript** throughout
- **GraphQL** client against the wallet backend, with codegen — run codegen after pulling changes that touch queries or the schema
- Package management: **yarn 1.x** for `apps/mobile` (yarn.lock), npm for `landing/`
- Node **24+** (`apps/mobile` engines field requires >=24), React Native 0.85

## On Windows: use WSL2, not Windows-native

A native-Windows setup was tried first and hit six distinct, genuine bugs before ever reaching a stable dev loop: a yarn-classic bug where package postinstall scripts silently fail on Windows (breaks both the top-level `patch-package`/`jetify` step *and*, much more subtly, the Breez SDK's own native-binary download — the latter fails silently mid-`yarn install` and only surfaces ~15 minutes into a Gradle build as a missing `.so` file), `JAVA_HOME` needing to be a real persistent env var, a real Windows bug in `react-native-community/cli-platform-android` where `gradlew.bat` fails to invoke at all, Windows' 260-character path limit compounded by this Breez SDK package's CMake setup (which mirrors its whole absolute path a second time inside the build tree), an EMFILE crash from Metro's default worker count exceeding Windows' file-handle ceiling, and — worst of all — a *silent* Metro/jest-worker deadlock that froze overnight with zero error output. Every one of these is Windows-only; none exist on Linux, which is what this whole toolchain is actually built and tested against.

**Use WSL2 (Ubuntu) instead.** It resolved every one of the above on the first real attempt (Gradle build succeeded clean in ~11 minutes; `yarn install`'s postinstall scripts, including the Breez SDK's, "just worked" with zero manual intervention).

### WSL2 setup

Most of this needs no admin/sudo rights at all — everything installs into `$HOME`.

1. **WSL2 + Ubuntu**: `wsl --install` if not already present (this one step does need admin). Start it with `wsl -d Ubuntu`.
2. **Node 24 + yarn** via nvm (no sudo):
   ```bash
   curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
   source ~/.bashrc   # or open a new shell
   nvm install 24 && nvm alias default 24
   npm install -g yarn
   ```
3. **JDK 21** via a Temurin tarball (no sudo — apt's JDK works too if you have sudo):
   ```bash
   mkdir -p ~/opt && cd ~/opt
   curl -fL -o jdk21.tar.gz "https://api.adoptium.net/v3/binary/latest/21/ga/linux/x64/jdk/hotspot/normal/eclipse?project=jdk"
   tar xzf jdk21.tar.gz && rm jdk21.tar.gz && mv jdk-21* jdk-21
   ```
   Add to `~/.bashrc`: `export JAVA_HOME="$HOME/opt/jdk-21"` and put `$JAVA_HOME/bin` on `PATH`.
4. **Android SDK** via `sdkmanager` (no sudo):
   ```bash
   mkdir -p ~/Android/Sdk/cmdline-tools
   curl -fL -o /tmp/cmdline-tools.zip "https://dl.google.com/android/repository/commandlinetools-linux-13114758_latest.zip"
   python3 -c "import zipfile; zipfile.ZipFile('/tmp/cmdline-tools.zip').extractall('/tmp')"
   mv /tmp/cmdline-tools ~/Android/Sdk/cmdline-tools/latest
   chmod +x ~/Android/Sdk/cmdline-tools/latest/bin/*   # Python's zipfile drops the exec bit — must fix manually
   export ANDROID_HOME="$HOME/Android/Sdk"
   yes | ~/Android/Sdk/cmdline-tools/latest/bin/sdkmanager --licenses
   ~/Android/Sdk/cmdline-tools/latest/bin/sdkmanager "platform-tools" "platforms;android-35" "build-tools;35.0.0" "ndk;27.3.13750724" "cmake;3.22.1"
   ```
5. **build-essential + unzip** (this one does need `sudo`, run once): `sudo apt update && sudo apt install -y build-essential unzip`.
6. **Clone the repo natively into WSL2's own filesystem** — `~/afribit-wallet`, *not* `/mnt/c/...`. Accessing Windows-hosted files from WSL2 is slow and behaves oddly for large trees; native ext4 is fast and correct.
   ```bash
   git clone https://github.com/Afribit-Africa/afribit-wallet.git ~/afribit-wallet
   cd ~/afribit-wallet/apps/mobile && yarn install
   ```
7. **Fix WSL2's networking so the device can reach Metro.** By default, WSL2's automatic port relay (`wslrelay.exe`) only bridges **IPv6**, not IPv4 — and Android/`adb reverse` both resolve `localhost` to IPv4, so the device silently can't reach Metro even though a Windows-side `curl http://localhost:8081` works fine (it prefers IPv6). Add to `%USERPROFILE%\.wslconfig` on the **Windows** side (not inside WSL):
   ```ini
   [wsl2]
   memory=10GB
   processors=8
   swap=4GB
   networkingMode=mirrored
   ```
   Then `wsl --shutdown` and start Ubuntu again. Verify from PowerShell: `Test-NetConnection -ComputerName 127.0.0.1 -Port 8081` must show `True` once Metro is running. Adjust `memory=`/`swap=` to your machine — the NDK build is memory-hungry and can genuinely OOM-kill the Gradle JVM on a low-RAM host (check `dmesg | grep -i oom` if a build dies with no Gradle-formatted error at all).
8. **Environment variables** — repo root `.env.example` → `.env`. In `apps/mobile`, `.env.local.example` → both `.env.local` *and* `.env` (react-native-config's Gradle plugin reads a literal `.env`, not `.env.local`).
9. **The device connection**: Windows still owns the physical USB connection natively — no USB passthrough (usbipd) needed. From WSL2, just call the Windows `adb.exe` directly via interop: `/mnt/c/Users/<you>/AppData/Local/Android/Sdk/platform-tools/adb.exe`. **Critical gotcha**: if you invoke `adb.exe` inside a script piped into `bash -s`, it silently swallows the rest of that script as its own stdin — every line after it just never runs, with no error. Always append `< /dev/null` to every `adb.exe` call in such a script.
10. **Build and run**, from `apps/mobile/android`:
    ```bash
    /mnt/c/.../adb.exe reverse tcp:8081 tcp:8081 < /dev/null
    cd ~/afribit-wallet/apps/mobile && yarn start &      # Metro
    cd android && ./gradlew app:assembleDebug -PreactNativeArchitectures=arm64-v8a   # match your device's actual ABI
    /mnt/c/.../adb.exe install app/build/outputs/apk/debug/app-arm64-v8a-debug.apk < /dev/null
    /mnt/c/.../adb.exe shell am start -n com.galoyapp/.MainActivity < /dev/null
    ```
    Restrict `-PreactNativeArchitectures` to your device's real ABI (check with `adb shell getprop ro.product.cpu.abi`) — building all 4 ABIs is slower and uses much more memory for no benefit on a single physical device.

## If you're on native Windows anyway

1. Clone to a local NTFS path, not a Google Drive folder (npm/gradle fail on Drive's filesystem), and keep the path short — Windows' 260-char limit is real and some dependencies (the Breez SDK spark bindings, at least) generate very deep paths.
2. `JAVA_HOME` must be a real *persistent* environment variable (`[Environment]::SetEnvironmentVariable('JAVA_HOME', '<path>', 'User')`), not just `$env:JAVA_HOME` in one session — and note a process tree already running (including an IDE terminal) won't see a registry change until it restarts.
3. `yarn install`'s postinstall scripts (including third-party packages' own, like the Breez SDK's binary fetcher) can silently fail on Windows regardless of yarn's `script-shell` config — if a native module's `.so`/binary is unexpectedly missing later, `cd` into that package and run its postinstall script directly via `bash`.
4. `yarn android` / `react-native run-android` has a real bug invoking `gradlew.bat` on Windows. Run Metro (`yarn start`) and `.\gradlew.bat app:installDebug -PreactNativeDevServerPort=8081` directly instead of through the wrapper.
5. If a native build fails with "Filename longer than 260 characters" or a bare `ninja: error: mkdir(...)` even after enabling `LongPathsEnabled` in the registry, the bundled `ninja.exe` under `$ANDROID_HOME/cmake/<version>/bin/` may predate Windows long-path support — replace it with a modern build from github.com/ninja-build/ninja/releases (same CLI, drop-in binary swap).
6. If Metro throws `EMFILE: too many open files` partway through a large bundle, set `maxWorkers` low (or 1) in `metro.config.js` — but know that even the disk cache itself (`cacheStores`, default `os.tmpdir()/metro-cache`) can hit the same wall; disabling it (`cacheStores: []`) trades cold-start speed for eliminating the failure mode.

## Sandbox credentials, not live ones

Everything through Phase 3 of the roadmap should run against sandbox environments only — Bitika's sandbox API, and whichever off-ramp provider's sandbox once that decision is made. Nobody should need live M-Pesa or real KES credentials to contribute at this stage.

## If something here is wrong

Fix this file in the same PR — don't just work around it silently.
