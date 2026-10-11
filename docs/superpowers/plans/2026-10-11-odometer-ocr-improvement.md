# Odometer OCR Improvement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reliably read odometers like `example.jpg` (92615 km, white dot-matrix digits on a dark LCD with glare) with a better crop, better preprocessing, and a native ML Kit engine on Android, keeping the browser engine for the PWA.

**Architecture:** `initial-crop.ts` gains a wide neutral-row search scored against the existing narrow one. Pure preprocessing helpers feed extra Tesseract variants. A small engine-selection module tries a native ML Kit plugin first on Android and falls back to the existing browser engine. Everything stays on-device; saving still requires user confirmation.

**Tech Stack:** Nuxt 4 / Vue / TypeScript, Vitest (Node, `jpeg-js`, `pngjs`), tesseract.js, Capacitor 8.5 Android plugin in Kotlin, bundled `com.google.mlkit:text-recognition`.

**Spec:** `docs/superpowers/specs/2026-10-11-odometer-ocr-improvement-design.md`

**Commits:** Make commits only when the user asks; steps below say "checkpoint" where a commit would be natural.

## Global Constraints

- No uploads, telemetry, or cloud OCR; must work offline.
- Existing `tests/ocr.test.ts` assertions pass unchanged (fixtures 170370, 168240, 172940, 523940, 58370, 81525, 139504).
- Red/orange dashboard path (`suggestRedCrop`) is untouched.
- Bundled ML Kit model only (no Play Services model download).
- Style: double quotes, semicolons, two-space indent, `I`/`T` type prefixes, `~/` imports, browser APIs in `*.client.ts`.
- Do not hand-edit `.nuxt/`, `.output/`, `public/ocr/`; do not run `cap add android`.
- Confirmed readings still go through `validateMileage()` regardless of OCR confidence.

## Review Focus

- Photo with no digits at all (dark/blank crop): every engine returns no candidate and the UI falls to manual entry, never a made-up number. (Task 3)
- ML Kit plugin throws, is missing, or returns text with no 3-7 digit run: selector falls back to the browser engine. (Task 3)
- ML Kit returns digits mixed with letters/units ("ODO 92615 km", "26°C"): only the longest 3-7 digit run is used, and `26` alone yields no candidate. (Task 3)
- Fully white or fully black crop into preprocessing: no division by zero, output stays in 0-255. (Task 2)
- Odometer row in a photo where the narrow window finds a wrong row: wide window wins only when its score is higher. (Task 1)

## File Structure

- Modify `app/utils/initial-crop.ts`: parameterized neutral search + scoring.
- Create `app/utils/ocr-preprocess.ts`: pure RGBA helpers (`applyLocalContrast`, `applyAdaptiveThreshold`).
- Modify `app/utils/odometer-ocr.client.ts`: extra variants; export `recognizeWithBrowser`.
- Create `app/utils/ocr-engine.ts`: pure selector `recognizeWithEngines`.
- Create `app/utils/mlkit-ocr.client.ts`: bridge to the native plugin.
- Modify `app/types/ocr.ts`: add `"mlkit"` method, engine types, bridge types.
- Modify `app/components/MileageCapture.vue`: call the selector; label.
- Create `capacitor/android/.../MlKitOcrPlugin.kt`; modify `MainActivity.kt`, `app/build.gradle`.
- Create tests `tests/ocr-preprocess.test.ts`, `tests/ocr-engine.test.ts`, `tests/unit/utils/mlkit-ocr.test.ts`; fixture `tests/fixtures/odometer-92615.jpg`.
- Modify `.ai/ocr.md`, `.ai/android.md`, `.ai/verification.md`.

---

### Task 1: Crop the odometer on example.jpg

**Files:**
- Create: `tests/fixtures/odometer-92615.jpg` (copy of `example.jpg`)
- Modify: `tests/ocr.test.ts` (the `neutralOdometerTargets` map and the fixture list)
- Modify: `app/utils/initial-crop.ts`

