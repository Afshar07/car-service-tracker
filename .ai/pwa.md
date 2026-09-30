# PWA and OCR asset packaging

Sources: `nuxt.config.ts`, `package.json`, `scripts/prepare-ocr-assets.mjs`, `app/app.vue`, `app/components/PwaStatus.vue`, and `.gitignore`.

## Build flow

- `pnpm dev`, `pnpm build`, and `pnpm generate` first run `pnpm prepare:ocr`.
- The preparation script replaces generated `public/ocr/`, copies the Tesseract worker, standard/SIMD LSTM JavaScript/WebAssembly cores, and compressed English traineddata from installed dependencies.
- Generated OCR assets are ignored; change the script or dependencies, not the generated copies.
- Root `build` runs `nuxt build`; `generate` runs `nuxt generate`. Android consumes `.output/public` after static generation.
- `pnpm preview` runs Nuxt preview; it does not itself prepare assets or build the app.

## Offline contract

The first visit/install requires a connection to load/cache the shell and OCR assets. Reading storage remains IndexedDB and recognition uses local assets; photos are never uploaded.

`@vite-pwa/nuxt` registers with update prompts. Workbox precaches JS, CSS, HTML, SVG, PNG, WOFF2, WASM, and GZ, with a 50 MiB per-file limit. `/` is an explicit precache entry and navigation fallback; clients are claimed. The root entry revision comes from a Cloudflare Pages commit SHA, Vercel commit SHA, or build timestamp.

Manifest start URL, fallback, and OCR paths assume deployment at the domain root. Subpath hosting is not already supported. Service workers are disabled for development, so dev mode cannot establish production offline behavior.

`PwaStatus.vue` shows update prompts, offline readiness, or registration errors. Reload requests service-worker activation; later cancels the prompt. PWA shell updates must preserve IndexedDB data.

## Verification boundary

Changes to asset paths, build hooks, glob patterns, file sizes, or update behavior require generated/build inspection and a production-mode browser check. Test both shell navigation and OCR after initial caching, with connectivity disabled. Do not infer offline readiness solely from a passing Node test or the status banner.
