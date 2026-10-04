# Android wrapper and widget

## Ownership and sources

`capacitor/capacitor.config.ts` points the wrapper at `../.output/public`. `capacitor/package.json` declares Capacitor Android/core/CLI 8.5.0, Camera 8.2.4, and scripts for `sync` and `open`. The PWA remains the primary application.

Capture uses explicit camera/library sources via `app/utils/image-capture.client.ts`, bypassing WebView chooser fallback. The manifest queries `IMAGE_CAPTURE`; FileProvider exposes app-private `Pictures/` for temporary captures. No camera/storage permissions or gallery saving are enabled. Android ignores the rear-direction option and delegates lens selection to the system camera app.

Native sources under `capacitor/android/app/src/main/java/com/afshar/carservicetracker/`:

- `MainActivity.kt`: registers `CarWidget` and `MileageBackup` with Capacitor.
- `MileageBackupPlugin.kt`: atomically stores/reads the on-device history backup and opens the Android share sheet for JSON exports through the existing cache FileProvider.
- `CarWidgetPlugin.kt`: persists snapshots, returns widget status, and requests launcher pinning.
- `CarServiceWidgetProvider.kt`: renders the saved state with Android RemoteViews and opens the app when tapped.

Widget layout, backgrounds and provider metadata live under `capacitor/android/app/src/main/res/`; registration is in `capacitor/android/app/src/main/AndroidManifest.xml`.

## Bridge contract

`app/types/car-widget.ts` and `app/utils/car-widget.client.ts` define the web/native boundary. Calls require a native platform, the available `CarWidget` plugin, and Capacitor's `nativePromise` bridge.

- `update(state)`: optional estimated mileage and remaining-km numbers, required service status and update timestamp. Native code rounds numbers, saves the snapshot to private SharedPreferences, and refreshes widget instances.
- `getStatus()`: reports whether widgets are added and their count.
- `requestPin()`: reports pin support and whether the request was issued, not proof that the launcher/user completed placement.

`useCarData()` computes and pushes snapshots after load and each data/settings mutation. `index.vue` checks widget status on mount and when the document becomes visible. Web update failures are caught/logged; native availability gates the widget UI.

## Behavior and limitations

The widget shows estimated mileage plus service distance/status or setup guidance. It retains the last snapshot while closed/offline. It does not store reading history, reimplement mileage rules, or run periodic/background/network updates. Pin requests require Android 8+ and launcher support; tapping opens the main application.

## Build and release references

`docs/android-widget.md` documents Node 22+/pnpm, JDK 25, Gradle 9.1.0, SDK Platform 36, and Build-Tools 35.0.0. Android Studio is optional. Checked-in configuration uses min SDK 24, compile/target SDK 36, Java/Kotlin bytecode target 21, Android Gradle Plugin 8.13.0, and Kotlin 2.2.20. The wrapper properties still select Gradle 8.14.3; the current JDK 25 build uses global Gradle 9.1.0 directly. Do not describe the wrapper as already migrated.

Setup from the repository root:

```sh
pnpm install
pnpm --dir capacitor install --ignore-workspace
pnpm --dir capacitor sync
export ANDROID_HOME="$HOME/Android/Sdk"
gradle -p capacitor/android --no-daemon assembleDebug
```

`sync` first runs root static generation, then `cap sync android`; `open` optionally opens Android Studio. There is no separate package build script for the native APK. `app/utils/image-capture.client.ts` uses the Camera plugin via the native bridge for explicit camera/library selection; it only fetches same-origin `/_capacitor_file_/` URLs. Browser/PWA capture retains file inputs. See `ocr.md` for capture validation and `docs/android-widget.md` for native permission/FileProvider constraints. Inspect `.github/workflows/android-release.yml` before modifying release behavior.

The current workflow uses Node 22, pnpm 10, Temurin JDK 25 and Gradle 9.1.0, runs unit tests/typechecking, generates/syncs the web app, then runs `gradle --no-daemon assembleRelease` in `capacitor/android`. Build-Tools 35.0.0 align, sign, and verify the APK using repository secrets `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, and `ANDROID_KEY_PASSWORD`. Passwords are passed via environment references; the decoded keystore lives in a private runner temporary directory and is removed when the signing step exits. Only the verified signed APK and SHA-256 file are uploaded as workflow artifacts and assets on the triggering GitHub release. This produces an APK for direct distribution, not a Play Store AAB. See `docs/android-widget.md` for secret setup. Builds run only when a non-prerelease release targeting `main` is published; checkout builds the release tag's commit. Pushes and manual dispatch do not trigger builds. Concurrency is scoped to each release so different releases do not cancel each other. The checked-in wrapper still targets Gradle 8.14.3; CI selects Gradle 9.1.0 directly. Version codes are maintained in `capacitor/android/app/build.gradle`, not assigned by CI.

Do not repair wrapper files by regenerating the existing platform with `cap add android`. A wrapper properties file alone does not establish that wrapper scripts/JAR are available. Preserve Kotlin integration, resources and manifest entries during deliberate platform regeneration. Build outputs, caches, copied web assets and generated plugin files are ignored; native source and dependency lockfiles remain versioned. SDK XML and upstream Gradle deprecation warnings remain with current dependencies; a passing dry-run is not compilation or signature verification.

`pnpm release` runs `scripts/release.mjs`: an interactive Git/GitHub CLI helper
for stable GitHub.com releases from a clean, synchronized local `main`. After explicit
confirmation it bumps Android version name/code, commits only the Gradle version
file, tags that exact commit, atomically pushes `origin/main` and the new tag,
and publishes the GitHub release targeting `main` that triggers CI.
It does not handle signing secrets or publish automatically without confirmation.
Partial failures preserve the current state and report recovery steps rather
than rolling back remote changes. See `docs/android-widget.md` for the workflow.
The helper explicitly targets GitHub.com and pins pushes to the bump commit SHA;
ambient GitHub host/repository settings do not choose the publication destination.

Changes across TypeScript and Kotlin must preserve the snapshot contract and use the same service-status values. Native verification requires an Android build and device/emulator/launcher checks, not just Nuxt typechecking.
