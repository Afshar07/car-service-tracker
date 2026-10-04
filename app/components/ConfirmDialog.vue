<script setup lang="ts">
const props = defineProps<{ open: boolean; message: string; busy: boolean; error: string }>();
const emit = defineEmits<{ cancel: []; confirm: [] }>();
const retainedMessage = ref(props.message);
watch(() => props.message, message => {
  if (message) retainedMessage.value = message;
});
const titleId = useId();
const descriptionId = useId();
</script>

<template>
  <AppDialog :open="open" role="alertdialog" :labelledby="titleId" :describedby="descriptionId" :busy="busy" @close="emit('cancel')">
    <div class="settings">
      <h2 :id="titleId" class="dialog-title">Delete mileage entry?</h2>
      <p :id="descriptionId" class="helper">{{ retainedMessage }}<br>This action cannot be undone.</p>
      <p v-if="error" class="error-message" role="alert">{{ error }}</p>
      <div class="dialog-actions">
        <button class="button button--secondary" type="button" :disabled="busy" autofocus @click="emit('cancel')">Cancel</button>
        <button class="button button--danger" type="button" :disabled="busy" @click="emit('confirm')">{{ busy ? "Deleting…" : "Delete" }}</button>
      </div>
    </div>
  </AppDialog>
</template>
