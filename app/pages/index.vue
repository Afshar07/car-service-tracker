<script setup lang="ts">
import type { IMileageReading, IServiceSettings } from "~/types/car";
import {
  DEFAULT_MONTHLY_DRIVING_KM,
  calculateServiceSummary,
  estimateCurrentMileage,
} from "~/utils/mileage";

const {
  readings,
  serviceSettings,
  currentMileageKm,
  loaded,
  load,
  addReading,
  updateReading,
  removeReading,
  updateServiceSettings,
} = useCarData();

const showCapture = ref(false);
const showSettings = ref(false);
const saving = ref(false);
const editingReading = ref<IMileageReading>();
const lastServiceMileageInput = ref("");
const serviceIntervalInput = ref("10000");

const estimatedCurrentMileageKm = computed(() =>
  estimateCurrentMileage(readings.value[0]),
);
const isMileageEstimated = computed(() =>
  currentMileageKm.value !== undefined
  && estimatedCurrentMileageKm.value !== undefined
  && estimatedCurrentMileageKm.value > currentMileageKm.value,
);

const latestServiceReading = computed(() =>
  readings.value.find(reading => reading.servicePerformed),
);
const effectiveServiceSettings = computed<IServiceSettings | undefined>(() => {
  const serviceReading = latestServiceReading.value;
  if (!serviceReading) return serviceSettings.value;
  return {
    id: "service",
    lastServiceMileageKm: serviceReading.mileageKm,
    serviceIntervalKm: serviceSettings.value?.serviceIntervalKm ?? 10_000,
  };
});

const summary = computed(() =>
  calculateServiceSummary(estimatedCurrentMileageKm.value, effectiveServiceSettings.value, readings.value),
);

const statusLabel = computed(() => ({
  "on-track": "On track",
  "due-soon": "Due soon",
  overdue: "Service overdue",
  "not-configured": "Set up service",
}[summary.value.status]));

const settingsValid = computed(() => {
  const lastService = Number(lastServiceMileageInput.value);
  const interval = Number(serviceIntervalInput.value);
  return Number.isInteger(lastService) && lastService >= 0 && Number.isInteger(interval) && interval > 0;
});

function formatNumber(value: number | undefined): string {
  return value === undefined ? "—" : new Intl.NumberFormat("en-US").format(Math.abs(Math.round(value)));
}

function formatDate(value: string | Date): string {
  return new Intl.DateTimeFormat("en", { day: "numeric", month: "short", year: "numeric" }).format(new Date(value));
}

