import type { IMileageReading, IServiceSettings } from "~/types/car";

export interface IMileageBackup {
  format: "car-service-tracker";
  version: 1;
  exportedAt: string;
  unit: "km";
  readings: IMileageReading[];
  serviceSettings: IServiceSettings | null;
}

export function createMileageBackup(
  readings: IMileageReading[],
  serviceSettings?: IServiceSettings,
): IMileageBackup {
  return {
    format: "car-service-tracker",
    version: 1,
    exportedAt: new Date().toISOString(),
    unit: "km",
    readings: readings.map(reading => ({ ...reading })),
    serviceSettings: serviceSettings ? { ...serviceSettings } : null,
  };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isMileage(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 9_999_999;
}

function isDate(value: unknown): value is string {
  return typeof value === "string"
    && /^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(value)
    && Number.isFinite(Date.parse(value));
}

export function parseMileageBackup(json: string): IMileageBackup {
  let value: unknown;
  try {
    value = JSON.parse(json);
  }
  catch {
    throw new Error("Choose a valid mileage history JSON file.");
  }
  if (!isObject(value) || value.format !== "car-service-tracker" || value.version !== 1
    || value.unit !== "km" || !isDate(value.exportedAt) || !Array.isArray(value.readings)) {
    throw new Error("This file is not a supported mileage history backup.");
  }
  const ids = new Set<string>();
  const readings = value.readings.map((reading: unknown): IMileageReading => {
    if (!isObject(reading) || typeof reading.id !== "string" || !reading.id.trim()
      || ids.has(reading.id) || !isMileage(reading.mileageKm) || !isDate(reading.recordedAt)
      || (reading.detectedMileageKm !== undefined && !isMileage(reading.detectedMileageKm))
      || (reading.servicePerformed !== undefined && typeof reading.servicePerformed !== "boolean")) {
      throw new Error("The backup contains an invalid or duplicate mileage reading.");
    }
    ids.add(reading.id);
    return {
      id: reading.id,
      mileageKm: reading.mileageKm,
      recordedAt: new Date(reading.recordedAt).toISOString(),
      ...(reading.detectedMileageKm !== undefined ? { detectedMileageKm: reading.detectedMileageKm } : {}),
      ...(reading.servicePerformed !== undefined ? { servicePerformed: reading.servicePerformed } : {}),
    };
  });
  const settings = value.serviceSettings;
  if (settings !== null && (!isObject(settings) || settings.id !== "service"
    || typeof settings.lastServiceMileageKm !== "number" || !Number.isInteger(settings.lastServiceMileageKm)
    || settings.lastServiceMileageKm < 0 || typeof settings.serviceIntervalKm !== "number"
    || !Number.isInteger(settings.serviceIntervalKm) || settings.serviceIntervalKm <= 0)) {
    throw new Error("The backup contains invalid service settings.");
  }
  return {
    format: "car-service-tracker", version: 1, unit: "km", exportedAt: value.exportedAt,
    readings,
    serviceSettings: settings === null ? null : {
      id: "service",
      lastServiceMileageKm: settings.lastServiceMileageKm as number,
      serviceIntervalKm: settings.serviceIntervalKm as number,
    },
  };
}

export function mergeMileageReadings(existing: IMileageReading[], incoming: IMileageReading[]): IMileageReading[] {
  const byId = new Map(existing.map(reading => [reading.id, reading]));
  for (const reading of incoming) {
    const current = byId.get(reading.id);
    if (current && (current.mileageKm !== reading.mileageKm
      || Date.parse(current.recordedAt) !== Date.parse(reading.recordedAt)
      || current.detectedMileageKm !== reading.detectedMileageKm
      || Boolean(current.servicePerformed) !== Boolean(reading.servicePerformed))) {
      throw new Error("A reading in this backup conflicts with your history. No data was imported.");
    }
    if (!current) byId.set(reading.id, reading);
  }
  const readings = [...byId.values()].sort((a, b) => Date.parse(b.recordedAt) - Date.parse(a.recordedAt));
  for (let index = 1; index < readings.length; index++) {
    const newer = readings[index - 1]!;
    const older = readings[index]!;
    if (Date.parse(newer.recordedAt) > Date.parse(older.recordedAt) && newer.mileageKm < older.mileageKm) {
      throw new Error("The imported history would make mileage decrease over time. No data was imported.");
    }
  }
  return readings;
}
