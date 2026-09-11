import type { ICropBounds } from "~/types/ocr";

export interface IRgbaImage {
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

interface IRun {
  start: number;
  end: number;
  top: number;
  bottom: number;
}

function isDisplayPixel(data: Uint8ClampedArray, index: number): boolean {
  const red = data[index] ?? 0;
  const green = data[index + 1] ?? 0;
  const blue = data[index + 2] ?? 0;
  return red >= 220 && red > green * 1.4 && red > blue * 1.4;
}

function isNeutralDisplayPixel(data: Uint8ClampedArray, index: number): boolean {
  const red = data[index] ?? 0;
  const green = data[index + 1] ?? 0;
  const blue = data[index + 2] ?? 0;
  const brightness = red * 0.299 + green * 0.587 + blue * 0.114;
  return brightness >= 145 && Math.max(red, green, blue) - Math.min(red, green, blue) <= 120;
}

function findColumnRuns(
  image: IRgbaImage,
  fromX: number,
  toX: number,
  fromY: number,
  toY: number,
  pixelPredicate: (data: Uint8ClampedArray, index: number) => boolean = isDisplayPixel,
  bridgeGapOverride?: number,
): IRun[] {
  const minimumPixels = Math.max(2, Math.floor((toY - fromY) * 0.035));
  const bridgeGap = bridgeGapOverride ?? Math.max(2, Math.floor((toY - fromY) * 0.035));
  const runs: IRun[] = [];
  let start: number | undefined;
  let emptyColumns = 0;

  for (let x = fromX; x <= toX + bridgeGap; x += 1) {
    let active = 0;
    if (x < toX) {
      for (let y = fromY; y < toY; y += 1) {
        active += pixelPredicate(image.data, (y * image.width + x) * 4) ? 1 : 0;
      }
    }
    if (active >= minimumPixels) {
      start ??= x;
      emptyColumns = 0;
    } else if (start !== undefined && ++emptyColumns >= bridgeGap) {
      runs.push({ start, end: x - emptyColumns, top: toY, bottom: fromY - 1 });
      start = undefined;
      emptyColumns = 0;
    }
  }

  for (const run of runs) {
    for (let y = fromY; y < toY; y += 1) {
      for (let x = run.start; x <= run.end; x += 1) {
        if (pixelPredicate(image.data, (y * image.width + x) * 4)) {
          run.top = Math.min(run.top, y);
          run.bottom = Math.max(run.bottom, y);
        }
      }
    }
  }
  return runs.filter((run) => run.bottom >= run.top);
}

/** Suggests a conservative crop around an upper red/orange odometer row. */
function suggestRedCrop(image: IRgbaImage): ICropBounds | undefined {
  if (image.width < 80 || image.height < 40 || image.data.length < image.width * image.height * 4) return undefined;

  // Dashboard odometers are normally in the upper display half. Restricting
  // this search prevents a larger clock row and side gauges from winning.
  const searchLeft = Math.floor(image.width * 0.42);
  const searchRight = Math.ceil(image.width * 0.79);
  const searchTop = Math.floor(image.height * 0.2);
  const searchBottom = Math.ceil(image.height * 0.5);
  const bandHeight = Math.max(32, Math.round(image.width * 0.08));
  const rowCounts = new Uint32Array(image.height);

  for (let y = searchTop; y < searchBottom; y += 1) {
    let active = 0;
    for (let x = searchLeft; x < searchRight; x += 1) {
      active += isDisplayPixel(image.data, (y * image.width + x) * 4) ? 1 : 0;
    }
    rowCounts[y] = active;
  }

  let bestTop = searchTop;
  let bestScore = 0;
  let score = 0;
  for (let y = searchTop; y < Math.min(searchBottom, searchTop + bandHeight); y += 1) score += rowCounts[y] ?? 0;
  bestScore = score;
  for (let top = searchTop + 1; top + bandHeight <= searchBottom; top += 1) {
    score -= rowCounts[top - 1] ?? 0;
    score += rowCounts[top + bandHeight - 1] ?? 0;
    if (score > bestScore) {
      bestScore = score;
      bestTop = top;
    }
  }
  if (bestScore < bandHeight * 2) return undefined;

  const bandBottom = Math.min(image.height, bestTop + bandHeight);
  const runs = findColumnRuns(image, searchLeft, searchRight, bestTop, bandBottom);
  if (runs.length < 3) return undefined;
  const extents = runs.map((run) => run.bottom - run.top + 1).sort((a, b) => a - b);
  const medianExtent = extents[Math.floor(extents.length / 2)] ?? 0;
  const alignedRuns = runs.filter((run) => run.bottom - run.top + 1 >= medianExtent * 0.65);
  const clusters: IRun[][] = [];
  const gaps = alignedRuns.slice(1).map((run, index) => run.start - alignedRuns[index]!.end);
  const sortedGaps = [...gaps].sort((a, b) => a - b);
  const medianGap = sortedGaps[Math.floor(sortedGaps.length / 2)] ?? 0;
  const maximumDigitGap = Math.max(bandHeight * 0.2, medianGap * 2);
  for (const run of alignedRuns) {
    const cluster = clusters[clusters.length - 1];
    const previous = cluster?.[cluster.length - 1];
    if (!cluster || !previous || run.start - previous.end > maximumDigitGap) clusters.push([run]);
    else cluster.push(run);
  }
  const digitRuns = clusters
    .filter((cluster) => cluster.length >= 3 && cluster.length <= 8)
    .sort((first, second) => second.length - first.length)[0];
  if (!digitRuns) return undefined;

  const left = digitRuns[0]!.start;
  const right = digitRuns[digitRuns.length - 1]!.end + 1;
  const top = Math.min(...digitRuns.map((run) => run.top));
  const bottom = Math.max(...digitRuns.map((run) => run.bottom)) + 1;
  const width = right - left;
  const height = bottom - top;
  if (width < image.width * 0.08 || width > image.width * 0.4 || height < bandHeight * 0.35) return undefined;

  const horizontalPadding = Math.max(4, width * 0.04);
  const verticalPadding = Math.max(4, height * 0.1);
  const cropLeft = Math.max(0, left - horizontalPadding);
  const cropTop = Math.max(0, top - verticalPadding);
  const cropRight = Math.min(image.width, right + horizontalPadding);
  const cropBottom = Math.min(image.height, bottom + verticalPadding);
  return {
    xPercent: cropLeft / image.width * 100,
    yPercent: cropTop / image.height * 100,
    widthPercent: (cropRight - cropLeft) / image.width * 100,
    heightPercent: (cropBottom - cropTop) / image.height * 100,
  };
}

/** Finds a regular neutral/white LCD digit row when no red display is present. */
function suggestNeutralCrop(image: IRgbaImage): ICropBounds | undefined {
  const left = Math.floor(image.width * 0.38);
  const right = Math.ceil(image.width * 0.64);
  const top = Math.floor(image.height * 0.5);
  const bottom = Math.ceil(image.height * 0.9);
  const bandHeight = Math.max(18, Math.round(image.width * 0.065));
  let best: { runs: IRun[]; score: number } | undefined;

  for (let bandTop = top; bandTop + bandHeight <= bottom; bandTop += Math.max(2, Math.floor(bandHeight * 0.08))) {
    const runs = findColumnRuns(image, left, right, bandTop, bandTop + bandHeight, isNeutralDisplayPixel, 1)
      .filter((run) => {
        const extent = run.bottom - run.top + 1;
        const width = run.end - run.start + 1;
        return extent >= bandHeight * 0.3 && extent <= bandHeight && width >= 2 && width <= bandHeight * 0.8;
      });
    if (runs.length < 3) continue;

    for (let start = 0; start < runs.length; start += 1) {
      for (let end = start + 2; end < Math.min(runs.length, start + 7); end += 1) {
        const group = runs.slice(start, end + 1);
        const widths = group.map((run) => run.end - run.start + 1).sort((a, b) => a - b);
        const heights = group.map((run) => run.bottom - run.top + 1).sort((a, b) => a - b);
        const gaps = group.slice(1).map((run, index) => run.start - group[index]!.end);
        const medianWidth = widths[Math.floor(widths.length / 2)] ?? 1;
        const medianHeight = heights[Math.floor(heights.length / 2)] ?? 1;
        const medianGap = [...gaps].sort((a, b) => a - b)[Math.floor(gaps.length / 2)] ?? 1;
        const maximumGap = Math.max(...gaps);
        const gapVariation = gaps.reduce((sum, gap) => sum + Math.abs(gap - medianGap), 0) /
          Math.max(1, gaps.length * medianGap);
        const topSpread = Math.max(...group.map((run) => run.top)) - Math.min(...group.map((run) => run.top));
        const bottomSpread = Math.max(...group.map((run) => run.bottom)) - Math.min(...group.map((run) => run.bottom));
        const groupWidth = group[group.length - 1]!.end - group[0]!.start + 1;
        if (
          Math.min(...heights) < medianHeight * 0.6 ||
          maximumGap > Math.max(bandHeight * 0.45, medianGap * 2.5) ||
          topSpread > medianHeight * 0.55 ||
          bottomSpread > medianHeight * 0.55 ||
          groupWidth < image.width * 0.055
        ) continue;
        const widthSpread = Math.max(...widths) / Math.max(1, medianWidth);
        const alignmentPenalty = (topSpread + bottomSpread) / Math.max(1, medianHeight);
        // Odometers are conventionally the lowest numeric row in the central
        // driver display. This also avoids selecting range and clock rows.
        const lowerRowBonus = bandTop / image.height * 100;
        const groupCenter = (group[0]!.start + group[group.length - 1]!.end) / 2;
        const centerPenalty = Math.abs(groupCenter / image.width - 0.5) * 100;
        const score = group.length * 2 + lowerRowBonus - centerPenalty - widthSpread * 5 -
          alignmentPenalty * 5 - gapVariation * 5;
        if (!best || score > best.score) best = { runs: group, score };
      }
    }
  }
  if (!best || best.score < 30) return undefined;
  const digitRuns = best.runs;

  const digitLeft = digitRuns[0]!.start;
  const digitRight = digitRuns[digitRuns.length - 1]!.end + 1;
  const digitTop = Math.min(...digitRuns.map((run) => run.top));
  const digitBottom = Math.max(...digitRuns.map((run) => run.bottom)) + 1;
  const width = digitRight - digitLeft;
  const height = digitBottom - digitTop;
  if (width < image.width * 0.08 || width > image.width * 0.45 || height < bandHeight * 0.3) return undefined;

  const horizontalPadding = Math.max(4, width * 0.05);
  const verticalPadding = Math.max(4, height * 0.2);
  const cropLeft = Math.max(0, digitLeft - horizontalPadding);
  const cropTop = Math.max(0, digitTop - verticalPadding);
  const cropRight = Math.min(image.width, digitRight + horizontalPadding);
  const cropBottom = Math.min(image.height, digitBottom + verticalPadding);
  return {
    xPercent: cropLeft / image.width * 100,
    yPercent: cropTop / image.height * 100,
    widthPercent: (cropRight - cropLeft) / image.width * 100,
    heightPercent: (cropBottom - cropTop) / image.height * 100,
  };
}

export function suggestInitialCrop(image: IRgbaImage): ICropBounds | undefined {
  if (image.width < 80 || image.height < 40 || image.data.length < image.width * image.height * 4) return undefined;
  const redCrop = suggestRedCrop(image);
  const neutralCrop = suggestNeutralCrop(image);
  if (redCrop && neutralCrop && redCrop.yPercent < 60 && neutralCrop.yPercent > 55) return neutralCrop;
  return redCrop ?? neutralCrop;
}