function formatJalaliDate(value: string | Date): string {
  const parts = new Intl.DateTimeFormat("fa-IR", {
    calendar: "persian",
    numberingSystem: "latn",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(value));
  const datePart = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find(part => part.type === type)?.value ?? "";
  return `${datePart("year")}/${datePart("month")}/${datePart("day")}`;
}

function openSettings(): void {
  lastServiceMileageInput.value = effectiveServiceSettings.value?.lastServiceMileageKm.toString()
    ?? currentMileageKm.value?.toString()
    ?? "";
  serviceIntervalInput.value = serviceSettings.value?.serviceIntervalKm.toString() ?? "10000";
  showSettings.value = true;
}

async function saveReading(reading: IMileageReading): Promise<void> {
  saving.value = true;
  await addReading(reading);
  saving.value = false;
  showCapture.value = false;
  if (!serviceSettings.value) openSettings();
}

async function saveEditedReading(reading: IMileageReading): Promise<void> {
  saving.value = true;
  await updateReading(reading);
  saving.value = false;
  editingReading.value = undefined;
}

async function saveSettings(): Promise<void> {
  if (!settingsValid.value) return;
  const settings: IServiceSettings = {
    id: "service",
    lastServiceMileageKm: Number(lastServiceMileageInput.value),
    serviceIntervalKm: Number(serviceIntervalInput.value),
  };
  await updateServiceSettings(settings);
  showSettings.value = false;
}

async function confirmDelete(reading: IMileageReading): Promise<void> {
  if (window.confirm(`Delete the ${formatNumber(reading.mileageKm)} km reading?`)) {
    await removeReading(reading.id);
  }
}

onMounted(load);
</script>

<template>
  <main class="app-shell">
    <header class="topbar">
      <a class="brand" href="/" aria-label="Car Service home">
        <span class="brand__mark">CS</span>
        <span>Car Service</span>
      </a>
      <button class="icon-button" type="button" aria-label="Service settings" @click="openSettings">⚙</button>
    </header>

    <div v-if="!loaded" class="loading-page">Loading your car data…</div>

    <template v-else>
      <section class="hero-card" :data-status="summary.status">
        <div class="hero-card__top">
          <span class="status-pill">{{ statusLabel }}</span>
          <span v-if="summary.nextServiceMileageKm" class="muted">Next at {{ formatNumber(summary.nextServiceMileageKm) }} km</span>
        </div>

        <div v-if="estimatedCurrentMileageKm !== undefined" class="current-mileage">
          <span>{{ isMileageEstimated ? "Estimated current mileage" : "Current mileage" }}</span>
          <strong>{{ formatNumber(estimatedCurrentMileageKm) }}</strong>
          <b>km</b>
          <small v-if="isMileageEstimated" class="current-mileage__basis">
            Based on {{ formatNumber(DEFAULT_MONTHLY_DRIVING_KM) }} km/month ·
            Last confirmed at {{ formatNumber(currentMileageKm) }} km
          </small>
        </div>
        <div v-else class="empty-hero">
          <p class="eyebrow">Start here</p>
          <h1>Never lose track of your mileage again.</h1>
          <p>Photograph your dashboard, confirm the number, and we’ll keep the service countdown.</p>
        </div>

        <div v-if="summary.remainingKm !== undefined" class="service-countdown">
          <div>
            <span>{{ summary.remainingKm <= 0 ? "Overdue by" : "Until service" }}</span>
            <strong>{{ formatNumber(summary.remainingKm) }} km</strong>
          </div>
          <div v-if="summary.estimatedServiceDate">
            <span>Estimated date</span>
            <strong>{{ formatDate(summary.estimatedServiceDate) }}</strong>
          </div>
        </div>

        <button class="button button--accent button--full" type="button" @click="showCapture = true">
          <span class="button__icon">＋</span> Add mileage
        </button>
      </section>

      <section v-if="!serviceSettings && currentMileageKm !== undefined" class="setup-card">
        <div>
          <strong>Set your service interval</strong>
          <p>Tell us when the car was last serviced to start the countdown.</p>
        </div>
        <button class="button button--secondary" type="button" @click="openSettings">Set up</button>
      </section>

      <section class="history-section">
        <div class="section-heading">
          <div>
            <p class="eyebrow">Logbook</p>
            <h2>Mileage history</h2>
          </div>
          <span>{{ readings.length }} {{ readings.length === 1 ? "reading" : "readings" }}</span>
        </div>

        <div v-if="readings.length" class="history-list">
          <article v-for="(reading, index) in readings" :key="reading.id" class="history-item">
            <span class="history-item__dot" />
            <div>
              <strong>
                {{ formatNumber(reading.mileageKm) }} km
                <span v-if="reading.servicePerformed" class="service-badge">Serviced</span>
              </strong>
              <span>{{ formatDate(reading.recordedAt) }}</span>
              <span class="history-item__jalali" dir="ltr">{{ formatJalaliDate(reading.recordedAt) }}</span>
              <small v-if="index < readings.length - 1">
                +{{ formatNumber(reading.mileageKm - readings[index + 1]!.mileageKm) }} km
              </small>
            </div>
            <div class="history-item__actions">
              <button class="icon-button icon-button--quiet" type="button" aria-label="Edit reading" @click="editingReading = reading">✎</button>
              <button class="icon-button icon-button--quiet" type="button" aria-label="Delete reading" @click="confirmDelete(reading)">×</button>
            </div>
          </article>
        </div>
        <div v-else class="empty-list">
          <span>◎</span>
          <strong>No readings yet</strong>
          <p>Your confirmed mileage readings will appear here.</p>
        </div>
      </section>
    </template>

    <div v-if="showCapture" class="modal" role="dialog" aria-modal="true" aria-label="Add mileage">
      <div class="modal__sheet">
        <MileageCapture :previous-mileage-km="currentMileageKm" @save="saveReading" @cancel="showCapture = false" />
        <p v-if="saving" class="helper">Saving…</p>
      </div>
    </div>

    <div v-if="editingReading" class="modal" role="dialog" aria-modal="true" aria-label="Edit mileage">
      <div class="modal__sheet">
        <MileageEditForm
          :reading="editingReading"
          :readings="readings"
          @save="saveEditedReading"
          @cancel="editingReading = undefined"
        />
        <p v-if="saving" class="helper">Saving…</p>
      </div>
    </div>

    <div v-if="showSettings" class="modal" role="dialog" aria-modal="true" aria-label="Service settings">
      <form class="modal__sheet settings" @submit.prevent="saveSettings">
        <header class="panel-header">
          <div><p class="eyebrow">Service schedule</p><h2>Set your countdown</h2></div>
          <button class="icon-button" type="button" aria-label="Close" @click="showSettings = false">×</button>
        </header>
        <label class="form-field">
          <span>Last service mileage</span>
          <div><input v-model="lastServiceMileageInput" inputmode="numeric" pattern="[0-9]*" required><b>km</b></div>
          <small>The odometer reading when the car was last serviced.</small>
        </label>
        <label class="form-field">
          <span>Service every</span>
          <div><input v-model="serviceIntervalInput" inputmode="numeric" pattern="[0-9]*" required><b>km</b></div>
          <small>Your mechanic or manufacturer’s recommended interval.</small>
        </label>
        <button class="button button--primary button--full" type="submit" :disabled="!settingsValid">Save service settings</button>
      </form>
    </div>
  </main>
</template>
