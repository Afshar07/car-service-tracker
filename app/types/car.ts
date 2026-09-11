export interface IMileageReading {
  id: string;
  mileageKm: number;
  recordedAt: string;
  detectedMileageKm?: number;
  servicePerformed?: boolean;
}

export interface IServiceSettings {
  id: "service";
  lastServiceMileageKm: number;
  serviceIntervalKm: number;
}

export type TServiceStatus = "on-track" | "due-soon" | "overdue" | "not-configured";

export interface IServiceSummary {
  nextServiceMileageKm?: number;
  remainingKm?: number;
  status: TServiceStatus;
  estimatedServiceDate?: Date;
  averageDailyKm?: number;
}

export type TMileageValidationCode =
  | "required"
  | "not-integer"
  | "negative"
  | "too-large"
  | "lower-than-previous"
  | "duplicate"
  | "large-increase";

export interface IMileageValidationResult {
  valid: boolean;
  errors: TMileageValidationCode[];
  warnings: TMileageValidationCode[];
}
