<script setup lang="ts">
import type { ICropBounds } from "~/types/ocr";
import { suggestInitialCrop } from "~/utils/initial-crop";

interface IProps {
  imageUrl: string;
}

const props = defineProps<IProps>();
const emit = defineEmits<{ crop: [image: Blob] }>();

const imageElement = useTemplateRef<HTMLImageElement>("image");
const bounds = reactive<ICropBounds>({ xPercent: 20, yPercent: 28, widthPercent: 60, heightPercent: 24 });
const cropping = ref(false);
const interaction = ref<{ mode: "move" | "resize"; handle?: string; startX: number; startY: number; bounds: ICropBounds }>();
const hasInteracted = ref(false);

const MIN_SIZE = 8;
const CROP_PADDING_RATIO = 0.04;

const cropStyle = computed(() => ({
  left: `${bounds.xPercent}%`,
  top: `${bounds.yPercent}%`,
  width: `${bounds.widthPercent}%`,
  height: `${bounds.heightPercent}%`,
}));

async function suggestCrop(): Promise<void> {
  if (hasInteracted.value) return;
  const image = imageElement.value;
  if (!image?.naturalWidth || !image.naturalHeight) return;
  const scale = Math.min(1, 720 / image.naturalWidth);
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return;
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  const data = context.getImageData(0, 0, canvas.width, canvas.height).data;
  const suggestion = suggestInitialCrop({ data, width: canvas.width, height: canvas.height });
  if (suggestion && !hasInteracted.value) Object.assign(bounds, suggestion);
}

async function cropImage(): Promise<void> {
  const image = imageElement.value;
  if (!image?.naturalWidth || !image.naturalHeight) return;
  cropping.value = true;

  const horizontalPadding = bounds.widthPercent * CROP_PADDING_RATIO;
  const verticalPadding = bounds.heightPercent * CROP_PADDING_RATIO;
  const left = Math.max(0, bounds.xPercent - horizontalPadding);
  const top = Math.max(0, bounds.yPercent - verticalPadding);
  const right = Math.min(100, bounds.xPercent + bounds.widthPercent + horizontalPadding);
  const bottom = Math.min(100, bounds.yPercent + bounds.heightPercent + verticalPadding);
  const sourceX = image.naturalWidth * left / 100;
  const sourceY = image.naturalHeight * top / 100;
  const sourceWidth = image.naturalWidth * (right - left) / 100;
  const sourceHeight = image.naturalHeight * (bottom - top) / 100;
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(sourceWidth);
  canvas.height = Math.round(sourceHeight);
  const context = canvas.getContext("2d");

  if (!context) {
    cropping.value = false;
    return;
  }

  context.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, canvas.width, canvas.height);
  canvas.toBlob((blob) => {
    cropping.value = false;
    if (blob) emit("crop", blob);
  }, "image/png");
}

function updatePointer(event: PointerEvent): void {
  const stage = imageElement.value?.parentElement;
  const active = interaction.value;
  if (!stage || !active) return;
  const rect = stage.getBoundingClientRect();
  const deltaX = (event.clientX - active.startX) / rect.width * 100;
  const deltaY = (event.clientY - active.startY) / rect.height * 100;
  const start = active.bounds;

  if (active.mode === "move") {
    bounds.xPercent = Math.max(0, Math.min(100 - start.widthPercent, start.xPercent + deltaX));
    bounds.yPercent = Math.max(0, Math.min(100 - start.heightPercent, start.yPercent + deltaY));
    return;
  }

  const handle = active.handle ?? "";
  let left = start.xPercent;
  let top = start.yPercent;
  let right = start.xPercent + start.widthPercent;
  let bottom = start.yPercent + start.heightPercent;
  if (handle.includes("w")) left = Math.max(0, Math.min(right - MIN_SIZE, left + deltaX));
  if (handle.includes("e")) right = Math.min(100, Math.max(left + MIN_SIZE, right + deltaX));
  if (handle.includes("n")) top = Math.max(0, Math.min(bottom - MIN_SIZE, top + deltaY));
  if (handle.includes("s")) bottom = Math.min(100, Math.max(top + MIN_SIZE, bottom + deltaY));
  bounds.xPercent = left;
  bounds.yPercent = top;
  bounds.widthPercent = right - left;
  bounds.heightPercent = bottom - top;
}

function startInteraction(event: PointerEvent, mode: "move" | "resize", handle?: string): void {
  hasInteracted.value = true;
  const target = event.currentTarget as HTMLElement;
  interaction.value = {
    mode,
    handle,
    startX: event.clientX,
    startY: event.clientY,
    bounds: { ...bounds },
  };
  target.setPointerCapture(event.pointerId);
}

watch(() => props.imageUrl, (next, previous) => {
  if (next === previous) return;
  hasInteracted.value = false;
  Object.assign(bounds, { xPercent: 20, yPercent: 28, widthPercent: 60, heightPercent: 24 });
});

function endInteraction(event: PointerEvent): void {
  const target = event.currentTarget as HTMLElement;
  if (target.hasPointerCapture(event.pointerId)) target.releasePointerCapture(event.pointerId);
  interaction.value = undefined;
}
</script>

<template>
  <section class="cropper">
    <p class="helper">Fit the box tightly around every mileage digit. Keep “km”, the clock, and other symbols outside.</p>
    <div class="cropper__stage">
      <img ref="image" :src="props.imageUrl" alt="Dashboard selected for cropping" @load="suggestCrop">
      <div
        class="cropper__selection"
        :style="cropStyle"
        role="application"
        aria-label="Crop selection. Drag to move, or use the handles to resize."
        @pointerdown.stop="startInteraction($event, 'move')"
        @pointermove="updatePointer"
        @pointerup="endInteraction"
        @pointercancel="endInteraction"
      >
        <button v-for="handle in ['nw', 'ne', 'sw', 'se']" :key="handle" class="cropper__handle" :class="`cropper__handle--${handle}`" type="button" :aria-label="`Resize crop ${handle}`" @pointerdown.stop.prevent="startInteraction($event, 'resize', handle)" @pointermove="updatePointer" @pointerup="endInteraction" @pointercancel="endInteraction" />
      </div>
    </div>
    <p class="helper cropper__hint">Drag the box around the mileage digits, then use a corner handle to fine-tune it.</p>
    <button class="button button--primary button--full" type="button" :disabled="cropping" @click="cropImage">
      {{ cropping ? "Preparing…" : "Read this area" }}
    </button>
  </section>
</template>
