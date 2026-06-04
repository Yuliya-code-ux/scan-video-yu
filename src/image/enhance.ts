/** Улучшение кадра для OCR при плохом качестве видео */
export function enhanceForOcr(source: HTMLCanvasElement): HTMLCanvasElement {
  const w = source.width;
  const h = source.height;
  const out = document.createElement('canvas');
  out.width = w;
  out.height = h;
  const ctx = out.getContext('2d', { willReadFrequently: true });
  if (!ctx) return source;

  ctx.drawImage(source, 0, 0);
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;

  // Контраст + лёгкая бинаризация (адаптивный порог по среднему)
  let sum = 0;
  for (let i = 0; i < d.length; i += 4) {
    const gray = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    sum += gray;
  }
  const mean = sum / (d.length / 4);
  const contrast = 1.4;
  const threshold = mean * 0.92;

  for (let i = 0; i < d.length; i += 4) {
    let gray = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    gray = ((gray - 128) * contrast + 128);
    gray = gray < threshold ? Math.max(0, gray - 25) : Math.min(255, gray + 15);
    const v = Math.max(0, Math.min(255, gray));
    d[i] = d[i + 1] = d[i + 2] = v;
    d[i + 3] = 255;
  }

  ctx.putImageData(img, 0, 0);
  return out;
}
