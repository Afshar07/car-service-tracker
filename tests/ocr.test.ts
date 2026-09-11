import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import jpeg from "jpeg-js";
import { PNG } from "pngjs";
import { extractMileageCandidate } from "~/utils/odometer-ocr.client";
import { decodeSevenSegmentImage } from "~/utils/seven-segment-ocr";

interface IFixtureCrop {
  x: number;
  y: number;
  width: number;
  height: number;
}

const pngOdometerBounds: Record<string, IFixtureCrop> = {
  "168240": { x: 675, y: 355, width: 390, height: 115 },
  "172940": { x: 675, y: 355, width: 390, height: 115 },
  "523940": { x: 675, y: 355, width: 390, height: 115 },
  "58370": { x: 675, y: 355, width: 390, height: 115 },
};

const odometerFixtureCrop: IFixtureCrop = { x: 625, y: 330, width: 305, height: 68 };
const paddedOdometerFixtureCrops: IFixtureCrop[] = [
  { x: 600, y: 315, width: 380, height: 100 },
  { x: 610, y: 325, width: 360, height: 80 },
];

function readFixtureCrop(crop: IFixtureCrop) {
  const decoded = jpeg.decode(readFileSync(new URL("./fixtures/odometer-170370.jpg", import.meta.url)), { useTArray: true });
  const data = new Uint8ClampedArray(crop.width * crop.height * 4);
  for (let y = 0; y < crop.height; y += 1) {
    for (let x = 0; x < crop.width; x += 1) {
      const source = ((crop.y + y) * decoded.width + crop.x + x) * 4;
      const target = (y * crop.width + x) * 4;
      data[target] = decoded.data[source]!;
      data[target + 1] = decoded.data[source + 1]!;
      data[target + 2] = decoded.data[source + 2]!;
      data[target + 3] = 255;
    }
  }
  return { data, width: crop.width, height: crop.height };
}

function readPngFixtureCrop(name: string, crop: IFixtureCrop) {
  const decoded = PNG.sync.read(readFileSync(new URL(`./fixtures/odometer-${name}.png`, import.meta.url)));
  const data = new Uint8ClampedArray(crop.width * crop.height * 4);
  for (let y = 0; y < crop.height; y += 1) {
    for (let x = 0; x < crop.width; x += 1) {
      const source = ((crop.y + y) * decoded.width + crop.x + x) * 4;
      const target = (y * crop.width + x) * 4;
      data[target] = decoded.data[source]!;
      data[target + 1] = decoded.data[source + 1]!;
      data[target + 2] = decoded.data[source + 2]!;
      data[target + 3] = decoded.data[source + 3] ?? 255;
    }
  }
  return { data, width: crop.width, height: crop.height };
}

function shiftedCrop(crop: IFixtureCrop): IFixtureCrop {
  return { x: crop.x - 20, y: crop.y - 12, width: crop.width + 40, height: crop.height + 24 };
}

describe("extractMileageCandidate", () => {
  it("extracts the known reference mileage", () => {
    expect(extractMileageCandidate("170307\n")).toBe(170_307);
  });

  it("prefers the longest plausible digit sequence", () => {
    expect(extractMileageCandidate("12 170307 5")).toBe(170_307);
  });

  it("returns undefined when OCR finds no plausible mileage", () => {
    expect(extractMileageCandidate("km --")).toBeUndefined();
  });

  it("joins digit groups around the unit label without accepting incomplete values", () => {
    expect(extractMileageCandidate("170 370 km")).toBe(170_370);
    expect(extractMileageCandidate("17 km")).toBeUndefined();
  });
});

