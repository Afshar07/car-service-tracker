<script setup lang="ts">
import type { IMileageReading } from "~/types/car";
import type { IOcrProgress, IOcrResult } from "~/types/ocr";
import { getMileageValidationMessage } from "~/utils/mileage-messages";
import { validateMileage } from "~/utils/mileage";
import { recognizeOdometer } from "~/utils/odometer-ocr.client";

interface IProps {
  previousMileageKm?: number;
}

interface IEmits {
  save: [reading: IMileageReading];
  cancel: [];
}

const props = defineProps<IProps>();
const emit = defineEmits<IEmits>();

const imageUrl = ref<string>();
const detectedMileageKm = ref<number>();
const mileageInput = ref("");
const manualEntry = ref(false);
const ocrResult = ref<IOcrResult>();
const processedImageUrl = ref<string>();
const progress = ref<IOcrProgress>();
const processing = ref(false);
const errorMessage = ref("");
const servicePerformed = ref(false);
const mileageInputElement = useTemplateRef<HTMLInputElement>("mileageInput");

const MAX_IMAGE_BYTES = 15 * 1024 * 1024;

const parsedMileage = computed(() => mileageInput.value.trim() === "" ? Number.NaN : Number(mileageInput.value));
const validation = computed(() => validateMileage(parsedMileage.value, props.previousMileageKm));

function selectImage(event: Event): void {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  if (!file.type.startsWith("image/")) {
    input.value = "";
    errorMessage.value = "Please choose an image file (JPG, PNG, or HEIC).";
    return;
  }
  if (file.size > MAX_IMAGE_BYTES) {
    input.value = "";
    errorMessage.value = "That image is too large. Please choose a photo smaller than 15 MB.";
    return;
  }
  if (imageUrl.value) URL.revokeObjectURL(imageUrl.value);
  if (processedImageUrl.value) URL.revokeObjectURL(processedImageUrl.value);
  // Keep an independent Blob alive after clearing the input. This also avoids
  // mobile browsers releasing a camera/gallery File while the image is loading.
  imageUrl.value = URL.createObjectURL(new Blob([file], { type: file.type }));
  input.value = "";
  ocrResult.value = undefined;
  processedImageUrl.value = undefined;
  detectedMileageKm.value = undefined;
  mileageInput.value = "";
  manualEntry.value = false;
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
    if (result.mileageCandidate === undefined) {
      manualEntry.value = true;
      await nextTick();
      mileageInputElement.value?.focus();
    }
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : "The odometer could not be read.";
    manualEntry.value = true;
    await nextTick();
    mileageInputElement.value?.focus();
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
    servicePerformed: servicePerformed.value,
    ...(detectedMileageKm.value !== undefined && detectedMileageKm.value !== mileageKm
      ? { detectedMileageKm: detectedMileageKm.value }
      : {}),
  });
}

function showManualInput(): void {
  manualEntry.value = true;
  mileageInput.value = "";
  nextTick(() => mileageInputElement.value?.focus());
}

function adjustCrop(): void {
  ocrResult.value = undefined;
  manualEntry.value = false;
  mileageInput.value = "";
  errorMessage.value = "";
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
        <strong>Take photo</strong>
        <span>Use a clear, straight-on dashboard photo.</span>
        <input type="file" accept="image/*" capture="environment" @change="selectImage">
      </label>
      <label class="camera-button camera-button--secondary">
        <span class="camera-button__icon">▧</span>
        <strong>Choose from library</strong>
        <span>Select an existing odometer photo.</span>
        <input type="file" accept="image/*" @change="selectImage">
      </label>
      <button class="text-button" type="button" @click="showManualInput">Enter mileage manually</button>
    </template>

    <ImageCropper v-if="imageUrl" v-show="!ocrResult && !processing" :image-url="imageUrl" @crop="runOcr" />

    <div v-if="processing" class="processing" aria-live="polite">
      <div class="spinner" />
      <strong>Reading the odometer…</strong>
      <span>{{ progress?.status }}</span>
      <progress :value="progress?.progress ?? 0" max="1" />
    </div>

    <div v-if="errorMessage" class="message message--error">{{ errorMessage }}</div>

    <section v-if="ocrResult || manualEntry" class="confirmation">
      <p class="eyebrow">Confirm reading</p>
      <p v-if="ocrResult && ocrResult.mileageCandidate === undefined" class="message message--error">Could not detect a complete mileage reading.</p>
      <img v-if="processedImageUrl" :src="processedImageUrl" alt="Processed odometer crop" class="processed-image">
      <label class="mileage-field">
        <span>Mileage</span>
        <span class="mileage-field__input"><input ref="mileageInput" v-model="mileageInput" inputmode="numeric" pattern="[0-9]*"> <b>km</b></span>
      </label>
      <p v-if="ocrResult?.mileageCandidate !== undefined" class="helper">
        {{ ocrResult.method === "seven-segment" ? "Digital display reader" : "OCR" }} confidence:
        {{ Math.round(ocrResult.confidence) }}%. This is a suggestion—confirm the number before saving.
      </p>
      <details v-if="ocrResult" class="ocr-debug">
        <summary>Show raw OCR details</summary>
        <pre>{{ ocrResult.rawText || "(no text detected)" }}</pre>
      </details>
      <label class="switch-field">
        <span>
          <strong>Service completed</strong>
          <small>Reset the service countdown from this mileage.</small>
        </span>
        <input v-model="servicePerformed" type="checkbox" role="switch">
      </label>
      <p v-for="code in validation.errors" :key="code" class="message message--error">{{ getMileageValidationMessage(code) }}</p>
      <p v-for="code in validation.warnings" :key="code" class="message message--warning">{{ getMileageValidationMessage(code) }}</p>
      <button class="button button--primary button--full" type="button" :disabled="!validation.valid" @click="save">Save confirmed mileage</button>
      <button v-if="imageUrl" class="text-button" type="button" @click="adjustCrop">Adjust crop</button>
    </section>
  </div>
</template>
