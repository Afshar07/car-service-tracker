import type {
  IMileageReading,
  IMileageValidationResult,
  IServiceSettings,
  IServiceSummary,
  TServiceStatus,
} from "~/types/car";

const MAX_MILEAGE_KM = 9_999_999;
const LARGE_INCREASE_KM = 10_000;
const MIN_ESTIMATE_SPAN_DAYS = 7;
const MILLISECONDS_PER_DAY = 86_400_000;
const AVERAGE_DAYS_PER_MONTH = 365.2425 / 12;
export const DEFAULT_MONTHLY_DRIVING_KM = 2_000;

export function validateMileage(
  mileageKm: number,
  previousMileageKm?: number,
): IMileageValidationResult {
  const errors: IMileageValidationResult["errors"] = [];
  const warnings: IMileageValidationResult["warnings"] = [];

  if (!Number.isFinite(mileageKm)) errors.push("required");
  else if (!Number.isInteger(mileageKm)) errors.push("not-integer");
  else if (mileageKm < 0) errors.push("negative");
  else if (mileageKm > MAX_MILEAGE_KM) errors.push("too-large");

  if (errors.length === 0 && previousMileageKm !== undefined) {
    if (mileageKm < previousMileageKm) errors.push("lower-than-previous");
    else if (mileageKm === previousMileageKm) warnings.push("duplicate");
    else if (mileageKm - previousMileageKm >= LARGE_INCREASE_KM) warnings.push("large-increase");
  }

  return { valid: errors.length === 0, errors, warnings };
}

export function calculateNextServiceMileage(settings: IServiceSettings): number {
  return settings.lastServiceMileageKm + settings.serviceIntervalKm;
}

export function calculateServiceStatus(
  remainingKm: number,
  serviceIntervalKm: number,
): TServiceStatus {
  if (remainingKm <= 0) return "overdue";
  const dueSoonKm = Math.min(1_000, serviceIntervalKm * 0.1);
  return remainingKm <= dueSoonKm ? "due-soon" : "on-track";
}

export function resolveEffectiveServiceSettings(
  readings: IMileageReading[],
  settings: IServiceSettings | undefined,
): IServiceSettings | undefined {
  const latestServiceReading = readings.find(reading => reading.servicePerformed);
  if (!latestServiceReading) return settings;

  return {
    id: "service",
    lastServiceMileageKm: latestServiceReading.mileageKm,
    serviceIntervalKm: settings?.serviceIntervalKm ?? 10_000,
  };
}

export function calculateAverageDailyKm(readings: IMileageReading[]): number | undefined {
  if (readings.length < 2) return undefined;
  const sorted = [...readings].sort(
    (first, second) => new Date(first.recordedAt).getTime() - new Date(second.recordedAt).getTime(),
  );
  const first = sorted[0];
  const last = sorted.at(-1);
  if (!first || !last) return undefined;

  const elapsedDays =
    (new Date(last.recordedAt).getTime() - new Date(first.recordedAt).getTime())
    / MILLISECONDS_PER_DAY;
  const travelledKm = last.mileageKm - first.mileageKm;

  if (elapsedDays < MIN_ESTIMATE_SPAN_DAYS || travelledKm <= 0) return undefined;
  return travelledKm / elapsedDays;
}

export function estimateCurrentMileage(
  latestReading: IMileageReading | undefined,
  now = new Date(),
  monthlyDrivingKm = DEFAULT_MONTHLY_DRIVING_KM,
): number | undefined {
  if (!latestReading || monthlyDrivingKm < 0 || !Number.isFinite(monthlyDrivingKm)) return undefined;

  const recordedAt = new Date(latestReading.recordedAt).getTime();
  const currentTime = now.getTime();
  if (!Number.isFinite(recordedAt) || !Number.isFinite(currentTime)) return undefined;

  const elapsedDays = Math.max(0, (currentTime - recordedAt) / MILLISECONDS_PER_DAY);
  const estimatedTravelKm = elapsedDays * monthlyDrivingKm / AVERAGE_DAYS_PER_MONTH;
  return Math.round(latestReading.mileageKm + estimatedTravelKm);
}

export function calculateServiceSummary(
  currentMileageKm: number | undefined,
  settings: IServiceSettings | undefined,
  readings: IMileageReading[],
  now = new Date(),
): IServiceSummary {
  if (currentMileageKm === undefined || !settings) return { status: "not-configured" };

  const nextServiceMileageKm = calculateNextServiceMileage(settings);
  const remainingKm = nextServiceMileageKm - currentMileageKm;
  const averageDailyKm = calculateAverageDailyKm(readings);
  const daysUntilService = averageDailyKm && remainingKm > 0 ? remainingKm / averageDailyKm : undefined;

  return {
    nextServiceMileageKm,
    remainingKm,
    status: calculateServiceStatus(remainingKm, settings.serviceIntervalKm),
    averageDailyKm,
    estimatedServiceDate: daysUntilService
      ? new Date(now.getTime() + daysUntilService * MILLISECONDS_PER_DAY)
      : undefined,
  };
}