**Interfaces:**
- Consumes: `suggestInitialCrop(image: IRgbaImage): ICropBounds | undefined` (unchanged signature)
- Produces: same signature; internally `suggestNeutralCrop(image, window)` returns `{ bounds: ICropBounds; score: number } | undefined`.

Odometer target in the 1280x1061 photo: digits span about x 772-918, y 618-660 (center x 845, y 639). The "P" (y ~530-600), "26°C" (x 872-985, y 552-600) and "AVERAGE 9.9" must not be the chosen row.

- [ ] **Step 1: Add the fixture and failing test**

```bash
cp example.jpg tests/fixtures/odometer-92615.jpg
```

In `tests/ocr.test.ts` add to `neutralOdometerTargets`:

```ts
  "92615.jpg": { x: 772, y: 618, width: 146, height: 42 },
```

and add `"92615.jpg"` to the `it.each([...])` list in `describe("suggestInitialCrop")`. The existing code already treats `.jpg` as JPEG and uses the containment branch because a target exists. Also add, inside the same `describe`, a test that the crop excludes the temperature row:

```ts
  it("keeps the 92615 crop below the temperature row", () => {
    const source = jpeg.decode(readFileSync(new URL("./fixtures/odometer-92615.jpg", import.meta.url)), { useTArray: true });
    const width = Math.min(720, source.width);
    const height = Math.round(source.height * width / source.width);
    const data = new Uint8ClampedArray(width * height * 4);
    for (let row = 0; row < height; row += 1) for (let column = 0; column < width; column += 1) {
      const s = (Math.floor(row * source.height / height) * source.width + Math.floor(column * source.width / width)) * 4;
      const t = (row * width + column) * 4;
      data.set([source.data[s]!, source.data[s + 1]!, source.data[s + 2]!, 255], t);
    }
    const crop = suggestInitialCrop({ data, width, height })!;
    expect(crop.yPercent).toBeGreaterThan(54);
    expect(crop.yPercent + crop.heightPercent).toBeLessThan(66);
  });
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm exec vitest run tests/ocr.test.ts -t "92615"`
Expected: FAIL (crop undefined or outside the target).

- [ ] **Step 3: Parameterize the neutral search**

In `app/utils/initial-crop.ts` change `suggestNeutralCrop(image)` to
`suggestNeutralCrop(image: IRgbaImage, window: { left: number; right: number; top: number; bottom: number }): { bounds: ICropBounds; score: number } | undefined`.
Replace the four `const left/right/top/bottom` lines with `Math.floor/ceil(image.width * window.left)` etc. Replace each `return undefined;` with `return undefined;` unchanged, and the final `return { xPercent..., heightPercent... }` with `return { bounds: { ...same fields }, score: best.score };`. Add constants:

```ts
const NARROW_NEUTRAL_WINDOW = { left: 0.38, right: 0.64, top: 0.5, bottom: 0.9 };
const WIDE_NEUTRAL_WINDOW = { left: 0.45, right: 0.82, top: 0.45, bottom: 0.8 };
```

Change `suggestInitialCrop` to:

```ts
  const redCrop = suggestRedCrop(image);
  const narrow = suggestNeutralCrop(image, NARROW_NEUTRAL_WINDOW);
  const wide = suggestNeutralCrop(image, WIDE_NEUTRAL_WINDOW);
  const neutral = wide && (!narrow || wide.score > narrow.score) ? wide : narrow;
  const neutralCrop = neutral?.bounds;
  if (redCrop && neutralCrop && redCrop.yPercent < 60 && neutralCrop.yPercent > 55) return neutralCrop;
  return redCrop ?? neutralCrop;
```

The wide window's `centerPenalty` is computed from `image.width * 0.5`; leave it, since a larger penalty for off-center digits only lowers the wide score and keeps narrow-window fixtures stable. If `92615` still fails, tune only the wide window bounds and re-run; do not change the scoring weights, which the existing fixtures depend on.

- [ ] **Step 4: Run all OCR tests**

Run: `pnpm exec vitest run tests/ocr.test.ts`
Expected: PASS for all fixtures including 92615. If a prior fixture regresses, the wide window is winning wrongly: narrow `WIDE_NEUTRAL_WINDOW.left` upward until it passes, and report the final values.

