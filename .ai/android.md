# Android wrapper and widget

## Ownership and sources

`capacitor/capacitor.config.ts` points the wrapper at `../.output/public`. `capacitor/package.json` declares Capacitor Android/core/CLI 8.5.0 and scripts for `sync` and `open`. The PWA remains the primary application.

Native sources under `capacitor/android/app/src/main/java/com/afshar/carservicetracker/`:

- `MainActivity.kt`: registers `CarWidget` with Capacitor.
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

`docs/android-widget.md` documents Node/pnpm, Android Studio, JDK 21 and SDK 36 prerequisites. Checked-in configuration uses min SDK 24, compile/target SDK 36, Gradle 8.14.3, Android Gradle Plugin 8.13.0, and Kotlin 2.2.20.

Setup from the repository root:

```sh
pnpm install
pnpm --dir capacitor install
pnpm --dir capacitor sync
pnpm --dir capacitor open
```

`sync` first runs root static generation, then `cap sync android`; `open` opens Android Studio. There is no separate package build script for the native APK. Inspect `.github/workflows/android-release.yml` before modifying release behavior.

The current workflow uses Node 22, pnpm 10 and JDK 21, runs unit tests/typechecking, generates/syncs the web app, then runs `gradle --no-daemon assembleDebug` in `capacitor/android`. It publishes a debug APK and SHA-256 file as workflow artifacts and a GitHub prerelease, not a production-signed store release. Automatic runs are limited to named feature/fix branches and app/native/workflow path changes; manual dispatch is also available. Do not assume every push triggers an Android build.

The setup guide includes platform regeneration advice for missing wrapper/assets. Inspect the actual missing files before regeneration and preserve Kotlin integration, resources and manifest entries. A wrapper properties file alone does not establish that wrapper scripts/JAR are available.

Changes across TypeScript and Kotlin must preserve the snapshot contract and use the same service-status values. Native verification requires an Android build and device/emulator/launcher checks, not just Nuxt typechecking.
