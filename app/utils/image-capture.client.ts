import type { ICameraPhoto, ICameraWindow, TImageSource } from "~/types/image-capture";

export const MAX_IMAGE_BYTES = 15 * 1024 * 1024;

export function validateSelectedImage(image: Blob): string | undefined {
  if (!image.type.startsWith("image/")) {
    return "Please choose an image file (JPG, PNG, or HEIC).";
  }
  if (image.size > MAX_IMAGE_BYTES) {
    return "That image is too large. Please choose a photo smaller than 15 MB.";
  }
  return undefined;
}

function getBridge() {
  return typeof window === "undefined" ? undefined : (window as unknown as ICameraWindow).Capacitor;
}

export function isNativeImageCapture(): boolean {
  return getBridge()?.isNativePlatform?.() === true;
}

export function getImageCaptureError(error: unknown): string | undefined {
  const message = error instanceof Error ? error.message
    : typeof error === "object" && error !== null && "message" in error ? String(error.message) : "";
  if (/cancel(?:led|ed|lation)?|no image picked/i.test(message)) return undefined;
  if (/permission|denied|access/i.test(message)) {
    return "Photo access was denied. Allow access in Android settings, then try again, or enter mileage manually.";
  }
  return "Could not open the photo. Please try again, choose from your library, or enter mileage manually.";
}

export async function selectNativeImage(source: TImageSource): Promise<Blob> {
  const bridge = getBridge();
  if (!bridge?.isNativePlatform?.() || !bridge.isPluginAvailable?.("Camera") || !bridge.nativePromise) {
    throw new Error("Native Camera plugin is unavailable.");
  }
  const photo = await bridge.nativePromise<ICameraPhoto>("Camera", "getPhoto", {
    source: source === "camera" ? "CAMERA" : "PHOTOS",
    direction: "REAR",
    resultType: "uri",
    saveToGallery: false,
    allowEditing: false,
    quality: 100,
  });
  if (!photo.webPath) throw new Error("The selected photo has no local path.");
  // Only read the plugin's device-local URL, never a remote image endpoint.
  const url = new URL(photo.webPath, window.location.href);
  if (url.origin !== window.location.origin || !url.pathname.startsWith("/_capacitor_file_/")) {
    throw new Error("The selected photo is not a device-local file.");
  }
  const response = await fetch(url.href);
  if (!response.ok) throw new Error("The selected photo could not be loaded.");
  return response.blob();
}
