import { cp, mkdir, rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const tesseractPackage = join(dirname(require.resolve("tesseract.js")), "..");
const coreSource = join(tesseractPackage, "..", "tesseract.js-core");
const engSource = dirname(require.resolve("@tesseract.js-data/eng"));
const output = join(process.cwd(), "public", "ocr");

await rm(output, { recursive: true, force: true });
await mkdir(join(output, "core"), { recursive: true });
await mkdir(join(output, "lang"), { recursive: true });
await cp(join(tesseractPackage, "dist", "worker.min.js"), join(output, "worker.min.js"));

for (const file of [
  "tesseract-core-lstm.js",
  "tesseract-core-lstm.wasm",
  "tesseract-core-lstm.wasm.js",
  "tesseract-core-simd-lstm.js",
  "tesseract-core-simd-lstm.wasm",
  "tesseract-core-simd-lstm.wasm.js",
]) {
  await cp(join(coreSource, file), join(output, "core", file));
}

await cp(join(engSource, "4.0.0", "eng.traineddata.gz"), join(output, "lang", "eng.traineddata.gz"));
