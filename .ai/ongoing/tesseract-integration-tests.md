# TODO: Real Tesseract integration tests

## Status

Planned; implementation has not started. The user requested recording this task for a later session, not implementing it now.

## Problem and established findings

- `tests/ocr.test.ts` tests text extraction, real/synthetic seven-segment pixel decoding, and initial crop suggestions. It never calls `recognizeOdometer()` or runs an actual Tesseract worker.
- `app/utils/odometer-ocr.client.ts` tries seven-segment recognition first and returns early at confidence ≥ 65. A passing pipeline test alone therefore does not prove Tesseract ran.
- `reference.jpg` and `tests/fixtures/odometer-170370.jpg` are identical and visually show **170370 km**. README documentation has been corrected. The 170307 text-extraction examples are independent strings; the test name “extracts the known reference mileage” is misleading.
- The original algorithm baseline was 48 passing tests across mileage (21) and OCR (27). Native image-capture and release-helper suites were added later, so 48 is not the current total. Neither those additional mocked suites nor the algorithm tests provide actual Tesseract integration coverage; see `../verification.md` for current commands and coverage.
- Tesseract.js supports real recognition in Node using encoded image buffers/file paths and in browsers using Blobs/canvas. Node cannot directly exercise the existing browser canvas orchestration.

## Proposed approach

1. Add a small, separately runnable Node integration suite using a real Tesseract worker, WASM core, and local English language data. Start here to establish direct engine coverage.
2. Add a browser smoke/integration test for the production preprocessing and recognition pipeline, including a fixture that exercises the Tesseract fallback and asserts `method === "tesseract"`.
3. Retain the current fast algorithm tests; clarify the misleading text-extraction test name when editing that suite.

The browser test runner/dependency and fixture selection have not been chosen. Inspect existing tooling and decide the minimal setup before adding dependencies. No new package or browser framework was approved/installed in this session.

## Acceptance criteria

- Known fixtures have independently verified mileage; expectations are not copied from current OCR output.
- At least one test invokes real Tesseract, with no mocked recognition result.
- Use local assets and production-equivalent language, engine, digit whitelist, and segmentation settings; tests do not depend on network downloads.
- Assert normalized recognized mileage rather than exact confidence scores.
- Reuse/terminate workers appropriately, use suitable timeouts, and avoid leaving generated language caches or resources in the repository.
- Keep slower integration checks separately runnable and document how to run them.
- Browser coverage verifies the actual worker/core/language paths and production preprocessing, and demonstrates that the fallback really used Tesseract.
- Existing algorithm tests continue to pass; report Node engine coverage separately from browser pipeline coverage.

## Resume instructions

1. Follow `AGENTS.md` routing and applicable policies, then read `.ai/ocr.md` → `.ai/domain-contract.md` → `.ai/verification.md`.
2. Before editing consumer Nuxt tests, load the `characterization-testing` skill. Consult current Tesseract.js documentation through Context7 for worker setup and local assets; load browser/testing skills if performing browser automation.
3. Inspect `tests/ocr.test.ts`, `vitest.config.ts`, `package.json`, `app/utils/odometer-ocr.client.ts`, `app/types/ocr.ts`, and `scripts/prepare-ocr-assets.mjs`. Read `.ai/pwa.md` if changing asset preparation or exercising production browser assets.
4. Evaluate representative fixtures and the smallest runner setup, then implement the direct integration suite before expanding browser coverage.
5. Run targeted new tests, `pnpm test`, and relevant type/build/browser checks. Update `.ai/verification.md` with implemented commands and actual coverage, then remove this ongoing task and its index entry once complete.

Documentation reference: https://github.com/naptha/tesseract.js/blob/master/docs/image-format.md and https://github.com/naptha/tesseract.js/blob/master/docs/local-installation.md. Browser and Node worker entry points differ; do not reuse the browser worker script blindly in Node.
