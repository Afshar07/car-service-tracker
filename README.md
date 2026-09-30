# Car Service Tracker

A mobile-first, local-only PWA for recording odometer readings and tracking when a car needs its next service.

## MVP features

- Dashboard photo capture or upload
- Adjustable odometer crop and browser-based Tesseract OCR
- Mandatory confirmation before saving
- Mileage validation against the previous reading
- IndexedDB history with timestamps
- Service interval and remaining-distance status
- Estimated service date when at least seven days of useful history exists
- Offline-capable PWA shell

No photos leave the device. The MVP has no backend, account, cloud sync, or AI vision API.

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
