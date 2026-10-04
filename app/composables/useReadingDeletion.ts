import { ref } from "vue";
import type { IMileageReading } from "~/types/car";

/** UI confirmation state; persistence stays with the supplied useCarData action. */
export function useReadingDeletion(remove: (id: string) => Promise<void>) {
  const pendingDelete = ref<IMileageReading>();
  const deleting = ref(false);
  const deleteError = ref("");
  function requestDelete(reading: IMileageReading): void {
    if (deleting.value) return;
    deleteError.value = "";
    pendingDelete.value = reading;
  }
  function cancelDelete(): void {
    if (!deleting.value) pendingDelete.value = undefined;
  }
  async function confirmDelete(): Promise<void> {
    if (!pendingDelete.value || deleting.value) return;
    const id = pendingDelete.value.id;
    deleting.value = true;
    try {
      await remove(id);
      pendingDelete.value = undefined;
    }
    catch {
      deleteError.value = "Could not delete this reading. Please try again.";
    }
    finally {
      deleting.value = false;
    }
  }
  return { pendingDelete, deleting, deleteError, requestDelete, cancelDelete, confirmDelete };
}
