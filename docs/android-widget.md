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

## Signed GitHub releases

Publishing a non-prerelease GitHub release targeting `main` triggers
`.github/workflows/android-release.yml`. It builds the release tag's commit
using Temurin JDK 25 and Gradle 9.1.0, runs tests/typechecking, generates and
syncs the web app, and builds an unsigned release APK. Android SDK Build-Tools
35.0.0 on the GitHub-hosted runner align, sign, and verify that APK before the
signed APK and SHA-256 checksum are uploaded to the published release.

Configure these repository secrets under **Settings → Secrets and variables →
Actions** before publishing a release:

| Secret | Value |
| --- | --- |
| `ANDROID_KEYSTORE_BASE64` | Base64-encoded contents of your existing release keystore |
| `ANDROID_KEYSTORE_PASSWORD` | Keystore password |
| `ANDROID_KEY_ALIAS` | Existing signing alias, e.g. `car-service-tracker` |
| `ANDROID_KEY_PASSWORD` | Password for that alias's private key; may match the keystore password |

With GitHub CLI authenticated to this repository, upload the existing keystore
without creating a plaintext copy inside the project:

```bash
base64 -w 0 "$HOME/.android-signing/car-service-tracker.jks" \
  | gh secret set ANDROID_KEYSTORE_BASE64
gh secret set ANDROID_KEYSTORE_PASSWORD
gh secret set ANDROID_KEY_ALIAS
gh secret set ANDROID_KEY_PASSWORD
```

The last three commands prompt for values. Base64 is encoding, not encryption;
treat the encoded keystore as a secret too. Never commit the keystore or its
passwords. Use the same signing key as your locally installed release APK so
GitHub-built releases can update it. Increase Android `versionCode` in
`capacitor/android/app/build.gradle` for subsequent releases; the workflow does
not assign version codes automatically.

The workflow fails if a secret is missing or signing/verification fails. The
decoded keystore is created with private permissions in the runner's temporary
directory and removed when the signing step exits, including on failure. Only
the verified signed APK and its checksum are uploaded, never the unsigned APK
or keystore. A differently signed debug installation cannot be updated by this
release APK; uninstalling it normally deletes its local app data.
