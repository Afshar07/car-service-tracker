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

Requirements: Node.js 22+, pnpm, JDK 25, Gradle 9.1.0, Android SDK Platform
36, and Build-Tools 35.0.0. Android Studio is optional; Android CLI can manage
SDK packages. Gradle runs on JDK 25 while Java/Kotlin bytecode targets remain 21.

```bash
pnpm install
pnpm --dir capacitor install --ignore-workspace
pnpm --dir capacitor sync
```

The sync command first runs Nuxt static generation and then copies `.output/public` into the Android app.

The standalone install flag prevents the parent workspace from skipping the
wrapper's dependencies. To sync plugins against existing `.output/public`
without regenerating the web app, run `pnpm --dir capacitor exec cap sync android`.
To use Android Studio, run `pnpm --dir capacitor open` after synchronization.

The wrapper pins the official `@capacitor/camera` plugin to `8.2.4` (compatible
with Capacitor `8.5.0`) for system camera capture and the Android photo picker.
With `saveToGallery: false`, no camera or storage permissions are declared.
The manifest exposes `IMAGE_CAPTURE` to package queries, and the FileProvider
shares only app-private camera files under `Pictures/` in addition to its cache.
Android's `getPhoto` implementation ignores `direction: 'REAR'`; the system
camera app controls the selected lens. Images remain on-device.

For a CLI-only build, select JDK 25 and Gradle 9.1.0 in your shell, then run
from the repository root:

```bash
export ANDROID_HOME="$HOME/Android/Sdk"
android --sdk="$ANDROID_HOME" sdk install platform-tools platforms/android-36 build-tools/35.0.0
gradle -p capacitor/android --no-daemon assembleDebug
```

The debug APK is at
`capacitor/android/app/build/outputs/apk/debug/app-debug.apk`. Build outputs,
Gradle/Kotlin caches, copied web assets, and generated Capacitor plugin files
are ignored by Git; native Kotlin/resources and dependency lockfiles are not.
`capacitor/android/capacitor.settings.gradle` is already tracked even though
sync regenerates it; review and commit its plugin-project changes when adding
native dependencies.

The checked-in wrapper properties still select Gradle 8.14.3, and a wrapper
properties file alone does not supply `gradlew` or the wrapper JAR. Use the
selected global `gradle` for the JDK 25 flow above. Do not run `cap add android`
over the existing platform to repair wrapper files: this project already has
custom native integration. Preserve Kotlin sources, resources, and manifest
entries if deliberate platform regeneration is ever needed.

SDK XML parser and upstream Gradle deprecation warnings can still appear with
the current AGP 8.13.0/Kotlin 2.2.20 tooling. They are not proof of build failure
and have not been suppressed. Assess the actual failure separately.

### Local signed release APK

Create a signing key once outside the repository and retain it for every update:

```bash
mkdir -p "$HOME/.android-signing"
chmod 700 "$HOME/.android-signing"
keytool -genkeypair -v \
  -keystore "$HOME/.android-signing/car-service-tracker.jks" \
  -storetype JKS -alias car-service-tracker \
  -keyalg RSA -keysize 2048 -sigalg SHA256withRSA -validity 10000
```

Do not regenerate an existing key. Back up the keystore securely off-machine
and store its passwords in a password manager. Then build, align, sign, and verify:

```bash
pnpm --dir capacitor sync
export ANDROID_HOME="$HOME/Android/Sdk"
gradle -p capacitor/android --no-daemon assembleRelease
TOOLS="$ANDROID_HOME/build-tools/35.0.0"
APK_DIR="capacitor/android/app/build/outputs/apk/release"
"$TOOLS/zipalign" -P 16 -f 4 \
  "$APK_DIR/app-release-unsigned.apk" "$APK_DIR/app-release-aligned.apk"
"$TOOLS/apksigner" sign \
  --ks "$HOME/.android-signing/car-service-tracker.jks" \
  --ks-key-alias car-service-tracker \
  --out "$APK_DIR/car-service-tracker-release.apk" \
  "$APK_DIR/app-release-aligned.apk"
"$TOOLS/apksigner" verify --verbose "$APK_DIR/car-service-tracker-release.apk"
android install --apks="$APK_DIR/car-service-tracker-release.apk"
```

Passwords are entered at the signing prompt, not stored in Gradle. Do not modify
an APK after signing. `pnpm release` below automates versioning/publication for
GitHub builds; this local sequence does not bump versions or publish anything.

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
GitHub-built releases can update it. The interactive release helper below
updates Android's version fields; the CI workflow itself does not assign them.

The workflow fails if a secret is missing or signing/verification fails. The
decoded keystore is created with private permissions in the runner's temporary
directory and removed when the signing step exits, including on failure. Only
the verified signed APK and its checksum are uploaded, never the unsigned APK
or keystore. A differently signed debug installation cannot be updated by this
release APK; uninstalling it normally deletes its local app data.

### Interactive release helper

Install GitHub CLI (`gh`) and sign in to GitHub.com with `gh auth login`.
The helper accepts GitHub.com HTTPS/SSH `origin` URLs, not GitHub Enterprise hosts.
Configure the four signing secrets above once. Your Git/GitHub credentials must allow pushing to
`main`, creating tags, and publishing releases. This helper does not bypass
branch protection; if direct pushes to `main` require a pull request, use the
manual release flow after merging the version bump instead.
Commit and push/merge your changes into `main`,
then run from a clean, fully synchronized local `main` checkout:

```bash
pnpm release
```

The helper prompts for a patch, minor, major, or custom stable version, increments
Android `versionCode`, and shows the exact publication plan. Nothing is edited,
committed, pushed, or published until you type the requested confirmation. It
then updates only `versionName` and `versionCode` in
`capacitor/android/app/build.gradle`, commits that file, tags the exact commit,
and atomically pushes the commit and tag to `origin`. It then publishes a
`vX.Y.Z` GitHub release targeting `main` with generated release notes. CI
subsequently builds/signs the APK and attaches it to that release;
publication does not mean the APK has finished building.

The helper refuses dirty working trees, non-`main` branches, unsynchronized
checkouts, non-increasing/invalid versions, and existing release tags. It does
not create a local APK, handle signing keys/passwords, force-push, or automatically
roll back a failed publication. If a commit, push, or publication fails, follow
its recovery message before starting another release; the version bump may
already be committed, tagged, or pushed. For usage help, run `pnpm release --help`.
