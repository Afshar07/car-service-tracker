export interface IOcrProgress {
  status: string;
  progress: number;
}

export interface IOcrResult {
  rawText: string;
  mileageCandidate?: number;
  confidence: number;
  processedImage: Blob;
}

export interface ICropBounds {
  xPercent: number;
  yPercent: number;
  widthPercent: number;
  heightPercent: number;
}
