<script setup lang="ts">
import type { IMileageReading } from "~/types/car";
import type { IOcrProgress, IOcrResult } from "~/types/ocr";
import { getMileageValidationMessage } from "~/utils/mileage-messages";
import { validateMileage } from "~/utils/mileage";
import { recognizeOdometer } from "~/utils/odometer-ocr.client";

interface IProps {
  previousMileageKm?: number;
}

const props = defineProps<IProps>();
const emit = defineEmits<{ save: [reading: IMileageReading]; cancel: [] }>();

const imageUrl = ref<string>();
const detectedMileageKm = ref<number>();
const mileageInput = ref("");
const ocrResult = ref<IOcrResult>();
const processedImageUrl = ref<string>();
const progress = ref<IOcrProgress>();
const processing = ref(false);
const errorMessage = ref("");

const parsedMileage = computed(() => mileageInput.value.trim() === "" ? Number.NaN : Number(mileageInput.value));
const validation = computed(() => validateMileage(parsedMileage.value, props.previousMileageKm));

function selectImage(event: Event): void {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  if (imageUrl.value) URL.revokeObjectURL(imageUrl.value);
  imageUrl.value = URL.createObjectURL(file);
  ocrResult.value = undefined;
  errorMessage.value = "";
}

async function runOcr(image: Blob): Promise<void> {
  processing.value = true;
  errorMessage.value = "";
  progress.value = { status: "Preparing image", progress: 0 };
  try {
    const result = await recognizeOdometer(image, (nextProgress) => { progress.value = nextProgress; });
    if (processedImageUrl.value) URL.revokeObjectURL(processedImageUrl.value);
    ocrResult.value = result;
    processedImageUrl.value = URL.createObjectURL(result.processedImage);
    detectedMileageKm.value = result.mileageCandidate;
    mileageInput.value = result.mileageCandidate?.toString() ?? "";
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : "The odometer could not be read.";
  } finally {
    processing.value = false;
  }
}

function save(): void {
  if (!validation.value.valid) return;
  const mileageKm = parsedMileage.value;
  emit("save", {
    id: crypto.randomUUID(),
    mileageKm,
    recordedAt: new Date().toISOString(),
    ...(detectedMileageKm.value !== undefined && detectedMileageKm.value !== mileageKm
      ? { detectedMileageKm: detectedMileageKm.value }
      : {}),
  });
}

onBeforeUnmount(() => {
  if (imageUrl.value) URL.revokeObjectURL(imageUrl.value);
  if (processedImageUrl.value) URL.revokeObjectURL(processedImageUrl.value);
});
</script>

<template>
  <div class="capture">
    <header class="panel-header">
      <div>
        <p class="eyebrow">New reading</p>
        <h2>Photograph your odometer</h2>
      </div>
      <button class="icon-button" type="button" aria-label="Close" @click="emit('cancel')">×</button>
    </header>

    <template v-if="!imageUrl">
      <label class="camera-button">
        <span class="camera-button__icon">▣</span>
        <strong>Take or choose a photo</strong>
        <span>Use a clear, straight-on dashboard photo.</span>
        <input type="file" accept="image/*" capture="environment" @change="selectImage">
      </label>
      <button class="text-button" type="button" @click="mileageInput = ' '">Enter mileage manually</button>
    </template>

    <ImageCropper v-else-if="!ocrResult && !processing" :image-url="imageUrl" @crop="runOcr" />

    <div v-if="processing" class="processing" aria-live="polite">
      <div class="spinner" />
      <strong>Reading the odometer…</strong>
      <span>{{ progress?.status }}</span>
      <progress :value="progress?.progress ?? 0" max="1" />
    </div>

    <div v-if="errorMessage" class="message message--error">{{ errorMessage }} You can adjust the crop or enter it manually.</div>

    <section v-if="ocrResult || mileageInput" class="confirmation">
      <p class="eyebrow">Confirm reading</p>
      <img v-if="processedImageUrl" :src="processedImageUrl" alt="Processed odometer crop" class="processed-image">
      <label class="mileage-field">
        <span>Mileage</span>
        <span class="mileage-field__input"><input v-model="mileageInput" inputmode="numeric" pattern="[0-9]*" autofocus> <b>km</b></span>
      </label>
      <p v-if="ocrResult" class="helper">
        {{ ocrResult.method === "seven-segment" ? "Digital display reader" : "OCR" }} confidence:
        {{ Math.round(ocrResult.confidence) }}%. Check the number before saving.
      </p>
      <p v-for="code in validation.errors" :key="code" class="message message--error">{{ getMileageValidationMessage(code) }}</p>
      <p v-for="code in validation.warnings" :key="code" class="message message--warning">{{ getMileageValidationMessage(code) }}</p>
      <button class="button button--primary button--full" type="button" :disabled="!validation.valid" @click="save">Save confirmed mileage</button>
      <button v-if="imageUrl" class="text-button" type="button" @click="ocrResult = undefined">Adjust crop</button>
    </section>
  </div>
</template>
