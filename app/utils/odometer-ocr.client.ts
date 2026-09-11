import { createWorker, PSM } from "tesseract.js";
import type { IOcrProgress, IOcrResult } from "~/types/ocr";
import { createSevenSegmentMask, decodeSevenSegmentImage } from "~/utils/seven-segment-ocr";

const OUTPUT_SCALE = 3;

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
  let brightnessTotal = 0;

  for (let index = 0; index < pixels.length; index += 4) {
    const brightness = pixels[index]! * 0.299 + pixels[index + 1]! * 0.587 + pixels[index + 2]! * 0.114;
    brightnessTotal += brightness;
  }

  const averageBrightness = brightnessTotal / (pixels.length / 4);
  const threshold = Math.max(70, Math.min(190, averageBrightness));

  for (let index = 0; index < pixels.length; index += 4) {
    const brightness = pixels[index]! * 0.299 + pixels[index + 1]! * 0.587 + pixels[index + 2]! * 0.114;
    const value = brightness >= threshold ? 255 : 0;
    pixels[index] = value;
    pixels[index + 1] = value;
    pixels[index + 2] = value;
  }

  context.putImageData(image, 0, 0);
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Image preprocessing failed."))), "image/png");
  });
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

export function extractMileageCandidate(text: string): number | undefined {
  const candidates = text.match(/\d{3,7}/g)?.map(Number).filter(Number.isSafeInteger) ?? [];
  return candidates.sort((first, second) => second.toString().length - first.toString().length)[0];
}

export async function recognizeOdometer(
  croppedImage: Blob,
  onProgress?: (progress: IOcrProgress) => void,
): Promise<IOcrResult> {
  onProgress?.({ status: "Checking digital display", progress: 0.1 });
  const sevenSegmentResult = await recognizeSevenSegment(croppedImage);
  if (sevenSegmentResult && sevenSegmentResult.confidence >= 65) return sevenSegmentResult;

  const processedImage = await preprocessOdometerImage(croppedImage);
  const worker = await createWorker("eng", 1, {
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
    const result = await worker.recognize(processedImage);
    return {
      rawText: result.data.text.trim(),
      mileageCandidate: extractMileageCandidate(result.data.text),
      confidence: result.data.confidence,
      processedImage,
      method: "tesseract",
    };
  } finally {
    await worker.terminate();
  }
}
