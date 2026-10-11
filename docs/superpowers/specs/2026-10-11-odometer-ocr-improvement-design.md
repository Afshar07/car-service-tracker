# Odometer OCR improvement design

## Goal

Read the odometer reliably from dashboards like `example.jpg` (92615 km, white
dot-matrix digits on a dark LCD with glare, beside "ODO"/"km", below a
temperature row). Everything stays on-device and offline. Every recognized
reading still requires explicit user confirmation before saving.

## Constraints

- No uploads, telemetry, or cloud OCR. Works offline.
- PWA keeps the browser OCR path; Android adds native ML Kit.
- Red/orange dashboard support and existing fixtures (e.g. 170370) must not regress.
- Domain validation in `domain-contract.md` applies regardless of OCR confidence.

## Success criteria

- `example.jpg` initial crop contains the odometer digits and excludes the
  "P", temperature, and fuel-economy rows.
- Browser engine and ML Kit engine are each checked on `example.jpg`, the
  existing fixtures, and real device photos; failure falls through to manual entry.
- Existing `tests/ocr.test.ts` assertions pass unchanged.

## Design

1. **Crop** (`app/utils/initial-crop.ts`, pure). Widen the neutral search to the
   full central display. Anchor on the lowest row of near-uniform-height bright
   glyph runs (the digit group next to "ODO"/"km"); penalize rows containing a
   degree sign or letter-like runs. The red/orange path is untouched.
2. **Preprocessing** (`app/utils/odometer-ocr.client.ts`). Add a local-contrast
   variant and an adaptive-threshold variant for glare. Keep existing gray/red
   variants and inversions so prior behavior is preserved.
3. **Engine interface** (`app/types/ocr.ts`). `IOcrEngine.recognize(blob)`
   returns `IOcrResult`. The current logic becomes the `browser` engine; add
   `native-mlkit`. `recognizeOdometer()` selects: on Android native, try ML Kit,
   then fall back to the browser engine on error or no digits; PWA always uses
   the browser engine. `IOcrResult.method` gains `"mlkit"`.
4. **Native plugin.** `MlKitOcrPlugin.kt` registered in `MainActivity.kt`,
   following `MileageBackupPlugin.kt`. Depends on the bundled
   `com.google.mlkit:text-recognition` model (about 4 MB, fully offline; the
   unbundled Play Services download variant is rejected). Input is the cropped
   image; output is raw text. A typed web bridge lives in `app/types/` and
   `app/utils/*.client.ts`. Digits are validated by the existing
   `extractMileageCandidate()`.
5. **Comparison.** A dev-only script and manual checklist run both engines on
   the same photos. ML Kit cannot run in Node, so automated coverage is crop,
   preprocessing, engine selection and the bridge with a mocked plugin.
   Real-device accuracy is a manual check and is reported as such.
6. **Docs.** Update `.ai/ocr.md`, `.ai/android.md`, `.ai/verification.md`.

## Testing

- Add `example.jpg` as a fixture (`tests/fixtures/odometer-92615.jpg`) with
  crop-containment tests; keep all existing assertions.
- Unit tests for engine selection and fallback with a mocked bridge.
- `pnpm test`, `pnpm exec nuxt typecheck`, `pnpm generate`,
  `pnpm --dir capacitor sync`, and `gradle assembleDebug` where the toolchain exists.

## Out of scope

Cloud sync, remote vision APIs, schema changes, widget changes, iOS.
