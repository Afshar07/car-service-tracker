# Application architecture

## Runtime and entry points

`package.json` declares Nuxt 4, Vue 3, TypeScript, `idb`, Tesseract.js, and `@vite-pwa/nuxt`. `app/app.vue` renders the PWA manifest/status and `NuxtPage`. The sole page, `app/pages/index.vue`, owns dashboard presentation, history, capture/edit/settings modals, and widget pinning UI.

`app/assets/css/main.css` contains the shared mobile-first styles. History shows Gregorian dates and Persian-calendar dates with Latin digits; saved timestamps remain ISO strings.

## Main data flow

1. On mount, the page calls `useCarData.load()`.
2. `app/composables/useCarData.ts` loads readings/settings from `app/utils/car-database.ts` into Nuxt `useState` refs. Readings are newest-first; `currentMileageKm` is the latest confirmed reading.
3. The page computes estimated current mileage, effective service settings, and the service summary through `app/utils/mileage.ts`.
4. `MileageCapture.vue` emits a confirmed new reading; `MileageEditForm.vue` emits an updated reading. The page calls composable mutations; delete uses browser confirmation.
5. Each mutation persists first, updates reactive state, and refreshes the native widget snapshot. Loading also refreshes the snapshot.

The database module does not enforce domain validation itself; capture/edit/settings UI performs validation. Do not assume arbitrary direct database writes are safe.

## Component responsibilities

| Source | Responsibility |
| --- | --- |
| `app/components/MileageCapture.vue` | Photo/manual input, OCR progress and fallback, mandatory confirmation, reading creation |
| `app/components/ImageCropper.vue` | Initial crop suggestion, pointer movement/resizing, canvas crop Blob |
| `app/components/MileageEditForm.vue` | Mileage/date/service edits and neighboring-reading checks |
| `app/components/PwaStatus.vue` | Offline-ready, update-available, and registration-error notices |
| `app/utils/mileage-messages.ts` | User-facing messages for mileage validation codes |

## Boundaries and limitations

- No server routes or remote data service are implemented. IndexedDB version 1 contains readings and one service-settings record.
- Photos/crops are transient Blobs/object URLs, not persisted reading fields.
- The Android widget is a derived, last-known snapshot. It does not independently estimate mileage while the application is closed.
- Time-dependent computed mileage has no periodic clock trigger in the page; it is not a continuously refreshed live odometer.
- Readings marked `servicePerformed` override the manual last-service baseline. Details belong in [domain-contract.md](domain-contract.md).
- Offline packaging belongs in [pwa.md](pwa.md); image processing in [ocr.md](ocr.md); native integration in [android.md](android.md).
- `docs/cloud-sync-plan.md` proposes D1, Access, Worker routes, an outbox, and tombstones, but explicitly defers all of them.
