import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getImageCaptureError,
  isNativeImageCapture,
  MAX_IMAGE_BYTES,
  selectNativeImage,
  validateSelectedImage,
} from "~/utils/image-capture.client";

afterEach(() => vi.unstubAllGlobals());

describe("selected image validation", () => {
  it("accepts images at the 15 MiB limit", () => {
    expect(validateSelectedImage(new Blob([new Uint8Array(MAX_IMAGE_BYTES)], { type: "image/jpeg" }))).toBeUndefined();
  });
  it("rejects images over the limit", () => {
    expect(validateSelectedImage(new Blob([new Uint8Array(MAX_IMAGE_BYTES + 1)], { type: "image/png" }))).toContain("15 MB");
  });
  it("rejects non-images", () => {
    expect(validateSelectedImage(new Blob(["text"], { type: "text/plain" }))).toContain("image file");
  });
});

describe("native image selection", () => {
  function setup(photo = { webPath: "https://localhost/_capacitor_file_/cache/photo.jpg" }) {
    const nativePromise = vi.fn().mockResolvedValue(photo);
    vi.stubGlobal("window", {
      location: { href: "https://localhost/", origin: "https://localhost" },
      Capacitor: { isNativePlatform: () => true, isPluginAvailable: () => true, nativePromise },
    });
    const image = new Blob(["image"], { type: "image/jpeg" });
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, blob: async () => image });
    vi.stubGlobal("fetch", fetchMock);
    return { nativePromise, image, fetchMock };
  }

  it("leaves non-native browsers on the file-input path", () => {
    vi.stubGlobal("window", {});
    expect(isNativeImageCapture()).toBe(false);
  });
  it("requests the rear camera without a source prompt or gallery save", async () => {
    const { nativePromise, image } = setup();
    expect(await selectNativeImage("camera")).toBe(image);
    expect(nativePromise).toHaveBeenCalledWith("Camera", "getPhoto", {
      source: "CAMERA", direction: "REAR", resultType: "uri", quality: 100,
      allowEditing: false, saveToGallery: false,
    });
  });
  it("requests only the photo library", async () => {
    const { nativePromise } = setup();
    await selectNativeImage("library");
    expect(nativePromise.mock.calls[0]?.[2].source).toBe("PHOTOS");
  });
  it("can request the same photo again", async () => {
    const { nativePromise } = setup();
    await selectNativeImage("library");
    await selectNativeImage("library");
    expect(nativePromise).toHaveBeenCalledTimes(2);
  });
  it("does not fetch remote photo URLs", async () => {
    const { fetchMock } = setup({ webPath: "https://example.com/photo.jpg" });
    await expect(selectNativeImage("camera")).rejects.toThrow("device-local");
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("reports a missing native plugin rather than opening the gallery", async () => {
    vi.stubGlobal("window", { Capacitor: { isNativePlatform: () => true, isPluginAvailable: () => false } });
    await expect(selectNativeImage("camera")).rejects.toThrow("unavailable");
  });
  it("reports a local file read failure", async () => {
    setup();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));
    await expect(selectNativeImage("library")).rejects.toThrow("could not be loaded");
  });
  it("allows retry after cancellation without reading a photo", async () => {
    const { nativePromise, fetchMock } = setup();
    nativePromise.mockRejectedValueOnce({ message: "User cancelled photos app" });
    await expect(selectNativeImage("camera")).rejects.toEqual({ message: "User cancelled photos app" });
    expect(fetchMock).not.toHaveBeenCalled();
    await selectNativeImage("camera");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("picker errors", () => {
  it.each(["User cancelled photos app", "User cancelled camera app", "No image picked"])("silently handles %s", message => {
    expect(getImageCaptureError({ message })).toBeUndefined();
  });
  it("offers recovery after permission denial", () => {
    expect(getImageCaptureError(new Error("Unable to access camera"))).toContain("Android settings");
  });
  it("offers recovery after other errors", () => {
    expect(getImageCaptureError(new Error("No camera activity"))).toContain("try again");
  });
});
