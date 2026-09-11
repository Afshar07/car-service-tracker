import type {
  ICapacitorWidgetBridge,
  ICarWidgetPinResult,
  ICarWidgetState,
} from "~/types/car-widget";

const PLUGIN_NAME = "CarWidget";

function getCapacitorBridge(): ICapacitorWidgetBridge | undefined {
  if (!import.meta.client) return undefined;

  const capacitor = (window as unknown as {
    Capacitor?: ICapacitorWidgetBridge;
  }).Capacitor;

  if (
    !capacitor?.isNativePlatform?.()
    || !capacitor.isPluginAvailable?.(PLUGIN_NAME)
    || !capacitor.nativePromise
  ) {
    return undefined;
  }

  return capacitor;
}

export function isNativeWidgetAvailable(): boolean {
  return getCapacitorBridge() !== undefined;
}

export async function updateCarWidget(state: ICarWidgetState): Promise<void> {
  const capacitor = getCapacitorBridge();
  if (!capacitor?.nativePromise) return;

  try {
    await capacitor.nativePromise<void>(PLUGIN_NAME, "update", state);
  }
  catch (error) {
    console.warn("Could not update the Android car widget.", error);
  }
}

export async function requestCarWidgetPin(): Promise<ICarWidgetPinResult> {
  const capacitor = getCapacitorBridge();
  if (!capacitor?.nativePromise) {
    return { supported: false, requested: false };
  }

  return capacitor.nativePromise<ICarWidgetPinResult>(
    PLUGIN_NAME,
    "requestPin",
    {},
  );
}
