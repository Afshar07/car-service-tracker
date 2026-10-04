# Mileage, service, and persistence contract

Sources: `app/types/car.ts`, `app/utils/mileage.ts`, `app/utils/car-database.ts`, `app/composables/useCarData.ts`, `app/components/MileageCapture.vue`, `app/components/MileageEditForm.vue`, and `app/pages/index.vue`.

## Persisted data

- `IMileageReading`: string `id`, numeric `mileageKm`, ISO `recordedAt`, optional `detectedMileageKm` and `servicePerformed`.
- Capture creates IDs with `crypto.randomUUID()` and timestamps with `new Date().toISOString()`. It stores detected mileage only when detection exists and differs from the confirmed value.
- Editing preserves the ID and other existing fields, updates mileage/date/service marker, and converts local date-time input back to ISO.
- `IServiceSettings`: singleton ID `"service"`, `lastServiceMileageKm`, and `serviceIntervalKm`.
- IndexedDB name: `car-service-tracker`; version: `2`. `readings` uses key path `id` and index `by-recorded-at`; `settings` uses key path `id`.
- `getMileageReadings()` reverses indexed date order. Composable add/update sorts descending by timestamp; callers of effective-service resolution must preserve newest-first order.
- Version 2 adds a `metadata` store with an `initialized` marker. Upgrading version 1 creates only that store and marks the existing database authoritative; readings/settings are preserved. Mutations/imports update this marker in the same transaction. Fresh databases are marked only after recovery is checked.
- Database writes use `put`; deletes are physical deletes. No outbox, tombstones, or cloud owner fields exist.
- `mileage-backup.ts` exports/validates versioned kilometer JSON with all persisted fields and settings. Import merges by ID, rejects conflicting IDs or decreasing chronological mileage, and keeps existing settings. Writes are atomic across stores.
- `MileageBackup` on Android maintains an atomic private JSON backup after load/mutations and shares exports using FileProvider. Recovery runs only for fresh, empty databases; initialized empty histories do not resurrect deleted readings. Backup failures warn without discarding successfully saved data. Browser storage retention requests are best-effort. Uninstall/data clearing can delete local backups.

## Mileage validation

`validateMileage()` permits finite integers from 0 through 9,999,999 km. Lower-than-previous mileage is an error; duplicates are warnings; increases of at least 10,000 km are warnings. Warnings do not block saving.

New capture validates against the latest confirmed mileage. Edits find adjacent readings by the proposed date, excluding the edited ID: the older reading is at or before that date, the newer reading is strictly after it. Edits also reject mileage above the newer reading and invalid dates.

Page service-settings validation requires a nonnegative integer last-service mileage and a positive integer interval. It does not apply the full mileage validator. Do not silently tighten behavior in a preservation task.

## Service baseline and status

- Next service mileage = last service mileage + interval.
- `resolveEffectiveServiceSettings()` selects the first service-marked reading from newest-first history. Its mileage overrides the manual baseline; the configured interval remains, or defaults to 10,000 km if settings are absent.
- Without a service-marked reading, the explicit settings are used unchanged.
- Remaining distance = next service mileage − current mileage supplied to the summary.
- Remaining distance ≤ 0 is `overdue`; otherwise ≤ `min(1,000, interval × 0.1)` is `due-soon`; otherwise `on-track`.
- Missing current mileage or settings yields `not-configured`.

## Two different estimates

**Current mileage:** `estimateCurrentMileage()` adds elapsed days × 2,000 km / (365.2425 / 12) to the latest reading, rounded to a whole kilometer. The monthly rate is an optional function argument, not a saved user setting. Future reading dates contribute zero elapsed days. Missing reading, invalid dates, or invalid/negative monthly rate yield `undefined`.

**Service date:** `calculateAverageDailyKm()` sorts history oldest-first and divides the endpoint mileage increase by elapsed days. It requires at least two readings spanning seven days and positive movement. `calculateServiceSummary()` projects a date only with a usable average and positive remaining distance.

Dashboard and widget summaries use estimated current mileage; the displayed last-confirmed reading remains separately available. Never conflate the fixed monthly estimate with the history-derived driving rate.

## Mutation boundary

`useCarData()` exposes load, add, update, delete, settings update, and JSON import. Persistence completes before reactive state changes, then widget synchronization runs. Loading is client-only and skipped once the shared loaded flag is true. Widget synchronization is not cloud synchronization.

Changes to these rules require corresponding tests and explicit behavior intent. Existing coverage and gaps are listed in [verification.md](verification.md).
