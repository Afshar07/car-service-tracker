# Android wrapper and home-screen widget

The PWA remains the main application. The Android project in `capacitor/` packages the statically generated Nuxt output and adds one native widget.

## Data flow

`useCarData` remains the only write path. After loading, adding, editing, deleting, or changing service settings, it calls the existing TypeScript mileage estimation and service-summary functions. The resulting small snapshot is passed to the native `CarWidget` Capacitor plugin:

- estimated mileage
- remaining kilometers
- service status
- update timestamp

Android stores the snapshot in private `SharedPreferences` and refreshes all widget instances. The widget therefore keeps the last known state while the app is closed or offline. Android does not duplicate the application's mileage or service calculations.

## Setup and build

Requirements: Node/pnpm, Android Studio, JDK 21, and Android SDK 36.

```bash
pnpm install
pnpm --dir capacitor install
pnpm --dir capacitor sync
pnpm --dir capacitor open
```

The sync command first runs Nuxt static generation and then copies `.output/public` into the Android app.

The checked-in Android source intentionally contains the native integration. If Gradle wrapper or launcher assets are missing in a fresh checkout, run this once from `capacitor/`:

```bash
pnpm exec cap add android
```

Preserve the Kotlin widget files, manifest entries, and widget resources if regenerating the platform.

## Widget behavior

- Tapping anywhere opens the application's main screen.
- Every record/service mutation refreshes the saved snapshot.
- Android 8+ launchers that support pinning can show a pin prompt through the in-app **Add widget** action.
- The widget has no periodic network or background work.