- [ ] **Step 5: Checkpoint** (commit only if the user asks): `feat: detect odometer row on white LCD dashboards`

---

### Task 2: Glare-resistant preprocessing variants

**Files:**
- Create: `app/utils/ocr-preprocess.ts`
- Create: `tests/ocr-preprocess.test.ts`
- Modify: `app/utils/odometer-ocr.client.ts`

**Interfaces:**
- Produces: `applyLocalContrast(gray: Uint8ClampedArray, width: number, height: number, tile?: number): Uint8ClampedArray`; `applyAdaptiveThreshold(gray: Uint8ClampedArray, width: number, height: number, radius?: number, offset?: number): Uint8ClampedArray`. Both take and return single-channel 0-255 arrays of length `width * height`.

- [ ] **Step 1: Write failing tests**

```ts
import { describe, expect, it } from "vitest";
import { applyAdaptiveThreshold, applyLocalContrast } from "~/utils/ocr-preprocess";

describe("applyAdaptiveThreshold", () => {
  it("keeps bright digits on a gradient background", () => {
    const width = 40;
    const height = 20;
    const gray = new Uint8ClampedArray(width * height);
    for (let y = 0; y < height; y += 1) for (let x = 0; x < width; x += 1) gray[y * width + x] = 60 + x * 3;
    for (let y = 8; y < 12; y += 1) for (let x = 30; x < 34; x += 1) gray[y * width + x] = 255;
    const out = applyAdaptiveThreshold(gray, width, height, 5, 10);
    expect(out[10 * width + 31]).toBe(255);
    expect(out[2 * width + 35]).toBe(0);
  });

  it("returns a uniform image for flat input without throwing", () => {
    const out = applyAdaptiveThreshold(new Uint8ClampedArray(100).fill(255), 10, 10);
    expect(new Set(out).size).toBe(1);
  });
});

describe("applyLocalContrast", () => {
  it("stays within 0-255 for all-black and all-white input", () => {
    for (const value of [0, 255]) {
      const out = applyLocalContrast(new Uint8ClampedArray(64).fill(value), 8, 8, 4);
      expect(out).toHaveLength(64);
      expect(Math.min(...out)).toBeGreaterThanOrEqual(0);
      expect(Math.max(...out)).toBeLessThanOrEqual(255);
    }
  });

  it("stretches a low-contrast tile", () => {
    const gray = new Uint8ClampedArray(64);
    for (let i = 0; i < 64; i += 1) gray[i] = 100 + (i % 8) * 4;
    const out = applyLocalContrast(gray, 8, 8, 8);
    expect(Math.max(...out) - Math.min(...out)).toBeGreaterThan(200);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm exec vitest run tests/ocr-preprocess.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement**

```ts
/** Per-tile min/max stretch; tiles are independent so glare in one area does not wash out the rest. */
export function applyLocalContrast(gray: Uint8ClampedArray, width: number, height: number, tile = 32): Uint8ClampedArray {
  const out = new Uint8ClampedArray(gray.length);
  for (let top = 0; top < height; top += tile) {
    for (let left = 0; left < width; left += tile) {
      const bottom = Math.min(height, top + tile);
      const right = Math.min(width, left + tile);
      let minimum = 255;
      let maximum = 0;
      for (let y = top; y < bottom; y += 1) for (let x = left; x < right; x += 1) {
        const value = gray[y * width + x]!;
        if (value < minimum) minimum = value;
        if (value > maximum) maximum = value;
      }
      const range = Math.max(1, maximum - minimum);
      for (let y = top; y < bottom; y += 1) for (let x = left; x < right; x += 1) {
        out[y * width + x] = Math.round((gray[y * width + x]! - minimum) / range * 255);
      }
    }
  }
  return out;
}

