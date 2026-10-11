import { describe, expect, it } from "vitest";
import { applyAdaptiveThreshold, applyLocalContrast } from "~/utils/ocr-preprocess";

describe("applyAdaptiveThreshold", () => {
  it("keeps bright digits on a gradient background", () => {
    const width = 40;
    const height = 20;
    const gray = new Uint8ClampedArray(width * height);
    for (let y = 0; y < height; y += 1) for (let x = 0; x < width; x += 1) gray[y * width + x] = 60 + x * 3;
    for (let y = 8; y < 12; y += 1) for (let x = 30; x < 34; x += 1) gray[y * width + x] = 255;
    const out = applyAdaptiveThreshold(gray, width, height, 5, 10);
    expect(out[10 * width + 31]).toBe(255);
    expect(out[2 * width + 35]).toBe(0);
  });

  it("returns a uniform image for flat input without throwing", () => {
    const out = applyAdaptiveThreshold(new Uint8ClampedArray(100).fill(255), 10, 10);
    expect(new Set(out).size).toBe(1);
  });
});

describe("applyLocalContrast", () => {
  it("stays within 0-255 for all-black and all-white input", () => {
    for (const value of [0, 255]) {
      const out = applyLocalContrast(new Uint8ClampedArray(64).fill(value), 8, 8, 4);
      expect(out).toHaveLength(64);
      expect(Math.min(...out)).toBeGreaterThanOrEqual(0);
      expect(Math.max(...out)).toBeLessThanOrEqual(255);
    }
  });

  it("stretches a low-contrast tile", () => {
    const gray = new Uint8ClampedArray(64);
    for (let i = 0; i < 64; i += 1) gray[i] = 100 + (i % 8) * 4;
    const out = applyLocalContrast(gray, 8, 8, 8);
    expect(Math.max(...out) - Math.min(...out)).toBeGreaterThan(200);
  });
});

describe("applyLocalContrast on flat noisy tiles", () => {
  it("does not amplify low-range noise into black/white speckle", () => {
    const gray = new Uint8ClampedArray(64);
    for (let i = 0; i < 64; i += 1) gray[i] = 126 + (i * 7) % 5;
    const out = applyLocalContrast(gray, 8, 8, 8);
    expect(Math.min(...out)).toBeGreaterThanOrEqual(126);
    expect(Math.max(...out)).toBeLessThanOrEqual(130);
  });
});