describe("decodeSevenSegmentImage", () => {
  it.each(Object.entries(pngOdometerBounds))("decodes PNG odometer %s", (expected, crop) => {
    expect(decodeSevenSegmentImage(readPngFixtureCrop(expected, crop))?.text).toBe(expected);
  });

  it.each(Object.entries(pngOdometerBounds))("decodes PNG odometer %s with padded bounds", (expected, crop) => {
    expect(decodeSevenSegmentImage(readPngFixtureCrop(expected, shiftedCrop(crop)))?.text).toBe(expected);
  });

  it("decodes the real odometer fixture using its stored display bounds", () => {
    // Bounds cover the upper mileage row, excluding the side indicators and km label.
    expect(decodeSevenSegmentImage(readFixtureCrop(odometerFixtureCrop))?.text).toBe("170370");
  });

  it.each(paddedOdometerFixtureCrops)("ignores unit-label pixels in a realistic padded crop (%j)", (crop) => {
    expect(decodeSevenSegmentImage(readFixtureCrop(crop))?.text).toBe("170370");
  });

  it("detects digit boundaries across a horizontal display row", () => {
    const patterns: Record<string, number[]> = {
      "7": [1, 1, 1, 0, 0, 0, 0],
      "0": [1, 1, 1, 1, 1, 1, 0],
    };
    const text = "707";
    const digitWidth = 28;
    const stride = 36;
    const width = text.length * stride;
    const height = 60;
    const data = new Uint8ClampedArray(width * height * 4);
    const regions = [
      [0.15, 0, 0.85, 0.18], [0.7, 0.08, 1, 0.48], [0.7, 0.52, 1, 0.92],
      [0.15, 0.82, 0.85, 1], [0, 0.52, 0.3, 0.92], [0, 0.08, 0.3, 0.48],
      [0.15, 0.41, 0.85, 0.59],
    ];
    for (let digitIndex = 0; digitIndex < text.length; digitIndex += 1) {
      patterns[text[digitIndex]!]!.forEach((active, segmentIndex) => {
        if (!active) return;
        const [left, top, right, bottom] = regions[segmentIndex]!;
        for (let y = Math.floor(top * height); y < Math.ceil(bottom * height); y += 1) {
          for (let x = Math.floor(left * digitWidth); x < Math.ceil(right * digitWidth); x += 1) {
            const index = (y * width + digitIndex * stride + x) * 4;
            data[index] = 255; data[index + 1] = 50; data[index + 2] = 10; data[index + 3] = 255;
          }
        }
      });
    }
    expect(decodeSevenSegmentImage({ data, width, height })?.text).toBe(text);
  });

  it("decodes a narrow digit 1 between wider digits", () => {
    const patterns: Record<string, number[]> = {
      "0": [1, 1, 1, 1, 1, 1, 0], "1": [0, 1, 1, 0, 0, 0, 0],
      "7": [1, 1, 1, 0, 0, 0, 0],
    };
    const text = "717";
    const digitWidth = 24;
    const widths = [24, 8, 24];
    const starts = [0, 28, 44];
    const width = 68;
    const height = 48;
    const data = new Uint8ClampedArray(width * height * 4);
    const regions = [
      [0.15, 0, 0.85, 0.18], [0.7, 0.08, 1, 0.48], [0.7, 0.52, 1, 0.92],
      [0.15, 0.82, 0.85, 1], [0, 0.52, 0.3, 0.92], [0, 0.08, 0.3, 0.48],
      [0.15, 0.41, 0.85, 0.59],
    ];
    for (let digitIndex = 0; digitIndex < text.length; digitIndex += 1) {
      patterns[text[digitIndex]!]!.forEach((active, segmentIndex) => {
        if (!active) return;
        const [left, top, right, bottom] = regions[segmentIndex]!;
        for (let y = Math.floor(top * height); y < Math.ceil(bottom * height); y += 1) {
          for (let x = Math.floor(left * widths[digitIndex]!); x < Math.ceil(right * widths[digitIndex]!); x += 1) {
            const index = (y * width + starts[digitIndex]! + x) * 4;
            data[index] = 255; data[index + 1] = 50; data[index + 2] = 10; data[index + 3] = 255;
          }
        }
      });
    }
    expect(decodeSevenSegmentImage({ data, width, height })?.text).toBe(text);
  });

  it("decodes a six-digit seven-segment display", () => {
    const patterns: Record<string, number[]> = {
      "0": [1, 1, 1, 1, 1, 1, 0], "1": [0, 1, 1, 0, 0, 0, 0],
      "3": [1, 1, 1, 1, 0, 0, 1], "7": [1, 1, 1, 0, 0, 0, 0],
    };
    const text = "170370";
    const digitWidth = 28;
    const width = text.length * 36;
    const height = 60;
    const data = new Uint8ClampedArray(width * height * 4);
    const regions = [
      [0.15, 0, 0.85, 0.16], [0.76, 0.08, 1, 0.48], [0.76, 0.52, 1, 0.92],
      [0.15, 0.84, 0.85, 1], [0, 0.52, 0.24, 0.92], [0, 0.08, 0.24, 0.48],
      [0.15, 0.42, 0.85, 0.58],
    ];
    for (let digitIndex = 0; digitIndex < text.length; digitIndex += 1) {
      const pattern = patterns[text[digitIndex]!]!;
      const xOffset = digitIndex * 36;
      pattern.forEach((active, segmentIndex) => {
        if (!active) return;
        const [left, top, right, bottom] = regions[segmentIndex]!;
        for (let y = Math.floor(top * height); y < Math.ceil(bottom * height); y += 1) {
          for (let x = Math.floor(left * digitWidth); x < Math.ceil(right * digitWidth); x += 1) {
            const index = (y * width + xOffset + x) * 4;
            data[index] = 255; data[index + 1] = 50; data[index + 2] = 10; data[index + 3] = 255;
          }
        }
      });
    }
    expect(decodeSevenSegmentImage({ data, width, height })?.text).toBe("170370");
  });

  it("rejects a low-confidence incomplete display", () => {
    const data = new Uint8ClampedArray(80 * 40 * 4);
    for (let index = 0; index < data.length; index += 4) {
      data[index] = 180;
      data[index + 1] = 40;
      data[index + 2] = 10;
      data[index + 3] = 255;
    }
    expect(decodeSevenSegmentImage({ data, width: 80, height: 40 })).toBeUndefined();
  });
});
