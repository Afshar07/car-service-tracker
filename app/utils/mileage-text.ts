export function extractMileageCandidate(text: string): number | undefined {
  const direct = text.match(/\d{3,7}/g) ?? [];
  const spaced = text.match(/(?<!\d)\d{1,3}(?:\s+\d{1,3})+(?!\d)/g)?.map((value) => value.replace(/\s+/g, "")) ?? [];
  const candidates = [...direct, ...spaced].filter((value) => value.length >= 3 && value.length <= 7)
    .map(Number).filter(Number.isSafeInteger);
  return candidates.sort((first, second) => second.toString().length - first.toString().length)[0];
}

/**
 * Mileage from ML Kit's free multi-line text. Unlike single-line Tesseract output, digits must not be
 * joined across lines or spaces ("20 40 60" is a gauge scale, not 204060). Thousands separators are
 * accepted; lines mentioning ODO or km win over longer unrelated numbers.
 */
export function extractMlKitMileage(text: string): number | undefined {
  const lines = text.split(/\r?\n/);
  const fromLines = (selected: string[]): number | undefined => selected
    .flatMap((line) => line.match(/(?<![\d.,])\d{1,3}(?:[,.]\d{3})+(?![\d])|(?<![\d.,])\d{3,7}(?![\d])/g) ?? [])
    .map((value) => value.replace(/[,.]/g, ""))
    .filter((value) => value.length >= 3 && value.length <= 7)
    .map(Number)
    .filter(Number.isSafeInteger)
    .sort((first, second) => second.toString().length - first.toString().length)[0];
  return fromLines(lines.filter((line) => /\bodo\b|km/i.test(line))) ?? fromLines(lines);
}
