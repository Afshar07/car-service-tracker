import type { IMileageReading, IServiceSettings } from "~/types/car";
import {
  deleteMileageReading,
  getMileageReadings,
  importCarData,
  isCarDataInitialized,
  markCarDataInitialized,
  getServiceSettings,
  saveMileageReading,
  saveServiceSettings,
} from "~/utils/car-database";
import { updateCarWidget } from "~/utils/car-widget.client";
import {
  calculateServiceSummary,
  estimateCurrentMileage,
  resolveEffectiveServiceSettings,
} from "~/utils/mileage";

import { createMileageBackup, mergeMileageReadings, parseMileageBackup } from "~/utils/mileage-backup";
import { readNativeMileageBackup, requestPersistentMileageStorage, writeNativeMileageBackup } from "~/utils/mileage-backup.client";

export function useCarData() {
  const readings = useState<IMileageReading[]>("mileage-readings", () => []);
  const serviceSettings = useState<IServiceSettings | undefined>(
    "service-settings",
    () => undefined,
  );
  const loaded = useState<boolean>("car-data-loaded", () => false);

  const backupWarning = useState<string>("mileage-backup-warning", () => "");

  const currentMileageKm = computed(() => readings.value[0]?.mileageKm);

  async function syncWidget(): Promise<void> {
    const estimatedMileageKm = estimateCurrentMileage(readings.value[0]);
    const effectiveSettings = resolveEffectiveServiceSettings(
      readings.value,
      serviceSettings.value,
    );
    const summary = calculateServiceSummary(
      estimatedMileageKm,
      effectiveSettings,
      readings.value,
    );

    await updateCarWidget({
      estimatedMileageKm,
      remainingKm: summary.remainingKm,
      status: summary.status,
      updatedAt: new Date().toISOString(),
    });
  }

  async function syncBackup(): Promise<void> {
    try {
      await writeNativeMileageBackup(JSON.stringify(createMileageBackup(readings.value, serviceSettings.value)));
      backupWarning.value = "";
    }
    catch {
      backupWarning.value = "Your history is saved, but the automatic backup failed. Export JSON to keep a backup.";
    }
  }

  async function importHistory(json: string): Promise<number> {
    const backup = parseMileageBackup(json);
    const merged = mergeMileageReadings(readings.value, backup.readings);
    const settings = serviceSettings.value ?? backup.serviceSettings ?? undefined;
    const added = merged.length - readings.value.length;
    await importCarData(merged, settings);
    readings.value = merged;
    serviceSettings.value = settings;
    await syncBackup();
    await syncWidget();
    return added;
  }

  async function load(): Promise<void> {
    if (typeof window === "undefined" || loaded.value) return;
    [readings.value, serviceSettings.value] = await Promise.all([
      getMileageReadings(),
      getServiceSettings(),
    ]);
    if (!readings.value.length && !serviceSettings.value && !await isCarDataInitialized()) {
      const json = await readNativeMileageBackup();
      if (json) await importHistory(json);
    }
    await markCarDataInitialized();
    loaded.value = true;
    void requestPersistentMileageStorage();
    await syncBackup();
    await syncWidget();
  }

  async function addReading(reading: IMileageReading): Promise<void> {
    await saveMileageReading(reading);
    readings.value = [reading, ...readings.value].sort(
      (first, second) =>
        new Date(second.recordedAt).getTime()
        - new Date(first.recordedAt).getTime(),
    );
    await syncBackup();
    await syncWidget();
  }

  async function updateReading(reading: IMileageReading): Promise<void> {
    await saveMileageReading(reading);
    readings.value = readings.value
      .map(current => current.id === reading.id ? reading : current)
      .sort(
        (first, second) =>
          new Date(second.recordedAt).getTime()
          - new Date(first.recordedAt).getTime(),
      );
    await syncBackup();
    await syncWidget();
  }

  async function removeReading(id: string): Promise<void> {
    await deleteMileageReading(id);
    readings.value = readings.value.filter(reading => reading.id !== id);
    await syncBackup();
    await syncWidget();
  }

  async function updateServiceSettings(settings: IServiceSettings): Promise<void> {
    await saveServiceSettings(settings);
    serviceSettings.value = settings;
    await syncBackup();
    await syncWidget();
  }

  return {
    readings,
    serviceSettings,
    currentMileageKm,
    loaded,
    backupWarning,
    importHistory,
    load,
    addReading,
    updateReading,
    removeReading,
    updateServiceSettings,
  };
}
