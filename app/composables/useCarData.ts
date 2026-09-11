import type { IMileageReading, IServiceSettings } from "~/types/car";
import {
  deleteMileageReading,
  getMileageReadings,
  getServiceSettings,
  saveMileageReading,
  saveServiceSettings,
} from "~/utils/car-database";

export function useCarData() {
  const readings = useState<IMileageReading[]>("mileage-readings", () => []);
  const serviceSettings = useState<IServiceSettings | undefined>("service-settings", () => undefined);
  const loaded = useState<boolean>("car-data-loaded", () => false);

  const currentMileageKm = computed(() => readings.value[0]?.mileageKm);

  async function load(): Promise<void> {
    if (!import.meta.client || loaded.value) return;
    [readings.value, serviceSettings.value] = await Promise.all([
      getMileageReadings(),
      getServiceSettings(),
    ]);
    loaded.value = true;
  }

  async function addReading(reading: IMileageReading): Promise<void> {
    await saveMileageReading(reading);
    readings.value = [reading, ...readings.value].sort(
      (first, second) => new Date(second.recordedAt).getTime() - new Date(first.recordedAt).getTime(),
    );
  }

  async function removeReading(id: string): Promise<void> {
    await deleteMileageReading(id);
    readings.value = readings.value.filter((reading) => reading.id !== id);
  }

  async function updateServiceSettings(settings: IServiceSettings): Promise<void> {
    await saveServiceSettings(settings);
    serviceSettings.value = settings;
  }

  return { readings, serviceSettings, currentMileageKm, loaded, load, addReading, removeReading, updateServiceSettings };
}
