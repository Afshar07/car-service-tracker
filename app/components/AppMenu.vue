<script setup lang="ts">
defineProps<{ open: boolean; version: string; ready: boolean }>();
const emit = defineEmits<{ close: []; closed: []; select: [destination: "service" | "backup"] }>();
</script>

<template>
  <AppDialog :open="open" label="Application menu" drawer @close="emit('close')" @closed="emit('closed')">
    <header class="panel-header">
      <div><p class="eyebrow">Car Service</p><h2>Menu</h2></div>
      <button class="icon-button" type="button" aria-label="Close menu" @click="emit('close')">×</button>
    </header>
    <nav class="app-menu__nav" aria-label="Application actions">
      <button type="button" :disabled="!ready" @click="emit('select', 'service')">Service schedule <span aria-hidden="true">›</span></button>
      <button type="button" :disabled="!ready" @click="emit('select', 'backup')">Data &amp; backup <span aria-hidden="true">›</span></button>
    </nav>
    <footer class="app-menu__footer"><strong>Car Service Tracker</strong><span>v{{ version }}</span></footer>
  </AppDialog>
</template>
