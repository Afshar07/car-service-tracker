import { readFileSync } from "node:fs";

/** Build-only: preserve the exact Android release label, including older X.Y versions. */
export function readAppVersion(source = readFileSync(new URL("../capacitor/android/app/build.gradle", import.meta.url), "utf8")) {
  const declarations = [...source.matchAll(/^\s*versionName\b/gm)];
  const names = [...source.matchAll(/^\s*versionName\s+(["'])(\d+\.\d+(?:\.\d+)?)\1\s*(?:\/\/[^\r\n]*)?$/gm)];
  if (declarations.length !== 1 || names.length !== 1) throw new Error("Expected one literal Android release versionName.");
  return names[0][2];
}
