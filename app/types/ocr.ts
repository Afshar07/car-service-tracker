export interface IOcrProgress {
  status: string;
  progress: number;
}

export type TOcrMethod = "seven-segment" | "tesseract" | "mlkit";

export interface IOcrResult {
  rawText: string;
  mileageCandidate?: number;
  confidence: number;
  processedImage: Blob;
  method: TOcrMethod;
}

export interface ISevenSegmentResult {
  text: string;
  confidence: number;
}

export interface ICropBounds {
  xPercent: number;
  yPercent: number;
  widthPercent: number;
  heightPercent: number;
}

export type TOcrEngine = (image: Blob, onProgress?: (progress: IOcrProgress) => void) => Promise<IOcrResult>;

export interface IMlKitOcrBridge {
  isNativePlatform?: () => boolean;
  isPluginAvailable?: (pluginName: string) => boolean;
  nativePromise?: <TResult>(pluginName: string, methodName: string, options: object) => Promise<TResult>;
}
