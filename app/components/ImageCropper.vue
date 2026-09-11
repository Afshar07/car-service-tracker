<script setup lang="ts">
import type { ICropBounds } from "~/types/ocr";

interface IProps {
  imageUrl: string;
}

const props = defineProps<IProps>();
const emit = defineEmits<{ crop: [image: Blob] }>();

const imageElement = useTemplateRef<HTMLImageElement>("image");
const bounds = reactive<ICropBounds>({ xPercent: 10, yPercent: 54, widthPercent: 80, heightPercent: 25 });
const cropping = ref(false);

const cropStyle = computed(() => ({
  left: `${bounds.xPercent}%`,
  top: `${bounds.yPercent}%`,
  width: `${bounds.widthPercent}%`,
  height: `${bounds.heightPercent}%`,
}));

async function cropImage(): Promise<void> {
  const image = imageElement.value;
  if (!image?.naturalWidth || !image.naturalHeight) return;
  cropping.value = true;

  const sourceX = image.naturalWidth * bounds.xPercent / 100;
  const sourceY = image.naturalHeight * bounds.yPercent / 100;
  const sourceWidth = image.naturalWidth * bounds.widthPercent / 100;
  const sourceHeight = image.naturalHeight * bounds.heightPercent / 100;
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
</script>

<template>
  <section class="cropper">
    <p class="helper">Move the sliders until the box contains only the odometer digits.</p>
    <div class="cropper__stage">
      <img ref="image" :src="props.imageUrl" alt="Dashboard selected for cropping">
      <div class="cropper__selection" :style="cropStyle" aria-hidden="true" />
    </div>
    <div class="cropper__controls">
      <label>Left <input v-model.number="bounds.xPercent" type="range" min="0" max="70"></label>
      <label>Top <input v-model.number="bounds.yPercent" type="range" min="0" max="85"></label>
      <label>Width <input v-model.number="bounds.widthPercent" type="range" min="20" :max="100 - bounds.xPercent"></label>
      <label>Height <input v-model.number="bounds.heightPercent" type="range" min="10" :max="100 - bounds.yPercent"></label>
    </div>
    <button class="button button--primary button--full" type="button" :disabled="cropping" @click="cropImage">
      {{ cropping ? "Preparing…" : "Read this area" }}
    </button>
  </section>
</template>
