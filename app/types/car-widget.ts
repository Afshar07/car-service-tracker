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

export interface ICarWidgetPlugin {
  update(options: ICarWidgetState): Promise<void>;
  requestPin(): Promise<ICarWidgetPinResult>;
}

export interface ICapacitorWidgetBridge {
  isNativePlatform?: () => boolean;
  Plugins?: {
    CarWidget?: ICarWidgetPlugin;
  };
}
