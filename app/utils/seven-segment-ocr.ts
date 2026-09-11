import type { ISevenSegmentResult } from "~/types/ocr";

interface IImagePixels {
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

interface IRun {
  start: number;
  end: number;
}

const segmentPatterns: Record<string, readonly number[]> = {
  "0": [1, 1, 1, 1, 1, 1, 0],
  "2": [1, 1, 0, 1, 1, 0, 1],
  "3": [1, 1, 1, 1, 0, 0, 1],
  "4": [0, 1, 1, 0, 0, 1, 1],
  "5": [1, 0, 1, 1, 0, 1, 1],
  "6": [1, 0, 1, 1, 1, 1, 1],
  "7": [1, 1, 1, 0, 0, 0, 0],
  "8": [1, 1, 1, 1, 1, 1, 1],
  "9": [1, 1, 1, 1, 0, 1, 1],
};

function calculateOtsuThreshold(histogram: number[], total: number): number {
  const weightedTotal = histogram.reduce((sum, count, value) => sum + count * value, 0);
  let backgroundWeight = 0;
  let backgroundSum = 0;
  let bestVariance = 0;
  let bestThreshold = 180;

  for (let threshold = 0; threshold < 256; threshold += 1) {
    backgroundWeight += histogram[threshold] ?? 0;
    if (backgroundWeight === 0) continue;
    const foregroundWeight = total - backgroundWeight;
    if (foregroundWeight === 0) break;
    backgroundSum += threshold * (histogram[threshold] ?? 0);
    const backgroundMean = backgroundSum / backgroundWeight;
    const foregroundMean = (weightedTotal - backgroundSum) / foregroundWeight;
    const variance = backgroundWeight * foregroundWeight * (backgroundMean - foregroundMean) ** 2;
    if (variance > bestVariance) {
      bestVariance = variance;
      bestThreshold = threshold;
    }
  }

  return Math.max(120, Math.min(235, bestThreshold));
}

export function createSevenSegmentMask(image: IImagePixels): Uint8Array {
  const histogram = Array.from({ length: 256 }, () => 0);
  for (let index = 0; index < image.data.length; index += 4) {
    const red = image.data[index] ?? 0;
    histogram[red] = (histogram[red] ?? 0) + 1;
  }
  const threshold = calculateOtsuThreshold(histogram, image.width * image.height);
  const mask = new Uint8Array(image.width * image.height);

  for (let pixel = 0; pixel < mask.length; pixel += 1) {
    const index = pixel * 4;
    const red = image.data[index] ?? 0;
    const green = image.data[index + 1] ?? 0;
    const blue = image.data[index + 2] ?? 0;
    mask[pixel] = red >= threshold && red > green * 1.45 && red > blue * 1.45 ? 1 : 0;
  }
  return mask;
}

function findDigitRuns(mask: Uint8Array, width: number, height: number): IRun[] {
  const minimumColumnPixels = Math.max(2, Math.floor(height * 0.02));
  const bridgeGap = Math.max(3, Math.floor(width * 0.018));
  const runs: IRun[] = [];
  let start: number | undefined;
  let emptyColumns = 0;

  for (let x = 0; x <= width + bridgeGap; x += 1) {
    let activePixels = 0;
    if (x < width) {
      for (let y = 0; y < height; y += 1) activePixels += mask[y * width + x] ?? 0;
    }

    if (activePixels > minimumColumnPixels) {
      start ??= x;
      emptyColumns = 0;
    } else if (start !== undefined) {
      emptyColumns += 1;
      if (emptyColumns >= bridgeGap) {
        runs.push({ start, end: x - emptyColumns });
        start = undefined;
        emptyColumns = 0;
      }
    }
  }

  return runs.filter((run) => run.end >= run.start);
}

function regionRatio(
  mask: Uint8Array,
  imageWidth: number,
  xStart: number,
  yStart: number,
  digitWidth: number,
  digitHeight: number,
  region: readonly [number, number, number, number],
): number {
  const [left, top, right, bottom] = region;
  const fromX = xStart + Math.floor(left * digitWidth);
  const toX = xStart + Math.ceil(right * digitWidth);
  const fromY = yStart + Math.floor(top * digitHeight);
  const toY = yStart + Math.ceil(bottom * digitHeight);
  let active = 0;
  let total = 0;
  for (let y = fromY; y < toY; y += 1) {
    for (let x = fromX; x < toX; x += 1) {
      active += mask[y * imageWidth + x] ?? 0;
      total += 1;
    }
  }
  return total ? active / total : 0;
}

export function decodeSevenSegmentImage(image: IImagePixels): ISevenSegmentResult | undefined {
  const mask = createSevenSegmentMask(image);
  const runs = findDigitRuns(mask, image.width, image.height);
  if (runs.length < 3 || runs.length > 8) return undefined;

  const widths = runs.map((run) => run.end - run.start + 1).sort((first, second) => first - second);
  const medianWidth = widths[Math.floor(widths.length / 2)] ?? 1;
  const digits: string[] = [];
  const confidences: number[] = [];

  for (const run of runs) {
    const digitWidth = run.end - run.start + 1;
    if (digitWidth < medianWidth * 0.55) {
      digits.push("1");
      confidences.push(0.92);
      continue;
    }

    let top = image.height;
    let bottom = 0;
    for (let y = 0; y < image.height; y += 1) {
      for (let x = run.start; x <= run.end; x += 1) {
        if (mask[y * image.width + x]) {
          top = Math.min(top, y);
          bottom = Math.max(bottom, y);
        }
      }
    }
    if (bottom <= top) return undefined;

    const digitHeight = bottom - top + 1;
    const regions = [
      [0.15, 0, 0.85, 0.18], [0.7, 0.08, 1, 0.48], [0.7, 0.52, 1, 0.92],
      [0.15, 0.82, 0.85, 1], [0, 0.52, 0.3, 0.92], [0, 0.08, 0.3, 0.48],
      [0.15, 0.41, 0.85, 0.59],
    ] as const;
    const ratios = regions.map((region) => regionRatio(mask, image.width, run.start, top, digitWidth, digitHeight, region));

    let bestDigit = "";
    let bestDistance = Number.POSITIVE_INFINITY;
    for (const [digit, pattern] of Object.entries(segmentPatterns)) {
      const distance = pattern.reduce((sum, expected, index) => {
        const observed = Math.max(0, Math.min(1, ((ratios[index] ?? 0) - 0.25) / 0.35));
        return sum + Math.abs(expected - observed);
      }, 0) / pattern.length;
      if (distance < bestDistance) {
        bestDigit = digit;
        bestDistance = distance;
      }
    }
    if (!bestDigit || bestDistance > 0.42) return undefined;
    digits.push(bestDigit);
    confidences.push(1 - bestDistance);
  }

  return {
    text: digits.join(""),
    confidence: Math.round(confidences.reduce((sum, value) => sum + value, 0) / confidences.length * 100),
  };
}
