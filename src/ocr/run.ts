import { createWorker, type Worker } from 'tesseract.js';
import { enhanceForOcr } from '../image/enhance';

export type OcrLang = 'rus' | 'eng' | 'rus+eng';

let workerPromise: Promise<Worker> | null = null;

async function getWorker(lang: OcrLang): Promise<Worker> {
  if (!workerPromise) {
    workerPromise = (async () => {
      const w = await createWorker(lang === 'rus+eng' ? 'rus+eng' : lang, 1, {
        logger: () => {},
      });
      await w.setParameters({
        tessedit_pageseg_mode: '3', // fully automatic page segmentation
      });
      return w;
    })();
  }
  return workerPromise;
}

export interface OcrFrameResult {
  text: string;
  confidence: number;
}

export async function ocrFrame(
  canvas: HTMLCanvasElement,
  lang: OcrLang,
  onProgress?: (pct: number) => void
): Promise<OcrFrameResult> {
  const worker = await getWorker(lang);
  const enhanced = enhanceForOcr(canvas);
  const { data } = await worker.recognize(enhanced);
  onProgress?.(100);

  const conf = data.confidence ?? 0;
  const text = (data.text ?? '').trim();
  return { text, confidence: conf };
}

export async function ocrFrames(
  frames: HTMLCanvasElement[],
  lang: OcrLang,
  onProgress?: (frameIndex: number, total: number, message: string) => void
): Promise<OcrFrameResult[]> {
  const results: OcrFrameResult[] = [];
  for (let i = 0; i < frames.length; i++) {
    onProgress?.(i, frames.length, `Распознавание кадра ${i + 1} из ${frames.length}…`);
    const r = await ocrFrame(frames[i], lang);
    if (r.text.length > 0) results.push(r);
  }
  return results;
}

export async function terminateOcr(): Promise<void> {
  if (workerPromise) {
    const w = await workerPromise;
    await w.terminate();
    workerPromise = null;
  }
}
