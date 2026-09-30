# car-service-tracker

## Scope

The only active project in this workspace: a single-car, kilometer-based mileage log and service countdown. Users capture/upload a dashboard image or enter mileage manually, confirm the reading, and maintain local history and service settings.

Implemented extensions include editing/deleting readings, marking service completion, Gregorian and Jalali history dates, estimated current mileage, and an Android home-screen widget.

## Ownership boundaries

- `app/` owns the Nuxt/Vue application, domain calculations, browser persistence, and OCR.
- `capacitor/` owns Android packaging and the Kotlin widget integration; it consumes the web application's calculated snapshot rather than reimplementing mileage rules.
- `scripts/prepare-ocr-assets.mjs`, `public/`, and `nuxt.config.ts` own local OCR assets and the PWA shell.
- `tests/` owns Node-based unit and image-fixture coverage. `.github/workflows/android-release.yml` owns the Android release workflow.
- `docs/` contains the native setup guide and a deferred cloud-sync plan. `.ai/README.md` routes agent work to focused implementation contracts.

## Product and privacy boundaries

- Remain local-only and usable offline after shell/OCR assets are cached. Do not introduce image uploads, authentication, telemetry, or cloud dependencies without an explicit requirement.
- IndexedDB readings/settings are the application data. The native widget stores only a derived snapshot, not a second database of readings.
- Preserve existing local records when changing storage. Schema changes need an upgrade strategy, not deletion/recreation of the database.
- Keep the fixed monthly mileage estimate distinct from the history-derived service-date estimate.
- The Cloudflare D1/Access/Worker architecture in `docs/cloud-sync-plan.md` is not implemented or approved for current work.

Source anchors: `app/types/car.ts`, `app/composables/useCarData.ts`, `app/utils/car-database.ts`, `app/utils/mileage.ts`, and `docs/android-widget.md`.
