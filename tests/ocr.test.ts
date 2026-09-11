import { describe, expect, it } from "vitest";
import { extractMileageCandidate } from "~/utils/odometer-ocr.client";
import { decodeSevenSegmentImage } from "~/utils/seven-segment-ocr";

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
});

describe("decodeSevenSegmentImage", () => {
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
});
