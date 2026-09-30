export type TImageSource = "camera" | "library";

export interface ICameraPhoto {
  webPath?: string;
}

export interface ICameraOptions {
  source: "CAMERA" | "PHOTOS";
  direction: "REAR";
  resultType: "uri";
  saveToGallery: false;
  allowEditing: false;
  quality: number;
}

export interface ICapacitorCameraBridge {
  isNativePlatform?: () => boolean;
  isPluginAvailable?: (name: string) => boolean;
  nativePromise?: <TResult>(name: string, method: string, options: ICameraOptions) => Promise<TResult>;
}

export interface ICameraWindow {
  Capacitor?: ICapacitorCameraBridge;
}