/** Pixel is 255 when brighter than its local mean (box window via integral image) plus offset. */
export function applyAdaptiveThreshold(
  gray: Uint8ClampedArray,
  width: number,
  height: number,
  radius = 12,
  offset = 12,
): Uint8ClampedArray {
  const stride = width + 1;
  const integral = new Float64Array(stride * (height + 1));
  for (let y = 0; y < height; y += 1) {
    let rowSum = 0;
    for (let x = 0; x < width; x += 1) {
      rowSum += gray[y * width + x]!;
      integral[(y + 1) * stride + x + 1] = integral[y * stride + x + 1]! + rowSum;
    }
  }
  const out = new Uint8ClampedArray(gray.length);
  for (let y = 0; y < height; y += 1) {
    const y0 = Math.max(0, y - radius);
    const y1 = Math.min(height, y + radius + 1);
    for (let x = 0; x < width; x += 1) {
      const x0 = Math.max(0, x - radius);
      const x1 = Math.min(width, x + radius + 1);
      const sum = integral[y1 * stride + x1]! - integral[y0 * stride + x1]! -
        integral[y1 * stride + x0]! + integral[y0 * stride + x0]!;
      const mean = sum / ((x1 - x0) * (y1 - y0));
      out[y * width + x] = gray[y * width + x]! > mean + offset ? 255 : 0;
    }
  }
  return out;
}
```

- [ ] **Step 4: Run to verify pass**

Run: `pnpm exec vitest run tests/ocr-preprocess.test.ts`
Expected: PASS.

- [ ] **Step 5: Wire into Tesseract variants**

In `app/utils/odometer-ocr.client.ts` import both helpers. Inside `createTesseractVariants`, after the existing `for (const mode of ["gray", "red"] as const)` loop and before `bitmap.close()`, add a third pass that reuses one canvas: draw at `OUTPUT_SCALE`, build a gray `Uint8ClampedArray` from `getImageData`, then for each of `applyLocalContrast(gray, w, h)` and `applyAdaptiveThreshold(gray, w, h)` write the result back as RGBA (value, value, value, 255), `putImageData`, push `toBlob` PNG, and push its inversion the same way the existing loop inverts. Extract a local `async function pushGray(values: Uint8ClampedArray)` to avoid repeating the blob code. Existing variants stay first so ties still prefer them.

- [ ] **Step 6: Typecheck and run tests**

Run: `pnpm exec nuxt typecheck` then `pnpm exec vitest run tests/ocr.test.ts tests/ocr-preprocess.test.ts`
Expected: no type errors; PASS. (The Tesseract worker itself is not exercised in Node; report that.)

- [ ] **Step 7: Checkpoint** (commit only if the user asks): `feat: add glare-resistant OCR variants`

---

### Task 3: Engine interface, selector, and ML Kit bridge

**Files:**
- Modify: `app/types/ocr.ts`
- Create: `app/utils/ocr-engine.ts`, `app/utils/mlkit-ocr.client.ts`
- Create: `tests/ocr-engine.test.ts`, `tests/unit/utils/mlkit-ocr.test.ts`
- Modify: `app/utils/odometer-ocr.client.ts` (export `recognizeWithBrowser`), `app/components/MileageCapture.vue`

**Interfaces:**
- Produces in `app/types/ocr.ts`:

```ts
export type TOcrMethod = "seven-segment" | "tesseract" | "mlkit";
// IOcrResult.method becomes TOcrMethod
export type TOcrEngine = (image: Blob, onProgress?: (progress: IOcrProgress) => void) => Promise<IOcrResult>;
export interface IMlKitOcrBridge {
  isNativePlatform?: () => boolean;
  isPluginAvailable?: (pluginName: string) => boolean;
  nativePromise?: <TResult>(pluginName: string, methodName: string, options: object) => Promise<TResult>;
}
```

- `ocr-engine.ts`: `recognizeWithEngines(image: Blob, engines: TOcrEngine[], onProgress?): Promise<IOcrResult>` runs engines in order and returns the first result with `mileageCandidate !== undefined`; if none has a candidate, returns the last successful result (or rethrows the last error if all threw).
- `mlkit-ocr.client.ts`: `isMlKitAvailable(): boolean`; `recognizeWithMlKit: TOcrEngine`.
- `odometer-ocr.client.ts`: `recognizeWithBrowser: TOcrEngine` (the current `recognizeOdometer` body, renamed); `recognizeOdometer` becomes `(image, onProgress) => recognizeWithEngines(image, isMlKitAvailable() ? [recognizeWithMlKit, recognizeWithBrowser] : [recognizeWithBrowser], onProgress)`.

- [ ] **Step 1: Failing selector tests (`tests/ocr-engine.test.ts`)**

```ts
import { describe, expect, it } from "vitest";
import { recognizeWithEngines } from "~/utils/ocr-engine";
import type { IOcrResult, TOcrEngine } from "~/types/ocr";

