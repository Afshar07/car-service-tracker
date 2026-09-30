# car-service-tracker Workspace

## Purpose

A personal, mobile-first car mileage and service tracker. The primary application is a local-only Nuxt PWA; an Android Capacitor wrapper adds a home-screen widget.

## Active scope

- One active project: `car-service-tracker`, rooted at `.`. `capacitor/` is part of this project, not a separate product.
- Mileage readings and service settings persist in browser IndexedDB. Dashboard photos and OCR processing stay on-device.
- No backend, accounts, cloud synchronization, or remote vision API is implemented. `docs/cloud-sync-plan.md` is a deferred proposal, not the current architecture.
- No held projects or additional project contracts are currently recorded.

## Context ownership

`AGENTS.md` is the entry router. `.ai/README.md` selects focused routes; `.ai/projects/car-service-tracker.md` defines project boundaries. Shared workflow rules live in `.ai/engineering-conventions.md` and `.ai/policies/`. Focused implementation guidance lives directly under `.ai/`; temporary task state lives in `.ai/ongoing/`.

Source anchors: `README.md`, `package.json`, `nuxt.config.ts`, `app/utils/car-database.ts`, and `docs/android-widget.md`.
