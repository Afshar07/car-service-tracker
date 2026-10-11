import { createWorker, PSM } from "tesseract.js";
import type { IOcrProgress, IOcrResult, TOcrEngine } from "~/types/ocr";
import { extractMileageCandidate } from "~/utils/mileage-text";
import { isMlKitAvailable, recognizeWithMlKit } from "~/utils/mlkit-ocr.client";
import { recognizeWithEngines } from "~/utils/ocr-engine";
import { applyAdaptiveThreshold, applyLocalContrast } from "~/utils/ocr-preprocess";
import { createSevenSegmentMask, decodeSevenSegmentImage } from "~/utils/seven-segment-ocr";

const OUTPUT_SCALE = 3;
const GLARE_MAX_EDGE = 1500;

interface ITesseractAttempt {
  text: string;
  confidence: number;
  processedImage: Blob;
  mileageCandidate?: number;
}

export async function preprocessOdometerImage(source: Blob): Promise<Blob> {
  const bitmap = await createImageBitmap(source);
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width * OUTPUT_SCALE;
  canvas.height = bitmap.height * OUTPUT_SCALE;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("Canvas processing is unavailable in this browser.");

  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  const image = context.getImageData(0, 0, canvas.width, canvas.height);
  const pixels = image.data;
  let minimum = 255;
  let maximum = 0;

  for (let index = 0; index < pixels.length; index += 4) {
    const brightness = pixels[index]! * 0.299 + pixels[index + 1]! * 0.587 + pixels[index + 2]! * 0.114;
    minimum = Math.min(minimum, brightness);
    maximum = Math.max(maximum, brightness);
  }

  for (let index = 0; index < pixels.length; index += 4) {
    const brightness = pixels[index]! * 0.299 + pixels[index + 1]! * 0.587 + pixels[index + 2]! * 0.114;
    const value = Math.round(((brightness - minimum) / Math.max(1, maximum - minimum)) * 255);
    pixels[index] = value;
    pixels[index + 1] = value;
    pixels[index + 2] = value;
  }

  context.putImageData(image, 0, 0);
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Image preprocessing failed."))), "image/png");
  });
}

async function createTesseractVariants(source: Blob): Promise<Blob[]> {
  const bitmap = await createImageBitmap(source);
  const variants: Blob[] = [];
  for (const mode of ["gray", "red"] as const) {
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width * OUTPUT_SCALE;
    canvas.height = bitmap.height * OUTPUT_SCALE;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) continue;
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const image = context.getImageData(0, 0, canvas.width, canvas.height);
    let minimum = 255;
    let maximum = 0;
    for (let index = 0; index < image.data.length; index += 4) {
      const value = mode === "red" ? image.data[index]! :
        image.data[index]! * 0.299 + image.data[index + 1]! * 0.587 + image.data[index + 2]! * 0.114;
      minimum = Math.min(minimum, value);
      maximum = Math.max(maximum, value);
    }
    for (let index = 0; index < image.data.length; index += 4) {
      const value = mode === "red" ? image.data[index]! :
        image.data[index]! * 0.299 + image.data[index + 1]! * 0.587 + image.data[index + 2]! * 0.114;
      const normalized = Math.round(((value - minimum) / Math.max(1, maximum - minimum)) * 255);
      image.data[index] = normalized;
      image.data[index + 1] = normalized;
      image.data[index + 2] = normalized;
      image.data[index + 3] = 255;
    }
    context.putImageData(image, 0, 0);
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((result) => result ? resolve(result) : reject(new Error("Image preprocessing failed.")), "image/png"));
    variants.push(blob);
    const inverted = new ImageData(new Uint8ClampedArray(image.data), image.width, image.height);
    for (let index = 0; index < inverted.data.length; index += 4) {
      const value = 255 - inverted.data[index]!;
      inverted.data[index] = value;
      inverted.data[index + 1] = value;
      inverted.data[index + 2] = value;
    }
    context.putImageData(inverted, 0, 0);
    variants.push(await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((result) => result ? resolve(result) : reject(new Error("Image preprocessing failed.")), "image/png")));
  }
  variants.push(...await createGlareVariants(bitmap));
  bitmap.close();
  return variants;
}

