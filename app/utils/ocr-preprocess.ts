const MINIMUM_TILE_RANGE = 24;

/** Per-tile min/max stretch; tiles are independent so glare in one area does not wash out the rest. */
export function applyLocalContrast(gray: Uint8ClampedArray, width: number, height: number, tile = 32): Uint8ClampedArray {
  const out = new Uint8ClampedArray(gray.length);
  for (let top = 0; top < height; top += tile) {
    for (let left = 0; left < width; left += tile) {
      const bottom = Math.min(height, top + tile);
      const right = Math.min(width, left + tile);
      let minimum = 255;
      let maximum = 0;
      for (let y = top; y < bottom; y += 1) for (let x = left; x < right; x += 1) {
        const value = gray[y * width + x]!;
        if (value < minimum) minimum = value;
        if (value > maximum) maximum = value;
      }
      const range = Math.max(1, maximum - minimum);
      // A nearly flat tile holds no digit edge; stretching it would only turn sensor noise into speckle.
      const flat = maximum - minimum < MINIMUM_TILE_RANGE;
      for (let y = top; y < bottom; y += 1) for (let x = left; x < right; x += 1) {
        out[y * width + x] = flat ? gray[y * width + x]! : Math.round((gray[y * width + x]! - minimum) / range * 255);
      }
    }
  }
  return out;
}

/** Pixel is 255 when brighter than its local mean (box window via integral image) plus offset. */
export function applyAdaptiveThreshold(
  gray: Uint8ClampedArray,
  width: number,
  height: number,
  radius = 12,
  offset = 12,
): Uint8ClampedArray {
  const stride = width + 1;
  const integral = new Float64Array(stride * (height + 1));
  for (let y = 0; y < height; y += 1) {
    let rowSum = 0;
    for (let x = 0; x < width; x += 1) {
      rowSum += gray[y * width + x]!;
      integral[(y + 1) * stride + x + 1] = integral[y * stride + x + 1]! + rowSum;
    }
  }
  const out = new Uint8ClampedArray(gray.length);
  for (let y = 0; y < height; y += 1) {
    const y0 = Math.max(0, y - radius);
    const y1 = Math.min(height, y + radius + 1);
    for (let x = 0; x < width; x += 1) {
      const x0 = Math.max(0, x - radius);
      const x1 = Math.min(width, x + radius + 1);
      const sum = integral[y1 * stride + x1]! - integral[y0 * stride + x1]! -
        integral[y1 * stride + x0]! + integral[y0 * stride + x0]!;
      const mean = sum / ((x1 - x0) * (y1 - y0));
      out[y * width + x] = gray[y * width + x]! > mean + offset ? 255 : 0;
    }
  }
  return out;
}
