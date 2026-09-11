import type {
  ICapacitorWidgetBridge,
  ICarWidgetPinResult,
  ICarWidgetState,
} from "~/types/car-widget";

function getWidgetPlugin() {
  if (!import.meta.client) return undefined;
  const capacitor = (window as unknown as { Capacitor?: ICapacitorWidgetBridge }).Capacitor;
  if (!capacitor?.isNativePlatform?.()) return undefined;
  return capacitor.Plugins?.CarWidget;
}

export function isNativeWidgetAvailable(): boolean {
  return getWidgetPlugin() !== undefined;
}

export async function updateCarWidget(state: ICarWidgetState): Promise<void> {
  const plugin = getWidgetPlugin();
  if (!plugin) return;

  try {
    await plugin.update(state);
  }
  catch (error) {
    console.warn("Could not update the Android car widget.", error);
  }
}

export async function requestCarWidgetPin(): Promise<ICarWidgetPinResult> {
  const plugin = getWidgetPlugin();
  if (!plugin) return { supported: false, requested: false };
  return plugin.requestPin();
}
