import { describe, expect, it, vi } from "vitest";
import { useReadingDeletion } from "~/composables/useReadingDeletion";

const reading = { id: "selected", mileageKm: 123456, recordedAt: "2026-01-01T00:00:00Z" };
describe("reading deletion confirmation", () => {
  it("does not delete on request or cancel, and clears the pending reading", async () => {
    const remove = vi.fn();
    const state = useReadingDeletion(remove);
    state.requestDelete(reading);
    expect(remove).not.toHaveBeenCalled();
    state.cancelDelete();
    await state.confirmDelete();
    expect(remove).not.toHaveBeenCalled();
    expect(state.pendingDelete.value).toBeUndefined();
  });
  it("deletes only the selected ID once after explicit confirmation", async () => {
    let finish!: () => void;
    const remove = vi.fn(() => new Promise<void>(resolve => { finish = resolve; }));
    const state = useReadingDeletion(remove);
    state.requestDelete(reading);
    const completion = state.confirmDelete();
    state.requestDelete({ ...reading, id: "other" });
    state.cancelDelete();
    await state.confirmDelete();
    expect(remove).toHaveBeenCalledExactlyOnceWith("selected");
    finish();
    await completion;
    expect(state.pendingDelete.value).toBeUndefined();
    expect(state.deleting.value).toBe(false);
  });
  it("keeps the pending entry and reports failed persistence for retry", async () => {
    const remove = vi.fn().mockRejectedValueOnce(new Error("write failed")).mockResolvedValue(undefined);
    const state = useReadingDeletion(remove);
    state.requestDelete(reading);
    await state.confirmDelete();
    expect(state.pendingDelete.value?.id).toBe("selected");
    expect(state.deleteError.value).toContain("Could not delete");
    expect(state.deleting.value).toBe(false);
    await state.confirmDelete();
    expect(state.pendingDelete.value).toBeUndefined();
  });
});
