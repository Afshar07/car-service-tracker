<script setup lang="ts">
import type { IMileageReading } from "~/types/car";
import { getMileageValidationMessage } from "~/utils/mileage-messages";
import { validateMileage } from "~/utils/mileage";

interface IProps {
  reading: IMileageReading;
  readings: IMileageReading[];
}

interface IEmits {
  save: [reading: IMileageReading];
  cancel: [];
}

const props = defineProps<IProps>();
const emit = defineEmits<IEmits>();

function toLocalDateTime(value: string): string {
  const date = new Date(value);
  const offsetMilliseconds = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offsetMilliseconds).toISOString().slice(0, 16);
}

const mileageInput = ref(props.reading.mileageKm.toString());
const recordedAtInput = ref(toLocalDateTime(props.reading.recordedAt));
const servicePerformed = ref(Boolean(props.reading.servicePerformed));

const parsedMileage = computed(() => Number(mileageInput.value));
const parsedRecordedAt = computed(() => new Date(recordedAtInput.value));

const adjacentReadings = computed(() => {
  const candidateTime = parsedRecordedAt.value.getTime();
  const otherReadings = props.readings
    .filter(reading => reading.id !== props.reading.id)
    .sort((first, second) =>
      new Date(first.recordedAt).getTime() - new Date(second.recordedAt).getTime(),
    );

  return {
    older: [...otherReadings].reverse().find(reading =>
      new Date(reading.recordedAt).getTime() <= candidateTime,
    ),
    newer: otherReadings.find(reading =>
      new Date(reading.recordedAt).getTime() > candidateTime,
    ),
  };
});

const validation = computed(() =>
  validateMileage(parsedMileage.value, adjacentReadings.value.older?.mileageKm),
);
const isAboveNewerReading = computed(() =>
  adjacentReadings.value.newer !== undefined
  && parsedMileage.value > adjacentReadings.value.newer.mileageKm,
);
const valid = computed(() =>
  Number.isFinite(parsedRecordedAt.value.getTime())
  && validation.value.valid
  && !isAboveNewerReading.value,
);

function save(): void {
  if (!valid.value) return;
  emit("save", {
    ...props.reading,
    mileageKm: parsedMileage.value,
    recordedAt: parsedRecordedAt.value.toISOString(),
    servicePerformed: servicePerformed.value,
  });
}
</script>

<template>
  <form class="settings" @submit.prevent="save">
    <header class="panel-header">
      <div>
        <p class="eyebrow">Edit entry</p>
        <h2>Update mileage record</h2>
      </div>
      <button class="icon-button" type="button" aria-label="Close" @click="emit('cancel')">×</button>
    </header>

    <label class="form-field">
      <span>Mileage</span>
      <div><input v-model="mileageInput" inputmode="numeric" pattern="[0-9]*" required><b>km</b></div>
    </label>

    <label class="form-field">
      <span>Recorded date</span>
      <div><input v-model="recordedAtInput" type="datetime-local" required></div>
    </label>

    <label class="switch-field">
      <span>
        <strong>Service completed</strong>
        <small>Use this mileage as the start of the next service interval.</small>
      </span>
      <input v-model="servicePerformed" type="checkbox" role="switch">
    </label>

    <p v-for="code in validation.errors" :key="code" class="message message--error">
      {{ getMileageValidationMessage(code) }}
    </p>
    <p v-if="isAboveNewerReading" class="message message--error">
      Mileage cannot be higher than a later reading.
    </p>
    <p v-for="code in validation.warnings" :key="code" class="message message--warning">
      {{ getMileageValidationMessage(code) }}
    </p>

    <button class="button button--primary button--full" type="submit" :disabled="!valid">
      Save changes
    </button>
  </form>
</template>
