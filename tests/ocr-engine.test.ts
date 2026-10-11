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
