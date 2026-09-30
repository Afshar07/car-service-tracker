# Capture, crop, and OCR

## Source map

- `app/components/MileageCapture.vue`: capture/upload/manual-entry state, OCR invocation, confirmation and reading emission.
- `app/components/ImageCropper.vue`: displayed-image coordinates, crop interaction and canvas export.
- `app/utils/initial-crop.ts`: pure RGBA analysis and `suggestInitialCrop()` returning percentage bounds.
- `app/utils/seven-segment-ocr.ts`: pixel masking and seven-segment decoding.
- `app/utils/odometer-ocr.client.ts`: browser canvas preprocessing, Tesseract worker lifecycle and result selection.
- `app/types/ocr.ts`: progress, result, digit-decoder and crop-bound types.
- `tests/ocr.test.ts` and `tests/fixtures/`: algorithm and image regression coverage.

## Capture and crop contract

Image selection accepts image MIME types and rejects files larger than 15 MiB. The selected File is copied to an independent Blob before resetting the input, avoiding mobile file-lifetime problems. Preview/processed object URLs are revoked when replaced or unmounted.

The cropper starts at x=20%, y=28%, width=60%, height=24%. Suggestions analyze an image no wider than 720 pixels and do not overwrite a user's interaction. Bounds use percentages of the actual displayed image, not the surrounding letterbox. Pointer dragging moves the box; corner handles resize with an 8% minimum size. Export adds 4% padding relative to each crop dimension and clamps to the image edges.

Recognition always leads to explicit confirmation. Failure or missing digits switches to manual entry; manual entry is also available without a photo. Confirmed readings must satisfy [domain-contract.md](domain-contract.md), irrespective of OCR confidence.

## Recognition pipeline

1. Try the custom seven-segment decoder. A result with confidence at least 65 returns immediately with method `seven-segment` and a processed mask image.
2. Otherwise create an English Tesseract worker using local `/ocr/worker.min.js`, `/ocr/core`, and `/ocr/lang` assets.
3. Configure digits-only recognition and single-line segmentation. Try 3× enlarged grayscale/red-channel variants and their inversions.
4. Prefer attempts with a longer mileage candidate, then higher confidence for equal lengths. `extractMileageCandidate()` handles 3–7 digit sequences and whitespace-separated groups.
5. Return raw text, optional candidate, confidence, processed Blob, and method `tesseract`; terminate the worker in `finally`.

`preprocessOdometerImage()` is an exported grayscale helper; the actual Tesseract path uses `createTesseractVariants()`. Do not assume changes to the helper change all recognition attempts.

## Fixtures and caution

The real JPEG fixture is `tests/fixtures/odometer-170370.jpg` and decoder assertions expect **170370**. PNG fixtures cover 168240, 172940, 523940, 58370, 81525, and 139504. The last two check suggested-crop target containment, not full decoder recognition in those tests.

`reference.jpg` and `tests/fixtures/odometer-170370.jpg` are identical copies of the dashboard photo showing **170370 km**, as documented in `README.md`. The **170307** values in text-extraction tests are separate string examples, not the JPEG's expected reading. Keep those assertions distinct rather than changing expected values to fit a regression.

Node fixture tests do not execute real browser canvas/Tesseract recognition. Crop/capture changes also need mobile browser checks; see [verification.md](verification.md). Asset packaging belongs in [pwa.md](pwa.md).
