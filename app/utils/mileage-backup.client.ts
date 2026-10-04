import type { ICapacitorWidgetBridge } from "~/types/car-widget";

function getBridge(): ICapacitorWidgetBridge | undefined {
  if (typeof window === "undefined") return;
  const bridge = (window as unknown as { Capacitor?: ICapacitorWidgetBridge }).Capacitor;
  if (bridge?.isNativePlatform?.() && bridge.isPluginAvailable?.("MileageBackup") && bridge.nativePromise) return bridge;
}

export async function readNativeMileageBackup(): Promise<string | undefined> {
  const result = await getBridge()?.nativePromise?.<{ json?: string }>("MileageBackup", "read", {});
  return result?.json;
}

export async function writeNativeMileageBackup(json: string): Promise<void> {
  await getBridge()?.nativePromise?.("MileageBackup", "write", { json });
}

export async function requestPersistentMileageStorage(): Promise<void> {
  if (typeof navigator === "undefined" || !navigator.storage?.persist) return;
  try {
    await navigator.storage.persist();
  }
  catch {
    // Storage retention is best-effort; exported backups remain available.
  }
}

export async function exportMileageJson(json: string): Promise<void> {
  const filename = `mileage-history-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
  const bridge = getBridge();
  if (bridge?.nativePromise) {
    await bridge.nativePromise("MileageBackup", "share", { json, filename });
    return;
  }
  const url = URL.createObjectURL(new Blob([json], { type: "application/json" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
