# Verification guide

## Commands defined by the repository

Run from the workspace root unless noted:

| Boundary | Check |
| --- | --- |
| Mileage/domain functions | `pnpm exec vitest run tests/mileage.test.ts` |
| OCR/pixel/crop algorithms | `pnpm exec vitest run tests/ocr.test.ts` |
| Native image-selection helper (mocked bridge) | `pnpm exec vitest run tests/unit/utils/image-capture.test.ts` |
| All existing unit tests | `pnpm test` |
| Interactive release helper | `pnpm exec vitest run tests/release-script.test.ts` and `pnpm release --help` |
| Application TypeScript/Vue contracts | `pnpm exec nuxt typecheck` |
| Web/PWA build and OCR asset preparation | `pnpm build` |
| Static output for Android | `pnpm generate` |
| Native asset synchronization | `pnpm --dir capacitor sync` |
| Native debug compilation after sync (requires Android/JDK/Gradle setup) | From `capacitor/android`: `gradle --no-daemon assembleDebug` |
| Native release compilation after sync | From `capacitor/android`: `gradle --no-daemon assembleRelease`; signing and verification are separate, see `docs/android-widget.md` |

There is no lint script, browser-test script, or root native APK build script. Treat native synchronization as preparation, not successful compilation.

## Existing coverage

`vitest.config.ts` runs `tests/**/*.test.ts` in Node and maps `~` to `app/`.

- `tests/mileage.test.ts`: integer/range/previous-reading validation, warnings, service thresholds, history rate/date estimation, missing configuration and fixed-monthly current-mileage estimation.
- `tests/ocr.test.ts`: candidate extraction, synthetic/real seven-segment decoding, padded crops, narrow digits, incomplete-display rejection and initial-crop suggestions.
- `tests/unit/utils/image-capture.test.ts`: shared image type/15 MiB validation, explicit native sources, local-only file reads, retries, cancellation and permission-error messages with mocked bridge/fetch. This does not exercise a device camera or browser chooser.
- `tests/ocr-preprocess.test.ts`, `tests/ocr-engine.test.ts`, `tests/unit/utils/mlkit-ocr.test.ts`: glare helpers, engine fallback order, and the ML Kit bridge with a mocked plugin. ML Kit itself and the browser Tesseract worker are not run in Node.
- `tests/release-script.test.ts`: version bumping and release-helper safeguards with mocked Git/GitHub commands; tests must never publish a real release.
- PNG/JPEG pixels are decoded with `pngjs` and `jpeg-js`. These tests do not run the real browser Tesseract worker.

- `tests/mileage-backup.test.ts`: full JSON round trips, malformed backups, deduplication, conflicts, and chronological validation.
- `tests/car-data-backup.test.ts`: mocked persistence/bridge recovery, mutation snapshots, failed writes, existing-data precedence, and stale-backup deletion safeguards.
- `tests/car-database.test.ts`: mocked version-1 preservation, fresh schema creation, atomic import/deletion store selection, and failed transaction completion.
- `tests/unit/utils/mileage-backup-client.test.ts`: mocked native backup/sharing and browser download/storage retention behavior.

## Coverage gaps and manual checks

There are no dedicated automated component, real IndexedDB migration, PWA/offline, real device/native bridge, or end-to-end tests in the current suite. Mocked image-capture bridge coverage does not prove real camera behavior. Release-helper tests do not execute real Git/GitHub publication. Effective service-marker precedence and edit-neighbor validation are not directly covered by the existing mileage tests. Real Tesseract worker/browser integration remains planned in `ongoing/tesseract-integration-tests.md`.

- Capture/crop/UI changes: check mobile camera/gallery inputs, preview lifetime, drag/resize in letterboxed images, OCR failure/manual fallback, confirmation, and cancel/reopen.
- Data/UI changes: export/share JSON with all details, import into a fresh installation, repeat import, reject malformed/conflicting files, check normal update retention and native fresh-database recovery; confirm persistence after reload, newest-first ordering after date edits, neighboring mileage constraints, service-marker baseline changes, and delete confirmation.
- OCR engine comparison (device/emulator build): photograph or pick `example.jpg` (92615), a red/orange dashboard, and 3+ real photos in varied light. Record ML Kit's result, the browser engine's result (mobile browser/PWA) and the true odometer value for each. ML Kit must be at least as accurate as the browser engine before it stays first in `recognizeOdometer()`. Also confirm fallback with the plugin unavailable and manual entry when no digits are found.
- PWA changes: use a built production app; cache once online, reload/navigate and run OCR offline, then test update handling without losing readings.
- Android changes: verify native compilation, snapshot refresh after mutations, retained state while closed, pin support/status, tap-to-open, and overdue rendering on a device/emulator with a suitable launcher.
- Documentation/context-only changes: verify referenced paths exist, routes are discoverable and ordered, placeholders are removed, and claims match source. Application execution is not required unless source changes.

Report checks actually run and outstanding checks separately. Do not turn documented commands or existing fixture assertions into claims of current runtime validation.

- `tests/app-version.test.ts` covers exact Android version exposure, automatic release-bump propagation and invalid-source build failures.
- `tests/reading-deletion.test.ts` covers request/cancel without mutation, confirmed ID selection, concurrent confirmation guards and failed-write retry. These are state-helper tests, not browser/component tests.
- Drawer/dialog checks: mobile and desktop layouts, keyboard focus containment/restoration, backdrop/Escape/close controls, menu-to-panel transitions, rapid reopen, reduced motion and semantic-token overrides.
