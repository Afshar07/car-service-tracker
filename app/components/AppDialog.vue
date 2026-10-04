<script setup lang="ts">
defineProps<{
  open: boolean;
  label?: string;
  labelledby?: string;
  describedby?: string;
  role?: "dialog" | "alertdialog";
  drawer?: boolean;
  busy?: boolean;
}>();
const emit = defineEmits<{ close: []; closed: [] }>();
const dialog = ref<HTMLDialogElement>();
let opener: HTMLElement | null = null;
function enter(element: Element): void {
  opener = document.activeElement as HTMLElement | null;
  (element as HTMLDialogElement).showModal();
  document.documentElement.classList.add("dialog-open");
}
function leave(element: Element): void {
  (element as HTMLDialogElement).close();
  if (!document.querySelector("dialog[open]")) document.documentElement.classList.remove("dialog-open");
  // Menu selections may already have opened the next dialog.
  if (!document.querySelector("dialog[open]") && opener?.isConnected) opener.focus();
  emit("closed");
}
onBeforeUnmount(() => {
  dialog.value?.close();
  if (!document.querySelector("dialog[open]")) document.documentElement.classList.remove("dialog-open");
});
</script>

<template>
  <Teleport to="body">
    <Transition name="modal" @enter="enter" @after-leave="leave">
      <dialog ref="dialog" v-if="open" class="modal" :class="{ 'modal--drawer': drawer }"
        :role="role ?? 'dialog'" aria-modal="true" :aria-label="label"
        :aria-labelledby="labelledby" :aria-describedby="describedby"
        @cancel.prevent="!busy && emit('close')" @click.self="!busy && emit('close')">
        <div :class="drawer ? 'app-menu' : 'modal__sheet'">
          <slot />
        </div>
      </dialog>
    </Transition>
  </Teleport>
</template>
