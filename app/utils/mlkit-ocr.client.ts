import type { IMlKitOcrBridge, TOcrEngine } from "~/types/ocr";
import { extractMlKitMileage } from "~/utils/mileage-text";

const PLUGIN_NAME = "MlKitOcr";

function getBridge(): IMlKitOcrBridge | undefined {
  if (typeof window === "undefined") return undefined;
  const capacitor = (window as unknown as { Capacitor?: IMlKitOcrBridge }).Capacitor;
  if (!capacitor?.isNativePlatform?.() || !capacitor.isPluginAvailable?.(PLUGIN_NAME) || !capacitor.nativePromise) {
    return undefined;
  }
  return capacitor;
}

export function isMlKitAvailable(): boolean {
  return getBridge() !== undefined;
}

async function blobToBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  return btoa(binary);
}

/** On-device Google ML Kit text recognition. ML Kit reports no text confidence, so the value is fixed. */
export const recognizeWithMlKit: TOcrEngine = async (image, onProgress) => {
  const bridge = getBridge();
  if (!bridge?.nativePromise) throw new Error("Native text recognition is unavailable.");
  onProgress?.({ status: "Reading with on-device ML Kit", progress: 0.3 });
  const { text } = await bridge.nativePromise<{ text: string }>(PLUGIN_NAME, "recognize", {
    image: await blobToBase64(image),
  });
  return {
    rawText: text.trim(),
    mileageCandidate: extractMlKitMileage(text),
    confidence: 90,
    processedImage: image,
    method: "mlkit",
  };
};
