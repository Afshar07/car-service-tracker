import { afterEach, describe, expect, it, vi } from "vitest";
import { isMlKitAvailable, recognizeWithMlKit } from "~/utils/mlkit-ocr.client";

afterEach(() => vi.unstubAllGlobals());

function stubBridge(nativePromise: ReturnType<typeof vi.fn>, native = true) {
  vi.stubGlobal("window", {
    Capacitor: { isNativePlatform: () => native, isPluginAvailable: () => true, nativePromise },
  });
}

const image = new Blob(["image"], { type: "image/png" });

describe("ML Kit OCR bridge", () => {
  it("is unavailable outside a native platform", () => {
    stubBridge(vi.fn(), false);
    expect(isMlKitAvailable()).toBe(false);
    vi.stubGlobal("window", {});
    expect(isMlKitAvailable()).toBe(false);
  });

  it("maps digits from ML Kit text to a mileage candidate", async () => {
    const nativePromise = vi.fn().mockResolvedValue({ text: "ODO 92615 km" });
    stubBridge(nativePromise);
    const result = await recognizeWithMlKit(image);
    expect(result.mileageCandidate).toBe(92615);
    expect(result.method).toBe("mlkit");
    expect(nativePromise).toHaveBeenCalledWith("MlKitOcr", "recognize", { image: expect.any(String) });
  });

  it("ignores a short number such as a temperature", async () => {
    stubBridge(vi.fn().mockResolvedValue({ text: "26°C" }));
    expect((await recognizeWithMlKit(image)).mileageCandidate).toBeUndefined();
  });

  it("propagates a native failure so the selector can fall back", async () => {
    stubBridge(vi.fn().mockRejectedValue(new Error("native failed")));
    await expect(recognizeWithMlKit(image)).rejects.toThrow("native failed");
  });
});
