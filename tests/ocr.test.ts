import { describe, expect, it } from "vitest";
import { extractMileageCandidate } from "~/utils/odometer-ocr.client";

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
