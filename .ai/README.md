# .ai/ - Project Context for AI Agents

At workspace-router step 3, select one route below; defer its documents until
step 7, then follow the route exactly in order.

## Files

| File | Read when you're... |
| --- | --- |
| `architecture.md` | orienting yourself, changing UI orchestration, or tracing data flow |
| `domain-contract.md` | changing mileage, service calculations, validation, or persisted records |
| `ocr.md` | changing capture, cropping, digit recognition, or image fixtures |
| `pwa.md` | changing offline caching, OCR asset preparation, or web builds |
| `android.md` | changing the Capacitor wrapper, native bridge, widget, or Android release |
| `verification.md` | selecting checks and understanding existing coverage gaps |
| `ongoing/README.md` | continuing an in-progress task; read only the matching task document |

## Rules

- This folder is the local source of truth for AI task context in `car-service-tracker`.
- Keep file descriptions and task routes updated when project-specific decisions or boundaries change.
- Read only the files selected by the applicable task route or an exact user-named file.
- All source paths in focused guidance are relative to the workspace root. Follow Markdown links to context documents; do not load every route by default.

## Task routes

- Continuing in-progress work: `ongoing/README.md` → only the matching task document → source.
- Project orientation or context maintenance: `architecture.md` → source; read another focused document only for the boundary being updated.
- Dashboard, history, editing, or service settings: `architecture.md` → `domain-contract.md` → `verification.md` → source.
- Persistence, mileage validation, or service calculations: `domain-contract.md` → `verification.md` → source.
- Capture, crop, OCR, or OCR fixtures: `ocr.md` → `domain-contract.md` → `verification.md` → source.
- PWA, offline behavior, OCR asset packaging, or web build configuration: `pwa.md` → `verification.md` → source.
- Android wrapper, native widget, or release: `android.md` → `domain-contract.md` → `verification.md` → source.
- Test-only or verification work: `verification.md` → focused document for the tested boundary → source.
- Cloud synchronization discussion: `architecture.md` → `docs/cloud-sync-plan.md` → `domain-contract.md` → source. Implementation requires explicit scope approval; this plan is deferred.
- Combine applicable routes for cross-boundary changes, preserving order and reading each document once.
- When no route applies, inspect the requested source file directly.
