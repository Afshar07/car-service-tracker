<script setup lang="ts">
const pwa = usePWA();
const offlineDismissed = ref(false);
const registrationDismissed = ref(false);

async function later() {
  await pwa?.cancelPrompt();
}

async function reload() {
  await pwa?.updateServiceWorker(true);
}
</script>

<template>
  <aside v-if="pwa && ((pwa.offlineReady && !offlineDismissed) || pwa.needRefresh || (pwa.registrationError && !registrationDismissed))"
    class="pwa-status" aria-live="polite">
    <div v-if="pwa.needRefresh" class="message message--warning">
      <strong>Update available.</strong> Reload to use the latest version.
      <button class="pwa-status__action" type="button" @click="reload">Reload</button>
      <button class="pwa-status__close" type="button" aria-label="Later" @click="later">Later</button>
    </div>
    <div v-else-if="pwa.offlineReady && !offlineDismissed" class="message message--offline">
      <strong>Ready for offline use.</strong> Your data stays on this device.
      <button class="pwa-status__close" type="button" aria-label="Dismiss offline notice" @click="offlineDismissed = true">×</button>
    </div>
    <div v-else-if="pwa.registrationError && !registrationDismissed" class="message message--error">
      <strong>Offline setup failed.</strong> The app may need a connection to load fully.
      <button class="pwa-status__close" type="button" aria-label="Dismiss error" @click="registrationDismissed = true">×</button>
    </div>
  </aside>
</template>
