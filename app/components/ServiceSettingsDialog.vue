<script setup lang="ts">
defineProps<{ open: boolean; valid: boolean }>();
const lastService = defineModel<string>("lastService", { required: true });
const interval = defineModel<string>("interval", { required: true });
const emit = defineEmits<{ close: []; save: [] }>();
</script>
<template>
  <AppDialog :open="open" label="Service settings" @close="emit('close')">
      <form class="settings" @submit.prevent="emit('save')">
        <header class="panel-header">
          <div><p class="eyebrow">Service schedule</p><h2>Set your countdown</h2></div>
          <button class="icon-button" type="button" aria-label="Close" @click="emit('close')">×</button>
        </header>
        <label class="form-field">
          <span>Last service mileage</span>
          <div><input v-model="lastService" inputmode="numeric" pattern="[0-9]*" required><b>km</b></div>
          <small>The odometer reading when the car was last serviced.</small>
        </label>
        <label class="form-field">
          <span>Service every</span>
          <div><input v-model="interval" inputmode="numeric" pattern="[0-9]*" required><b>km</b></div>
          <small>Your mechanic or manufacturer’s recommended interval.</small>
        </label>
        <button class="button button--primary button--full" type="submit" :disabled="!valid">Save service settings</button>
      </form>
  </AppDialog>
</template>
