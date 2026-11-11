// Ordered dithering: squeezes an image into a small palette using a Bayer threshold pattern, so smooth
// colour turns into the fixed crosshatch look. It is a lookup per channel, so a whole frame costs about a
// millisecond. The yard, the cat and the paintings all go through it.

export const STYLE = { levels: [5, 5, 4], size: 4, gamma: 1.0, strength: 0.55 };

function bayer(n) {
  if (n === 1) return [[0]];
  const m = bayer(n / 2), out = Array.from({ length: n }, () => new Array(n));
  for (let y = 0; y < n / 2; y++) for (let x = 0; x < n / 2; x++) { const v = m[y][x] * 4; out[y][x] = v; out[y][x + n / 2] = v + 2; out[y + n / 2][x] = v + 3; out[y + n / 2][x + n / 2] = v + 1; }
  return out;
}

export function makeDither(style = STYLE) {
  const n = style.size, cells = n * n, mat = bayer(n), flat = new Uint8Array(cells);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) flat[y * n + x] = mat[y][x];
  const mask = n - 1, shift = Math.log2(n);
  // one lookup table per channel: [threshold cell][input value] -> output value
  const luts = style.levels.map(L => {
    const t = new Uint8Array(cells * 256), steps = L - 1;
    for (let c = 0; c < cells; c++) {
      const thr = 0.5 + ((c + 0.5) / cells - 0.5) * style.strength;
      for (let v = 0; v < 256; v++) { const x = Math.pow(v / 255, style.gamma) * steps; let q = Math.floor(x + thr); if (q > steps) q = steps; t[c * 256 + v] = Math.round((q / steps) * 255); }
    }
    return t;
  });
  const [lr, lg, lb] = luts;
  // flat[] holds the rank (0..cells-1) of each cell, which is also its LUT row
  function apply(img) {
    const d = img.data, w = img.width, h = img.height;
    for (let y = 0; y < h; y++) {
      const row = (y & mask) << shift;
      for (let x = 0; x < w; x++) {
        const base = flat[row + (x & mask)] << 8, i = (y * w + x) << 2;
        d[i] = lr[base + d[i]]; d[i + 1] = lg[base + d[i + 1]]; d[i + 2] = lb[base + d[i + 2]]; d[i + 3] = 255;
      }
    }
    return img;
  }
  return { apply, style };
}

let shared = null;
export const dither = () => shared || (shared = makeDither());
export function setStyle(style) { Object.assign(STYLE, style); shared = makeDither(STYLE); }

// dither a finished canvas in place (used for the paintings)
export function ditherCanvas(canvas) {
  const g = canvas.getContext('2d', { willReadFrequently: true });
  g.putImageData(dither().apply(g.getImageData(0, 0, canvas.width, canvas.height)), 0, 0);
  return canvas;
}
