<script setup lang="ts">
import type { IMileageReading } from "~/types/car";
import type { IOcrProgress, IOcrResult } from "~/types/ocr";
import { getMileageValidationMessage } from "~/utils/mileage-messages";
import { validateMileage } from "~/utils/mileage";
import { recognizeOdometer } from "~/utils/odometer-ocr.client";
import type { TImageSource } from "~/types/image-capture";
import { getImageCaptureError, isNativeImageCapture, selectNativeImage, validateSelectedImage } from "~/utils/image-capture.client";

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
const cameraInput = useTemplateRef<HTMLInputElement>("cameraInput");
const libraryInput = useTemplateRef<HTMLInputElement>("libraryInput");
const selectingImage = ref(false);
let disposed = false;

const parsedMileage = computed(() => mileageInput.value.trim() === "" ? Number.NaN : Number(mileageInput.value));
const validation = computed(() => validateMileage(parsedMileage.value, props.previousMileageKm));

function selectImage(event: Event): void {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  const image = file ? new Blob([file], { type: file.type }) : undefined;
  input.value = "";
  if (!image) return;
  acceptImage(image);
}

function acceptImage(image: Blob): void {
  const error = validateSelectedImage(image);
  if (error) {
    errorMessage.value = error;
    return;
  }
  if (imageUrl.value) URL.revokeObjectURL(imageUrl.value);
  if (processedImageUrl.value) URL.revokeObjectURL(processedImageUrl.value);
  // The preview owns its Blob independently of the browser input/native picker.
  imageUrl.value = URL.createObjectURL(new Blob([image], { type: image.type }));
  ocrResult.value = undefined;
  processedImageUrl.value = undefined;
  detectedMileageKm.value = undefined;
  mileageInput.value = "";
  manualEntry.value = false;
  errorMessage.value = "";
}

async function openImageSource(source: TImageSource): Promise<void> {
  if (selectingImage.value) return;
  errorMessage.value = "";
  if (!isNativeImageCapture()) {
    (source === "camera" ? cameraInput.value : libraryInput.value)?.click();
    return;
  }
  selectingImage.value = true;
  try {
    const image = await selectNativeImage(source);
    if (!disposed) acceptImage(image);
  } catch (error) {
    if (!disposed) errorMessage.value = getImageCaptureError(error) ?? "";
  } finally {
    selectingImage.value = false;
  }
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
  disposed = true;
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
      <button class="camera-button" type="button" :disabled="selectingImage" @click="openImageSource('camera')">
        <span class="camera-button__icon">▣</span>
        <strong>Take photo</strong>
        <span>Use a clear, straight-on dashboard photo.</span>
      </button>
      <input ref="cameraInput" hidden type="file" accept="image/*" capture="environment" @change="selectImage">
      <button class="camera-button camera-button--secondary" type="button" :disabled="selectingImage" @click="openImageSource('library')">
        <span class="camera-button__icon">▧</span>
        <strong>Choose from library</strong>
        <span>Select an existing odometer photo.</span>
      </button>
      <input ref="libraryInput" hidden type="file" accept="image/*" @change="selectImage">
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
        {{ ocrResult.method === "seven-segment" ? "Digital display reader" : ocrResult.method === "mlkit" ? "On-device ML Kit" : "OCR" }} confidence:
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
      <button class="button button--primary button--full confirmation__save" type="button" :disabled="!validation.valid" @click="save">Save confirmed mileage</button>
      <button v-if="imageUrl" class="text-button" type="button" @click="adjustCrop">Adjust crop</button>
    </section>
  </div>
</template>
