import { beforeEach, describe, expect, it, vi } from "vitest";
import { computed, ref } from "vue";
import { useCarData } from "~/composables/useCarData";
import { createMileageBackup } from "~/utils/mileage-backup";

const mocks = vi.hoisted(() => ({
  isCarDataInitialized: vi.fn(), markCarDataInitialized: vi.fn(),
  getMileageReadings: vi.fn(), getServiceSettings: vi.fn(), importCarData: vi.fn(),
  saveMileageReading: vi.fn(), deleteMileageReading: vi.fn(), saveServiceSettings: vi.fn(),
  readNativeMileageBackup: vi.fn(), writeNativeMileageBackup: vi.fn(),
  requestPersistentMileageStorage: vi.fn(), updateCarWidget: vi.fn(),
}));
vi.mock("~/utils/car-database", () => mocks);
vi.mock("~/utils/mileage-backup.client", () => mocks);
vi.mock("~/utils/car-widget.client", () => mocks);

const reading = { id: "one", mileageKm: 100000, recordedAt: "2026-10-01T10:00:00.000Z", servicePerformed: true };
const settings = { id: "service" as const, lastServiceMileageKm: 90000, serviceIntervalKm: 10000 };
const json = JSON.stringify(createMileageBackup([reading], settings));

beforeEach(() => {
  vi.resetAllMocks();
  const states = new Map<string, unknown>();
  vi.stubGlobal("window", {});
  vi.stubGlobal("computed", computed);
  vi.stubGlobal("useState", (key: string, init: () => unknown) => {
    if (!states.has(key)) states.set(key, ref(init()));
    return states.get(key);
  });
  mocks.getMileageReadings.mockResolvedValue([]);
  mocks.getServiceSettings.mockResolvedValue(undefined);
});

describe("automatic history recovery and mutations", () => {
  it("restores the native backup into an empty database and refreshes state/widget", async () => {
    mocks.readNativeMileageBackup.mockResolvedValue(json);
    const data = useCarData();
    await data.load();
    expect(mocks.importCarData).toHaveBeenCalledWith([reading], settings);
    expect(data.readings.value).toEqual([reading]);
    expect(data.serviceSettings.value).toEqual(settings);
    expect(data.loaded.value).toBe(true);
    expect(mocks.updateCarWidget).toHaveBeenCalled();
  });

  it("keeps current IndexedDB data over an older backup on update", async () => {
    mocks.getMileageReadings.mockResolvedValue([reading]);
    const data = useCarData();
    await data.load();
    expect(mocks.readNativeMileageBackup).not.toHaveBeenCalled();
    expect(mocks.importCarData).not.toHaveBeenCalled();
    expect(JSON.parse(mocks.writeNativeMileageBackup.mock.calls[0]![0]).readings).toEqual([reading]);
  });

  it("does not resurrect deleted readings from a stale backup in an initialized database", async () => {
    mocks.isCarDataInitialized.mockResolvedValue(true);
    mocks.readNativeMileageBackup.mockResolvedValue(json);
    const data = useCarData();
    await data.load();
    expect(data.readings.value).toEqual([]);
    expect(mocks.readNativeMileageBackup).not.toHaveBeenCalled();
    expect(mocks.importCarData).not.toHaveBeenCalled();
  });

  it("preserves corrupt backups rather than overwriting them with empty history", async () => {
    mocks.readNativeMileageBackup.mockResolvedValue("corrupt");
    const data = useCarData();
    await expect(data.load()).rejects.toThrow();
    expect(data.loaded.value).toBe(false);
    expect(mocks.writeNativeMileageBackup).not.toHaveBeenCalled();
  });

  it("updates the backup for additions, edits, deletion and service settings", async () => {
    const data = useCarData();
    await data.addReading(reading);
    await data.updateReading({ ...reading, mileageKm: 100100 });
    await data.updateServiceSettings(settings);
    await data.removeReading(reading.id);
    const snapshots = mocks.writeNativeMileageBackup.mock.calls.map(([value]) => JSON.parse(value));
    expect(snapshots[0].readings).toEqual([reading]);
    expect(snapshots[1].readings[0].mileageKm).toBe(100100);
    expect(snapshots[2].serviceSettings).toEqual(settings);
    expect(snapshots[3].readings).toEqual([]);
  });

  it("keeps current readings/settings on repeated import", async () => {
    const data = useCarData();
    await data.addReading(reading);
    const currentSettings = { ...settings, serviceIntervalKm: 15000 };
    await data.updateServiceSettings(currentSettings);
    expect(await data.importHistory(json)).toBe(0);
    expect(data.serviceSettings.value).toEqual(currentSettings);
    expect(data.readings.value).toEqual([reading]);
  });

  it("keeps reactive state unchanged when database import fails", async () => {
    mocks.importCarData.mockRejectedValue(new Error("disk full"));
    const data = useCarData();
    await expect(data.importHistory(json)).rejects.toThrow("disk full");
    expect(data.readings.value).toEqual([]);
    expect(data.serviceSettings.value).toBeUndefined();
    expect(mocks.writeNativeMileageBackup).not.toHaveBeenCalled();
  });

  it("reports a backup failure while keeping the successfully saved reading", async () => {
    mocks.writeNativeMileageBackup.mockRejectedValue(new Error("disk full"));
    const data = useCarData();
    await data.addReading(reading);
    expect(data.readings.value).toEqual([reading]);
    expect(data.backupWarning.value).toContain("automatic backup failed");
  });
});
