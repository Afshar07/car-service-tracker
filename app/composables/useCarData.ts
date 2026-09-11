import type { IMileageReading, IServiceSettings } from "~/types/car";
import {
  deleteMileageReading,
  getMileageReadings,
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

export function useCarData() {
  const readings = useState<IMileageReading[]>("mileage-readings", () => []);
  const serviceSettings = useState<IServiceSettings | undefined>(
    "service-settings",
    () => undefined,
  );
  const loaded = useState<boolean>("car-data-loaded", () => false);

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

  async function load(): Promise<void> {
    if (!import.meta.client || loaded.value) return;
    [readings.value, serviceSettings.value] = await Promise.all([
      getMileageReadings(),
      getServiceSettings(),
    ]);
    loaded.value = true;
    await syncWidget();
  }

  async function addReading(reading: IMileageReading): Promise<void> {
    await saveMileageReading(reading);
    readings.value = [reading, ...readings.value].sort(
      (first, second) =>
        new Date(second.recordedAt).getTime()
        - new Date(first.recordedAt).getTime(),
    );
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
    await syncWidget();
  }

  async function removeReading(id: string): Promise<void> {
    await deleteMileageReading(id);
    readings.value = readings.value.filter(reading => reading.id !== id);
    await syncWidget();
  }

  async function updateServiceSettings(settings: IServiceSettings): Promise<void> {
    await saveServiceSettings(settings);
    serviceSettings.value = settings;
    await syncWidget();
  }

  return {
    readings,
    serviceSettings,
    currentMileageKm,
    loaded,
    load,
    addReading,
    updateReading,
    removeReading,
    updateServiceSettings,
  };
}
