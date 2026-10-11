import type { IOcrProgress, IOcrResult, TOcrEngine } from "~/types/ocr";

/** Runs engines in order and returns the first result with a mileage candidate. */
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
