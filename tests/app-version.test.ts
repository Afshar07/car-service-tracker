import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { readAppVersion } from "../scripts/app-version.mjs";
import { updateAndroidVersion } from "../scripts/release.mjs";

const source = 'android {\n  versionCode 7\n  versionName "1.2"\n}\n';
describe("build-time application version", () => {
  it("preserves the exact installed Android label", () => {
    expect(readAppVersion(source)).toBe("1.2");
    const gradle = readFileSync(new URL("../capacitor/android/app/build.gradle", import.meta.url), "utf8");
    expect(readAppVersion()).toBe(readAppVersion(gradle));
  });
  it("automatically exposes release-helper bumps without another version file", () => {
    expect(readAppVersion(updateAndroidVersion(source, "1.2.1"))).toBe("1.2.1");
  });
  it.each(["", source + 'versionName "2.0"\n', source.replace('"1.2"', "computed")])("fails builds on missing or ambiguous version sources", (input) => {
    expect(() => readAppVersion(input)).toThrow();
  });
});
