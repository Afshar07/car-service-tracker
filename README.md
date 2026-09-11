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
npm install
npm run dev
```

Run validation with:

```bash
npm test
npm run build
```

## OCR fixtures

The OCR pipeline is isolated in `app/utils/odometer-ocr.client.ts`. The first real image fixture should use the reference dashboard photo whose confirmed odometer value is `170307` km.
