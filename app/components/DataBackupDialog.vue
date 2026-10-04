<script setup lang="ts">
defineProps<{ open: boolean; busy: boolean; message: string; error: string; warning: string }>();
const emit = defineEmits<{ close: []; export: []; import: [event: Event] }>();
const importInput = ref<HTMLInputElement>();
</script>
<template>
  <AppDialog :open="open" label="Data and backup" :busy="busy" @close="emit('close')">
    <header class="panel-header">
      <div><p class="eyebrow">Your data</p><h2>Data &amp; backup</h2></div>
      <button class="icon-button" type="button" aria-label="Close backup settings" :disabled="busy" @click="emit('close')">×</button>
    </header>
        <div class="history-transfer">
          <div class="history-transfer__actions">
            <button class="button button--secondary" type="button" :disabled="busy" @click="emit('export')">Export JSON</button>
            <button class="button button--secondary" type="button" :disabled="busy" @click="importInput?.click()">Import JSON</button>
            <input ref="importInput" type="file" accept=".json,application/json" hidden aria-label="Import mileage history JSON" @change="emit('import', $event)">
          </div>
          <p class="helper">History is kept across normal updates. Export a backup before uninstalling or clearing app data. Import adds readings and keeps existing service settings.</p>
          <p v-if="message" class="helper" role="status">{{ message }}</p>
          <p v-if="error" class="error-message" role="alert">{{ error }}</p>
          <p v-if="warning" class="error-message" role="alert">{{ warning }}</p>
        </div>
  </AppDialog>
</template>
