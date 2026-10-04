import { describe, expect, it } from "vitest";
import type { IMileageReading } from "~/types/car";
import { createMileageBackup, mergeMileageReadings, parseMileageBackup } from "~/utils/mileage-backup";

const older: IMileageReading = { id: "old", mileageKm: 100000, recordedAt: "2026-09-01T10:00:00.000Z" };
const newer: IMileageReading = {
  id: "new", mileageKm: 101000, recordedAt: "2026-10-01T10:00:00.000Z",
  detectedMileageKm: 101001, servicePerformed: true,
};
const settings = { id: "service" as const, lastServiceMileageKm: 90000, serviceIntervalKm: 10000 };

function parse(readings = [newer, older]) {
  return parseMileageBackup(JSON.stringify(createMileageBackup(readings, settings)));
}

describe("mileage backup", () => {
  it("round-trips every persisted detail and settings", () => {
    expect(parse().readings).toEqual([newer, older]);
    expect(parse().serviceSettings).toEqual(settings);
    expect(parse([]).readings).toEqual([]);
    expect(parseMileageBackup(JSON.stringify(createMileageBackup([]))).serviceSettings).toBeNull();
  });

  it.each([
    "not json",
    JSON.stringify({ ...createMileageBackup([]), version: 2 }),
    JSON.stringify({ ...createMileageBackup([]), unit: "mi" }),
    JSON.stringify({ ...createMileageBackup([]), serviceSettings: undefined }),
    JSON.stringify({ ...createMileageBackup([]), serviceSettings: { ...settings, serviceIntervalKm: 0 } }),
    JSON.stringify({ ...createMileageBackup([]), exportedAt: "yesterday" }),
  ])("rejects unsupported or malformed files", json => {
    expect(() => parseMileageBackup(json)).toThrow();
  });

  it.each([
    { ...newer, mileageKm: -1 },
    { ...newer, mileageKm: 1.5 },
    { ...newer, mileageKm: 10000000 },
    { ...newer, recordedAt: "invalid" },
    { ...newer, detectedMileageKm: "101001" },
    { ...newer, servicePerformed: "true" },
    { ...newer, id: "" },
  ])("rejects invalid readings", reading => {
    expect(() => parse([reading as IMileageReading])).toThrow();
  });

  it("rejects duplicate IDs within a file", () => {
    expect(() => parse([newer, newer])).toThrow(/duplicate/);
  });

  it("merges in date order and makes repeated imports idempotent", () => {
    expect(mergeMileageReadings([older], parse().readings)).toEqual([newer, older]);
    expect(mergeMileageReadings([newer, older], parse().readings)).toEqual([newer, older]);
  });

  it("rejects conflicts without altering existing data", () => {
    const existing = [{ ...older }];
    expect(() => mergeMileageReadings(existing, [{ ...older, mileageKm: 99999 }])).toThrow(/conflicts/);
    expect(existing).toEqual([older]);
  });

  it("rejects decreases including conflicts with existing chronological history", () => {
    expect(() => mergeMileageReadings([older], [{ ...newer, mileageKm: 99999 }])).toThrow(/decrease/);
  });

  it("accepts equivalent timestamps and normalizes to ISO", () => {
    const imported = parse([{ ...newer, recordedAt: "2026-10-01T13:30:00+03:30" }]).readings;
    expect(imported[0]?.recordedAt).toBe(newer.recordedAt);
    expect(mergeMileageReadings([newer], imported)).toEqual([newer]);
  });
});
