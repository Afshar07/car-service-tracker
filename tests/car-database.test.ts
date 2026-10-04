import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ openDB: vi.fn() }));
vi.mock("idb", () => mocks);

beforeEach(() => { vi.resetModules(); vi.resetAllMocks(); });

async function setup() {
  const stores = {
    readings: { put: vi.fn().mockResolvedValue(undefined), delete: vi.fn().mockResolvedValue(undefined) },
    settings: { put: vi.fn().mockResolvedValue(undefined) },
    metadata: { put: vi.fn().mockResolvedValue(undefined) },
  };
  const transaction = {
    objectStore: vi.fn((name: keyof typeof stores) => stores[name]),
    done: Promise.resolve(),
  };
  const database = { transaction: vi.fn(() => transaction), get: vi.fn(), put: vi.fn() };
  mocks.openDB.mockResolvedValue(database);
  const module = await import("~/utils/car-database");
  return { module, database, transaction, stores };
}

const reading = { id: "one", mileageKm: 100000, recordedAt: "2026-10-01T10:00:00.000Z" };

describe("history database upgrades and transactions", () => {
  it("upgrades version 1 without recreating or deleting history/settings", async () => {
    const { module, stores } = await setup();
    await module.isCarDataInitialized();
    const [name, version, options] = mocks.openDB.mock.calls[0]!;
    expect(name).toBe("car-service-tracker");
    expect(version).toBe(2);
    const database = { createObjectStore: vi.fn() };
    options.upgrade(database, 1, 2, { objectStore: () => stores.metadata });
    expect(database.createObjectStore).toHaveBeenCalledTimes(1);
    expect(database.createObjectStore).toHaveBeenCalledWith("metadata", { keyPath: "id" });
    expect(stores.metadata.put).toHaveBeenCalledWith({ id: "initialized", value: true });
  });

  it("creates fresh stores without marking them initialized before backup recovery", async () => {
    const { module, stores } = await setup();
    await module.isCarDataInitialized();
    const options = mocks.openDB.mock.calls[0]![2];
    const index = vi.fn();
    const database = { createObjectStore: vi.fn(() => ({ createIndex: index })) };
    options.upgrade(database, 0, 2, { objectStore: () => stores.metadata });
    expect(database.createObjectStore.mock.calls.map(call => call[0])).toEqual(["readings", "settings", "metadata"]);
    expect(index).toHaveBeenCalledWith("by-recorded-at", "recordedAt");
    expect(stores.metadata.put).not.toHaveBeenCalled();
  });

  it("commits imported history, settings and recovery marker in one transaction", async () => {
    const { module, database, stores } = await setup();
    const settings = { id: "service" as const, lastServiceMileageKm: 90000, serviceIntervalKm: 10000 };
    await module.importCarData([reading], settings);
    expect(database.transaction).toHaveBeenCalledWith(["readings", "settings", "metadata"], "readwrite");
    expect(stores.readings.put).toHaveBeenCalledWith(reading);
    expect(stores.settings.put).toHaveBeenCalledWith(settings);
    expect(stores.metadata.put).toHaveBeenCalledWith({ id: "initialized", value: true });
  });

  it("marks a deliberate deletion in the same transaction as the deletion", async () => {
    const { module, database, stores } = await setup();
    await module.deleteMileageReading(reading.id);
    expect(database.transaction).toHaveBeenCalledWith(["readings", "metadata"], "readwrite");
    expect(stores.readings.delete).toHaveBeenCalledWith(reading.id);
    expect(stores.metadata.put).toHaveBeenCalledWith({ id: "initialized", value: true });
  });

  it("propagates failed transaction completion", async () => {
    const { module, transaction } = await setup();
    transaction.done = Promise.reject(new Error("transaction aborted"));
    await expect(module.importCarData([reading])).rejects.toThrow("transaction aborted");
  });
});