/** Local-contrast and adaptive-threshold variants (plus inversions) for uneven lighting and glare. */
async function createGlareVariants(bitmap: ImageBitmap): Promise<Blob[]> {
  // Work near the crop's own resolution (long edge capped) so a full-frame photo cannot exhaust memory.
  const scale = Math.min(OUTPUT_SCALE, GLARE_MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return [];
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const image = context.getImageData(0, 0, canvas.width, canvas.height);
  const gray = new Uint8ClampedArray(canvas.width * canvas.height);
  for (let pixel = 0; pixel < gray.length; pixel += 1) {
    const index = pixel * 4;
    gray[pixel] = image.data[index]! * 0.299 + image.data[index + 1]! * 0.587 + image.data[index + 2]! * 0.114;
  }
  // The threshold window must exceed a digit's stroke width, so it follows the crop height.
  const radius = Math.max(4, Math.round(canvas.height / 4));

  const blobs: Blob[] = [];
  const pushGray = async (values: Uint8ClampedArray, invert: boolean): Promise<void> => {
    const output = new ImageData(canvas.width, canvas.height);
    for (let pixel = 0; pixel < values.length; pixel += 1) {
      const value = invert ? 255 - values[pixel]! : values[pixel]!;
      const index = pixel * 4;
      output.data[index] = value;
      output.data[index + 1] = value;
      output.data[index + 2] = value;
      output.data[index + 3] = 255;
    }
    context.putImageData(output, 0, 0);
    blobs.push(await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((result) => result ? resolve(result) : reject(new Error("Image preprocessing failed.")), "image/png")));
  };
  for (const values of [
    applyLocalContrast(gray, canvas.width, canvas.height),
    applyAdaptiveThreshold(gray, canvas.width, canvas.height, radius),
  ]) {
    await pushGray(values, false);
    await pushGray(values, true);
  }
  return blobs;
}

async function recognizeSevenSegment(source: Blob): Promise<IOcrResult | undefined> {
  const bitmap = await createImageBitmap(source);
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return undefined;
  context.drawImage(bitmap, 0, 0);
  bitmap.close();
  const image = context.getImageData(0, 0, canvas.width, canvas.height);
  const decoded = decodeSevenSegmentImage(image);
  if (!decoded) return undefined;

  const mask = createSevenSegmentMask(image);
  for (let pixel = 0; pixel < mask.length; pixel += 1) {
    const value = mask[pixel] ? 255 : 0;
    const index = pixel * 4;
    image.data[index] = value;
    image.data[index + 1] = value;
    image.data[index + 2] = value;
    image.data[index + 3] = 255;
  }
  context.putImageData(image, 0, 0);
  const processedImage = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("Image preprocessing failed.")), "image/png");
  });
  return {
    rawText: decoded.text,
    mileageCandidate: Number(decoded.text),
    confidence: decoded.confidence,
    processedImage,
    method: "seven-segment",
  };
}

async function recognizeBrowser(
  croppedImage: Blob,
  onProgress?: (progress: IOcrProgress) => void,
): Promise<IOcrResult> {
  onProgress?.({ status: "Checking digital display", progress: 0.1 });
  const sevenSegmentResult = await recognizeSevenSegment(croppedImage);
  if (sevenSegmentResult && sevenSegmentResult.confidence >= 65) return sevenSegmentResult;

  const worker = await createWorker("eng", 1, {
    workerPath: "/ocr/worker.min.js",
    corePath: "/ocr/core",
    langPath: "/ocr/lang",
    gzip: true,
    logger(message) {
      onProgress?.({ status: message.status, progress: message.progress });
    },
  });

  try {
    await worker.setParameters({
      tessedit_char_whitelist: "0123456789",
      tessedit_pageseg_mode: PSM.SINGLE_LINE,
      preserve_interword_spaces: "0",
    });
    const variants = await createTesseractVariants(croppedImage);
    let best: ITesseractAttempt | undefined;
    for (const variant of variants) {
      const result = await worker.recognize(variant);
      const text = result.data.text.trim();
      const attempt: ITesseractAttempt = {
        text,
        confidence: result.data.confidence,
        processedImage: variant,
        mileageCandidate: extractMileageCandidate(text),
      };
      const attemptLength = attempt.mileageCandidate?.toString().length ?? 0;
      const bestLength = best?.mileageCandidate?.toString().length ?? 0;
      if (!best || attemptLength > bestLength ||
        (attemptLength === bestLength && attempt.confidence > best.confidence)) {
        best = attempt;
      }
    }
    if (!best) throw new Error("Image preprocessing is unavailable in this browser.");
    return {
      rawText: best.text,
      mileageCandidate: best.mileageCandidate,
      confidence: best.confidence,
      processedImage: best.processedImage,
      method: "tesseract",
    };
  } finally {
    await worker.terminate();
  }
}

export { extractMileageCandidate };

export const recognizeWithBrowser: TOcrEngine = recognizeBrowser;

/** The seven-segment reader only answers when confident, so red/orange displays never reach ML Kit. */
export const recognizeWithSevenSegment: TOcrEngine = async (croppedImage, onProgress) => {
  onProgress?.({ status: "Checking digital display", progress: 0.1 });
  const result = await recognizeSevenSegment(croppedImage);
  if (!result || result.confidence < 65) throw new Error("No digital display detected.");
  return result;
};

export function getOcrEngines(nativeAvailable: boolean): TOcrEngine[] {
  return nativeAvailable
    ? [recognizeWithSevenSegment, recognizeWithMlKit, recognizeWithBrowser]
    : [recognizeWithBrowser];
}

/** Android uses on-device ML Kit first; the browser engine is the fallback and the PWA's only engine. */
export function recognizeOdometer(
  croppedImage: Blob,
  onProgress?: (progress: IOcrProgress) => void,
): Promise<IOcrResult> {
  return recognizeWithEngines(croppedImage, getOcrEngines(isMlKitAvailable()), onProgress);
}
