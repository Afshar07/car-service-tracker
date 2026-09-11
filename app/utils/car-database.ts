import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { IMileageReading, IServiceSettings } from "~/types/car";

interface ICarServiceDatabase extends DBSchema {
  readings: {
    key: string;
    value: IMileageReading;
    indexes: { "by-recorded-at": string };
  };
  settings: {
    key: string;
    value: IServiceSettings;
  };
}

let databasePromise: Promise<IDBPDatabase<ICarServiceDatabase>> | undefined;

function getDatabase(): Promise<IDBPDatabase<ICarServiceDatabase>> {
  databasePromise ??= openDB<ICarServiceDatabase>("car-service-tracker", 1, {
    upgrade(database) {
      const readings = database.createObjectStore("readings", { keyPath: "id" });
      readings.createIndex("by-recorded-at", "recordedAt");
      database.createObjectStore("settings", { keyPath: "id" });
    },
  });
  return databasePromise;
}

export async function getMileageReadings(): Promise<IMileageReading[]> {
  const database = await getDatabase();
  const readings = await database.getAllFromIndex("readings", "by-recorded-at");
  return readings.reverse();
}

export async function saveMileageReading(reading: IMileageReading): Promise<void> {
  const database = await getDatabase();
  await database.put("readings", reading);
}

export async function deleteMileageReading(id: string): Promise<void> {
  const database = await getDatabase();
  await database.delete("readings", id);
}

export async function getServiceSettings(): Promise<IServiceSettings | undefined> {
  const database = await getDatabase();
  return database.get("settings", "service");
}

export async function saveServiceSettings(settings: IServiceSettings): Promise<void> {
  const database = await getDatabase();
  await database.put("settings", settings);
}
