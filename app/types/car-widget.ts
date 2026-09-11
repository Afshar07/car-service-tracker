import type { TServiceStatus } from "~/types/car";

export interface ICarWidgetState {
  estimatedMileageKm?: number;
  remainingKm?: number;
  status: TServiceStatus;
  updatedAt: string;
}

export interface ICarWidgetPinResult {
  supported: boolean;
  requested: boolean;
}

export interface ICarWidgetStatus {
  isAdded: boolean;
  widgetCount: number;
}

export interface ICapacitorWidgetBridge {
  isNativePlatform?: () => boolean;
  isPluginAvailable?: (pluginName: string) => boolean;
  nativePromise?: <TResult>(
    pluginName: string,
    methodName: string,
    options: object,
  ) => Promise<TResult>;
}
