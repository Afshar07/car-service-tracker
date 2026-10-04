import { afterEach, describe, expect, it, vi } from "vitest";
import { exportMileageJson, readNativeMileageBackup, requestPersistentMileageStorage, writeNativeMileageBackup } from "~/utils/mileage-backup.client";

afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

function native() {
  const nativePromise = vi.fn().mockResolvedValue({ json: "backup" });
  vi.stubGlobal("window", { Capacitor: { isNativePlatform: () => true, isPluginAvailable: () => true, nativePromise } });
  return nativePromise;
}

describe("mileage storage and export bridge", () => {
  it("reads and writes the native backup", async () => {
    const bridge = native();
    expect(await readNativeMileageBackup()).toBe("backup");
    await writeNativeMileageBackup("new backup");
    expect(bridge).toHaveBeenCalledWith("MileageBackup", "read", {});
    expect(bridge).toHaveBeenCalledWith("MileageBackup", "write", { json: "new backup" });
  });

  it("opens the native share sheet for JSON instead of a WebView blob download", async () => {
    const bridge = native();
    await exportMileageJson("{}");
    expect(bridge).toHaveBeenCalledWith("MileageBackup", "share", {
      json: "{}", filename: expect.stringMatching(/^mileage-history[-0-9TZ]+\.json$/),
    });
  });

  it("does not hide native export failures", async () => {
    native().mockRejectedValue(new Error("share failed"));
    await expect(exportMileageJson("{}")).rejects.toThrow("share failed");
  });

  it("downloads browser JSON and releases its object URL", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("window", {});
    const link = { click: vi.fn(), remove: vi.fn(), href: "", download: "" };
    vi.stubGlobal("document", { createElement: () => link, body: { appendChild: vi.fn() } });
    const createObjectURL = vi.fn().mockReturnValue("blob:backup");
    const revokeObjectURL = vi.fn();
    vi.stubGlobal("URL", { createObjectURL, revokeObjectURL });
    await exportMileageJson('{"readings":[]}');
    const blob = createObjectURL.mock.calls[0]![0] as Blob;
    expect(blob.type).toBe("application/json");
    expect(await blob.text()).toBe('{"readings":[]}');
    expect(link.click).toHaveBeenCalledOnce();
    expect(link.remove).toHaveBeenCalledOnce();
    await vi.runAllTimersAsync();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:backup");
  });

  it("tolerates unsupported or denied persistent browser storage", async () => {
    vi.stubGlobal("navigator", {});
    await expect(requestPersistentMileageStorage()).resolves.toBeUndefined();
    const persist = vi.fn().mockRejectedValue(new Error("denied"));
    vi.stubGlobal("navigator", { storage: { persist } });
    await expect(requestPersistentMileageStorage()).resolves.toBeUndefined();
    expect(persist).toHaveBeenCalledOnce();
  });
});
