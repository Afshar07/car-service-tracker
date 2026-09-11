import { describe, expect, it } from "vitest";
import type { IMileageReading, IServiceSettings } from "~/types/car";
import {
  calculateAverageDailyKm,
  calculateNextServiceMileage,
  calculateServiceStatus,
  calculateServiceSummary,
  validateMileage,
} from "~/utils/mileage";

function createReading(mileageKm: number, recordedAt: string): IMileageReading {
  return { id: `${mileageKm}-${recordedAt}`, mileageKm, recordedAt };
}

const settings: IServiceSettings = {
  id: "service",
  lastServiceMileageKm: 170_000,
  serviceIntervalKm: 10_000,
};

describe("validateMileage", () => {
  it("accepts an increasing integer reading", () => {
    expect(validateMileage(170_307, 170_000)).toEqual({ valid: true, errors: [], warnings: [] });
  });

  it("rejects readings below the previous mileage", () => {
    expect(validateMileage(169_999, 170_000)).toMatchObject({ valid: false, errors: ["lower-than-previous"] });
  });

  it.each([[-1, "negative"], [4.5, "not-integer"], [10_000_000, "too-large"]])(
    "rejects invalid mileage %s",
    (mileage, code) => {
      expect(validateMileage(mileage)).toMatchObject({ valid: false, errors: [code] });
    },
  );

  it("warns about duplicates without blocking them", () => {
    expect(validateMileage(170_000, 170_000)).toEqual({ valid: true, errors: [], warnings: ["duplicate"] });
  });

  it("warns about unusually large increases without blocking them", () => {
    expect(validateMileage(180_000, 170_000)).toEqual({ valid: true, errors: [], warnings: ["large-increase"] });
  });
});

describe("service calculations", () => {
  it("calculates the next service mileage", () => {
    expect(calculateNextServiceMileage(settings)).toBe(180_000);
  });

  it.each([
    [2_000, "on-track"],
    [1_000, "due-soon"],
    [0, "overdue"],
    [-200, "overdue"],
  ])("maps %s remaining km to %s", (remaining, status) => {
    expect(calculateServiceStatus(remaining, 10_000)).toBe(status);
  });

  it("uses ten percent when the interval is below 10,000 km", () => {
    expect(calculateServiceStatus(501, 5_000)).toBe("on-track");
    expect(calculateServiceStatus(500, 5_000)).toBe("due-soon");
  });
});

describe("driving-rate estimate", () => {
  it("calculates average daily mileage independent of input order", () => {
    const readings = [
      createReading(170_700, "2026-01-08T00:00:00.000Z"),
      createReading(170_000, "2026-01-01T00:00:00.000Z"),
    ];
    expect(calculateAverageDailyKm(readings)).toBe(100);
  });

  it("requires readings spanning at least seven days", () => {
    const readings = [
      createReading(170_500, "2026-01-06T00:00:00.000Z"),
      createReading(170_000, "2026-01-01T00:00:00.000Z"),
    ];
    expect(calculateAverageDailyKm(readings)).toBeUndefined();
  });

  it("does not estimate from zero movement", () => {
    const readings = [
      createReading(170_000, "2026-01-08T00:00:00.000Z"),
      createReading(170_000, "2026-01-01T00:00:00.000Z"),
    ];
    expect(calculateAverageDailyKm(readings)).toBeUndefined();
  });

  it("estimates the service date from remaining mileage", () => {
    const readings = [
      createReading(171_000, "2026-01-11T00:00:00.000Z"),
      createReading(170_000, "2026-01-01T00:00:00.000Z"),
    ];
    const summary = calculateServiceSummary(171_000, settings, readings, new Date("2026-01-11T00:00:00.000Z"));
    expect(summary.averageDailyKm).toBe(100);
    expect(summary.estimatedServiceDate?.toISOString()).toBe("2026-04-11T00:00:00.000Z");
  });

  it("returns not configured without current mileage or settings", () => {
    expect(calculateServiceSummary(undefined, settings, [])).toEqual({ status: "not-configured" });
    expect(calculateServiceSummary(170_000, undefined, [])).toEqual({ status: "not-configured" });
  });
});