const blob = new Blob(["x"]);
const result = (mileageCandidate?: number, method: IOcrResult["method"] = "tesseract"): IOcrResult =>
  ({ rawText: String(mileageCandidate ?? ""), mileageCandidate, confidence: 80, processedImage: blob, method });

describe("recognizeWithEngines", () => {
  it("returns the first engine result that has a candidate", async () => {
    const out = await recognizeWithEngines(blob, [async () => result(92615, "mlkit"), async () => result(1)]);
    expect(out.mileageCandidate).toBe(92615);
  });

  it("falls back when the first engine throws", async () => {
    const failing: TOcrEngine = async () => { throw new Error("native failed"); };
    const out = await recognizeWithEngines(blob, [failing, async () => result(92615)]);
    expect(out.method).toBe("tesseract");
  });

  it("falls back when the first engine finds no digits", async () => {
    const out = await recognizeWithEngines(blob, [async () => result(undefined, "mlkit"), async () => result(92615)]);
    expect(out.mileageCandidate).toBe(92615);
  });

  it("returns a no-candidate result instead of inventing one", async () => {
    const out = await recognizeWithEngines(blob, [async () => result(undefined), async () => result(undefined)]);
    expect(out.mileageCandidate).toBeUndefined();
  });

  it("rethrows when every engine throws", async () => {
    const failing: TOcrEngine = async () => { throw new Error("boom"); };
    await expect(recognizeWithEngines(blob, [failing, failing])).rejects.toThrow("boom");
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm exec vitest run tests/ocr-engine.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement types and selector**

Update `app/types/ocr.ts` as in Interfaces. Create `app/utils/ocr-engine.ts`:

```ts
import type { IOcrProgress, IOcrResult, TOcrEngine } from "~/types/ocr";

export async function recognizeWithEngines(
  image: Blob,
  engines: TOcrEngine[],
  onProgress?: (progress: IOcrProgress) => void,
): Promise<IOcrResult> {
  let fallback: IOcrResult | undefined;
  let lastError: unknown;
  for (const engine of engines) {
    try {
      const result = await engine(image, onProgress);
      if (result.mileageCandidate !== undefined) return result;
      fallback = result;
    } catch (error) {
      lastError = error;
    }
  }
  if (fallback) return fallback;
  throw lastError instanceof Error ? lastError : new Error("The odometer could not be read.");
}
```

- [ ] **Step 4: Run to verify pass**

Run: `pnpm exec vitest run tests/ocr-engine.test.ts`
Expected: PASS.

- [ ] **Step 5: Failing bridge tests (`tests/unit/utils/mlkit-ocr.test.ts`)**

Follow the mocked-bridge style of `tests/unit/utils/image-capture.test.ts` (stub `window.Capacitor` via `vi.stubGlobal("window", { Capacitor: bridge })` and stub `import.meta.client` the same way that file does; read it first and copy its setup). Cases:

```ts
it("is unavailable outside a native platform", () => { /* isNativePlatform false → isMlKitAvailable() === false */ });
it("maps digits from ML Kit text to a mileage candidate", async () => {
  // nativePromise resolves { text: "ODO 92615 km" } → result.mileageCandidate === 92615, method "mlkit"
});
it("ignores a short number such as a temperature", async () => {
  // nativePromise resolves { text: "26°C" } → mileageCandidate undefined
});
it("propagates a native failure so the selector can fall back", async () => {
  // nativePromise rejects → recognizeWithMlKit rejects
});
```

Run: `pnpm exec vitest run tests/unit/utils/mlkit-ocr.test.ts` → FAIL (module not found).

- [ ] **Step 6: Implement the bridge**

`app/utils/mlkit-ocr.client.ts`, following `app/utils/car-widget.client.ts`:

```ts
import type { IMlKitOcrBridge, IOcrResult, TOcrEngine } from "~/types/ocr";
import { extractMileageCandidate } from "~/utils/mileage-text";

const PLUGIN_NAME = "MlKitOcr";

function getBridge(): IMlKitOcrBridge | undefined {
  if (!import.meta.client) return undefined;
  const capacitor = (window as unknown as { Capacitor?: IMlKitOcrBridge }).Capacitor;
  if (!capacitor?.isNativePlatform?.() || !capacitor.isPluginAvailable?.(PLUGIN_NAME) || !capacitor.nativePromise) return undefined;
  return capacitor;
}

export function isMlKitAvailable(): boolean {
  return getBridge() !== undefined;
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("The image could not be read."));
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.readAsDataURL(blob);
  });
}

export const recognizeWithMlKit: TOcrEngine = async (image, onProgress) => {
  const bridge = getBridge();
  if (!bridge?.nativePromise) throw new Error("Native text recognition is unavailable.");
  onProgress?.({ status: "Reading with on-device ML Kit", progress: 0.3 });
  const base64 = await blobToBase64(image);
  const { text } = await bridge.nativePromise<{ text: string }>(PLUGIN_NAME, "recognize", { image: base64 });
  const result: IOcrResult = {
    rawText: text.trim(),
    mileageCandidate: extractMileageCandidate(text),
    confidence: 90,
    processedImage: image,
    method: "mlkit",
  };
  return result;
};
```

Because `extractMileageCandidate` currently lives in `odometer-ocr.client.ts` (which imports tesseract.js), move it unchanged into a new pure file `app/utils/mileage-text.ts`, and re-export it from `odometer-ocr.client.ts` (`export { extractMileageCandidate } from "~/utils/mileage-text";`) so `tests/ocr.test.ts` imports keep working. ML Kit does not report a per-result confidence on the text API, so the fixed 90 is a placeholder-free constant documented in `.ai/ocr.md` (the UI always asks for confirmation).

- [ ] **Step 7: Wire the selector and UI**

In `odometer-ocr.client.ts` rename the existing `recognizeOdometer` to `recognizeWithBrowser` (type `TOcrEngine`) and add the new `recognizeOdometer` described in Interfaces. In `MileageCapture.vue` change the helper line to show `"On-device ML Kit"` when `ocrResult.method === "mlkit"`, `"Digital display reader"` for `seven-segment`, else `"OCR"`. No other component changes; the call site `recognizeOdometer(image, onProgress)` is unchanged.

- [ ] **Step 8: Verify**

Run: `pnpm exec vitest run tests/ocr-engine.test.ts tests/unit/utils/mlkit-ocr.test.ts tests/ocr.test.ts` then `pnpm exec nuxt typecheck`
Expected: PASS, no type errors.

- [ ] **Step 9: Checkpoint** (commit only if the user asks): `feat: add OCR engine selection and ML Kit bridge`

---

### Task 4: Native ML Kit plugin

**Files:**
- Create: `capacitor/android/app/src/main/java/com/afshar/carservicetracker/MlKitOcrPlugin.kt`
- Modify: `capacitor/android/app/src/main/java/com/afshar/carservicetracker/MainActivity.kt`
- Modify: `capacitor/android/app/build.gradle`

**Interfaces:**
- Consumes: web bridge call `nativePromise("MlKitOcr", "recognize", { image: <base64 string> })`.
- Produces: resolves `{ text: string }` (full recognized text, may be empty); rejects with a message on invalid input or recognition failure.

- [ ] **Step 1: Add the dependency**

In `capacitor/android/app/build.gradle` `dependencies { ... }` add:

```groovy
    implementation "com.google.mlkit:text-recognition:16.0.1"
```

(bundled Latin model; no Play Services model download).

- [ ] **Step 2: Create the plugin**

```kotlin
package com.afshar.carservicetracker

import android.graphics.BitmapFactory
import android.util.Base64
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.text.TextRecognition
import com.google.mlkit.vision.text.latin.TextRecognizerOptions

@CapacitorPlugin(name = "MlKitOcr")
class MlKitOcrPlugin : Plugin() {
    private val recognizer by lazy { TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS) }

    @PluginMethod
    fun recognize(call: PluginCall) {
        val encoded = call.getString("image") ?: run {
            call.reject("Missing image")
            return
        }
        val bitmap = try {
            val bytes = Base64.decode(encoded, Base64.DEFAULT)
            BitmapFactory.decodeByteArray(bytes, 0, bytes.size)
        } catch (error: IllegalArgumentException) {
            null
        } ?: run {
            call.reject("The image could not be decoded")
            return
        }
        recognizer.process(InputImage.fromBitmap(bitmap, 0))
            .addOnSuccessListener { result ->
                call.resolve(JSObject().put("text", result.text))
            }
            .addOnFailureListener { error ->
                call.reject("Text recognition failed", error as? Exception)
            }
    }

    override fun handleOnDestroy() {
        recognizer.close()
        super.handleOnDestroy()
    }
}
```

- [ ] **Step 3: Register it**

In `MainActivity.kt` add `registerPlugin(MlKitOcrPlugin::class.java)` before `super.onCreate(...)`.

- [ ] **Step 4: Build**

Run: `pnpm --dir capacitor sync` then, from `capacitor/android`, `gradle --no-daemon assembleDebug`.
Expected: BUILD SUCCESSFUL. If the JDK/SDK/Gradle toolchain from `docs/android-widget.md` is missing, say so plainly and report the build as not run; do not claim native compilation. A successful `sync` is not compilation.

- [ ] **Step 5: Checkpoint** (commit only if the user asks): `feat: add native ML Kit OCR plugin`

---

### Task 5: Engine comparison and docs

**Files:**
- Modify: `.ai/ocr.md`, `.ai/android.md`, `.ai/verification.md`

The spec's "dev-only comparison script" is replaced by a manual checklist: ML Kit only runs on a device, so a Node script cannot compare the engines.

- [ ] **Step 1: Document the pipeline change in `.ai/ocr.md`**

Update the source map (new files `ocr-preprocess.ts`, `ocr-engine.ts`, `mlkit-ocr.client.ts`, `mileage-text.ts`), the recognition pipeline (Android: ML Kit first, then existing seven-segment/Tesseract path; PWA unchanged; extra local-contrast/adaptive-threshold variants), the crop section (narrow and wide neutral windows, higher score wins), and the fixtures list (`odometer-92615.jpg` = 92615 km, a copy of the user's `example.jpg`). State that ML Kit confidence is a fixed constant and the user always confirms.

- [ ] **Step 2: Document the plugin in `.ai/android.md`**

Add `MlKitOcrPlugin.kt` to the native sources list and the bridge contract (`recognize({ image: base64 }) → { text }`), the bundled-model APK-size note (about 4 MB), and that no network permission or Play Services model download is used.

- [ ] **Step 3: Add the manual comparison checklist to `.ai/verification.md`**

Add under "Coverage gaps and manual checks": on a device or emulator build, photograph or pick `example.jpg`, a red/orange dashboard, and 3+ real photos in varied light; record for each the ML Kit result, the browser-engine result (test in a mobile browser/PWA), and the true odometer value; ML Kit must be at least as accurate as the browser engine before it stays first in the selector. Add the new test files to the existing-coverage list. State that ML Kit accuracy is not covered by Node tests.

- [ ] **Step 4: Full verification**

Run: `pnpm test`, `pnpm exec nuxt typecheck`, `pnpm generate`.
Expected: all pass. Report separately which manual/native checks were not run.

- [ ] **Step 5: Verify doc claims**

Confirm every path named in the docs exists (`Glob`/`ls`) and that no placeholder text remains.

- [ ] **Step 6: Checkpoint** (commit only if the user asks): `docs: document OCR engines and verification`
