# Car Service Tracker

A mobile-first, local-only PWA for recording odometer readings and tracking when a car needs its next service.

## Features

- Dashboard photo capture, library selection, or manual mileage entry
- Adjustable/suggested odometer crop, seven-segment recognition, and browser-based Tesseract fallback
- Mandatory confirmation before saving
- Mileage validation against the previous reading
- IndexedDB history with timestamps
- Automatic Android mileage backup/recovery and persistent browser storage requests
- JSON history export/sharing and validated import
- Edit/delete readings, mark service completion, and view Gregorian/Jalali dates
- Service interval and remaining-distance status
- Estimated current mileage based on a fixed 2,000 km/month, distinct from confirmed readings
- Estimated service date when at least seven days of useful history exists
- Offline-capable PWA shell
- Optional Android Capacitor wrapper with native camera/photo picker and home-screen widget

No photos leave the device. The app has no backend, account, cloud sync, or AI vision API. Clearing app/browser data or uninstalling the Android app can remove local readings.

## Keeping and sharing history

Normal PWA and Android updates keep local history. On Android, install updates
with the same app ID and signing key over the existing app. Do not uninstall
first: uninstalling or clearing app data can delete both history and the automatic
backup.

The Android app saves an atomic on-device JSON backup after loading and after
every history/settings change. If a new WebView database is created, it restores
that backup automatically. Existing databases, including deliberately emptied
ones, remain authoritative. The browser app requests persistent storage where
supported; browsers may decline this request.

Use **Export JSON** under Mileage history to download a backup in a browser or
open Android's share sheet. The versioned JSON includes every reading's ID,
confirmed mileage, ISO timestamp, detected mileage when available, service marker,
and service settings. Photos are not stored or exported.

Use **Import JSON** to restore or merge an exported file (up to 10 MB). Repeated
imports do not duplicate readings. Existing service settings are kept; a fresh
installation restores settings from the file. Invalid files, conflicting reading
IDs, and history that decreases over time are rejected before writing. Keep an
exported copy outside the app before reinstalling or clearing data.

## Development

```bash
pnpm install
pnpm dev
```

Run validation with:

```bash
pnpm test
pnpm exec nuxt typecheck
pnpm run build
```

The app is local-only: readings remain in IndexedDB and OCR runs in the browser. The first visit (or PWA installation) needs a connection so the app shell and OCR assets can be cached; subsequent use works offline. `pnpm prepare:ocr` copies the Tesseract worker, LSTM WebAssembly cores, and English traineddata into the generated, ignored `public/ocr` directory before dev, generate, and build. The PWA paths assume deployment at the domain root.

## OCR fixtures

The OCR pipeline is isolated in `app/utils/odometer-ocr.client.ts`. The reference dashboard photo, `reference.jpg`, is also stored as `tests/fixtures/odometer-170370.jpg`; its confirmed odometer value is `170370` km. `tests/ocr.test.ts` verifies decoding this fixture.

The current tests cover seven-segment algorithms and mocked native capture,
not real Tesseract worker execution. Real engine/browser integration coverage
remains a planned task.

## Android builds and releases

Android Studio is optional. The current CLI build uses JDK 25, Gradle 9.1.0,
Android SDK Platform 36, and Build-Tools 35.0.0. Java/Kotlin bytecode targets
remain 21. See [the Android guide](docs/android-widget.md) for setup, local
build/signing, widget behavior, and the four GitHub signing secrets.

After committing and pushing/merging all changes into `main`, run:

```bash
pnpm release
```

The interactive helper chooses a stable version, updates Android version
name/code, and asks for explicit confirmation before committing, tagging,
atomically pushing, and publishing the GitHub release. It requires Git,
authenticated GitHub CLI, and a clean, synchronized `main` checkout. Publishing
the release triggers CI to build/sign the APK and attach it with a checksum;
a plain push does not trigger that workflow.

Agent context is routed through [AGENTS.md](AGENTS.md) and [.ai/README.md](.ai/README.md).
