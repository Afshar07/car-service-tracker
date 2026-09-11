# Cloud Sync Implementation Plan

## Status

Deferred. The user chose IndexedDB as the current storage; cloud synchronization remains out of scope for now.

## Objective

Add secure, automatic cross-device synchronization while preserving the app's offline-first behavior and all existing IndexedDB data.

## Architecture

- **IndexedDB** remains the local cache and offline source.
- **Cloudflare D1** becomes the synchronized cloud source of truth.
- **Nuxt server routes on Cloudflare Workers** provide the synchronization API.
- **Cloudflare Access** provides private sign-in and verified user identity.
- **An IndexedDB outbox** retains local changes until they are acknowledged by the server.

Keeping the PWA and API on the same Cloudflare origin avoids cross-origin Access cookie and CORS problems.

## Data Model

### Mileage readings

Each synchronized reading has:

- A stable client-generated UUID.
- An owner derived from the verified Cloudflare Access identity.
- Mileage and recording date.
- Optional detected mileage.
- An update timestamp.
- An optional deletion timestamp used as a tombstone.

### Service settings

Each user has one settings record containing:

- Last service mileage.
- Service interval.
- An update timestamp used for conflict resolution.

### Sync metadata

The local database records:

- Pending outbox operations.
- The latest acknowledged synchronization cursor.
- The last successful synchronization time.

## Synchronization Contract

1. Local writes complete immediately and remain available offline.
2. Every local mutation adds an outbox operation with a stable operation ID.
3. When online and authenticated, the client uploads pending operations.
4. The API applies operations idempotently so retries cannot create duplicates.
5. The client downloads server changes after its last synchronization cursor.
6. Mileage readings merge by stable reading UUID.
7. Existing local and remote readings are combined on first synchronization.
8. Service settings use last-write-wins based on their update timestamp.
9. Deletions use tombstones so deleted readings cannot reappear on another device.
10. The client advances its cursor only after the complete response is applied locally.
11. Failed or ambiguous requests retain their outbox operations and retry later.

## Authentication and Authorization

- Cloudflare Access protects the application and synchronization API.
- Every synchronization request must contain a valid Access JWT.
- The Worker validates the JWT signature, issuer, audience, and expiry.
- The verified JWT subject is the authoritative owner identifier.
- Client-provided owner identifiers are never trusted.
- D1 is reachable only through its Worker binding.
- API payloads are schema-validated and size-limited.
- Dashboard images and OCR crops are never uploaded.

Required runtime configuration:

- Cloudflare Access team domain.
- Cloudflare Access application audience.
- D1 database binding named `DB`.

## Offline and PWA Behavior

- Capture, OCR, history, settings, and local writes continue to work offline.
- Synchronization pauses while offline or unauthenticated.
- Synchronization resumes after connectivity and authentication return.
- The UI exposes `local only`, `syncing`, `synced`, and `sync failed` states.
- Service-worker updates must not clear IndexedDB, sync metadata, or pending operations.

## Cloudflare Configuration

The implementation will add:

- A versioned D1 SQL migration.
- A `wrangler.jsonc` configuration with a placeholder database ID.
- A Cloudflare-compatible Nitro deployment preset.
- Local D1 development configuration.
- Documented commands for creating D1, applying migrations, configuring Access, and deploying.

No Cloudflare credentials, generated database IDs, or secrets will be committed.

## Implementation Sequence

1. Extend IndexedDB with outbox and synchronization metadata stores.
2. Add timestamps and tombstone support without deleting existing local records.
3. Implement pure merge and conflict-resolution functions with unit tests.
4. Add the D1 schema and migrations.
5. Implement Access JWT validation and authenticated server routes.
6. Implement transactional, idempotent push/pull synchronization.
7. Add the client synchronization coordinator and retry behavior.
8. Add compact synchronization status UI.
9. Configure the Cloudflare Worker build and local D1 environment.
10. Harden PWA caching and verify offline behavior.
11. Run local migration, security, synchronization, type, build, and browser verification.

## Acceptance Criteria

- Existing IndexedDB readings and settings remain intact after upgrading.
- A user can add, edit through confirmation, and delete readings offline.
- Pending changes synchronize after connectivity returns.
- Two authenticated devices converge on the same readings and settings.
- Repeated requests do not duplicate data.
- Deletions propagate and do not reappear.
- One authenticated user cannot read or mutate another user's records.
- Expired, malformed, or incorrectly scoped Access tokens are rejected.
- OCR images remain exclusively on the device.
- The app remains usable if Cloudflare synchronization is unavailable.
- Existing OCR and service-tracking tests continue to pass.

## Verification

- Unit tests for merge, deduplication, settings conflicts, tombstones, and retries.
- API tests for authentication, ownership isolation, validation, and idempotency.
- IndexedDB migration tests using existing version-one data.
- Offline tests proving local changes survive reloads and synchronize later.
- `pnpm test`
- `pnpm exec nuxt typecheck`
- `pnpm run build`
- Local Wrangler and D1 migration verification.
- Mobile PWA verification online, offline, and after an Access session expires.

## Rollback

IndexedDB remains authoritative for immediate local operation throughout the migration. Cloud synchronization can be disabled without deleting local history. If the cloud rollout fails, the application can revert to local-only behavior while retaining pending operations for later recovery.

## Deferred Decisions

- The allowed Cloudflare Access identities and identity provider are configured outside the repository.
- The production D1 database ID is added during Cloudflare environment setup.
- Deployment occurs only after local verification and explicit approval.
