import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { IMileageReading, IServiceSettings } from "~/types/car";

interface ICarServiceDatabase extends DBSchema {
  metadata: {
    key: string;
    value: { id: "initialized"; value: boolean };
  };
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
  databasePromise ??= openDB<ICarServiceDatabase>("car-service-tracker", 2, {
    upgrade(database, oldVersion, _newVersion, transaction) {
      if (oldVersion < 1) {
        const readings = database.createObjectStore("readings", { keyPath: "id" });
        readings.createIndex("by-recorded-at", "recordedAt");
        database.createObjectStore("settings", { keyPath: "id" });
      }
      if (oldVersion < 2) {
        database.createObjectStore("metadata", { keyPath: "id" });
        // Existing databases, including deliberately emptied ones, are authoritative.
        if (oldVersion > 0) transaction.objectStore("metadata").put({ id: "initialized", value: true });
      }
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
  const transaction = database.transaction(["readings", "metadata"], "readwrite");
  await Promise.all([
    transaction.objectStore("readings").put(reading),
    transaction.objectStore("metadata").put({ id: "initialized", value: true }),
    transaction.done,
  ]);
}

export async function deleteMileageReading(id: string): Promise<void> {
  const database = await getDatabase();
  const transaction = database.transaction(["readings", "metadata"], "readwrite");
  await Promise.all([
    transaction.objectStore("readings").delete(id),
    transaction.objectStore("metadata").put({ id: "initialized", value: true }),
    transaction.done,
  ]);
}

export async function getServiceSettings(): Promise<IServiceSettings | undefined> {
  const database = await getDatabase();
  return database.get("settings", "service");
}

export async function saveServiceSettings(settings: IServiceSettings): Promise<void> {
  const database = await getDatabase();
  const transaction = database.transaction(["settings", "metadata"], "readwrite");
  await Promise.all([
    transaction.objectStore("settings").put(settings),
    transaction.objectStore("metadata").put({ id: "initialized", value: true }),
    transaction.done,
  ]);
}

// Import both stores atomically so failed imports never leave partial history.
export async function importCarData(
  readings: IMileageReading[],
  settings?: IServiceSettings,
): Promise<void> {
  const database = await getDatabase();
  const transaction = database.transaction(["readings", "settings", "metadata"], "readwrite");
  await Promise.all([
    transaction.objectStore("metadata").put({ id: "initialized", value: true }),
    ...readings.map(reading => transaction.objectStore("readings").put(reading)),
    ...(settings ? [transaction.objectStore("settings").put(settings)] : []),
    transaction.done,
  ]);
}

export async function isCarDataInitialized(): Promise<boolean> {
  const database = await getDatabase();
  return (await database.get("metadata", "initialized"))?.value === true;
}

export async function markCarDataInitialized(): Promise<void> {
  const database = await getDatabase();
  await database.put("metadata", { id: "initialized", value: true });
}
