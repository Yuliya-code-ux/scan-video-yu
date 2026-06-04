export interface FrameExtractionOptions {
  intervalSec: number;
  maxFrames: number;
  onProgress?: (pct: number, message: string) => void;
}

export async function extractFramesFromVideo(
  file: File,
  options: FrameExtractionOptions
): Promise<HTMLCanvasElement[]> {
  const url = URL.createObjectURL(file);
  const video = document.createElement('video');
  video.muted = true;
  video.playsInline = true;
  video.preload = 'auto';
  video.src = url;

  await new Promise<void>((resolve, reject) => {
    video.onloadedmetadata = () => resolve();
    video.onerror = () => reject(new Error('Не удалось загрузить видео'));
  });

  const duration = video.duration;
  if (!Number.isFinite(duration) || duration <= 0) {
    URL.revokeObjectURL(url);
    throw new Error('Некорректная длительность видео');
  }

  const interval = Math.max(0.3, options.intervalSec);
  const times: number[] = [];
  for (let t = 0; t < duration && times.length < options.maxFrames; t += interval) {
    times.push(t);
  }
  if (times[times.length - 1] < duration - 0.1) {
    times.push(Math.max(0, duration - 0.05));
  }

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    URL.revokeObjectURL(url);
    throw new Error('Canvas не поддерживается');
  }

  const frames: HTMLCanvasElement[] = [];
  const w = video.videoWidth;
  const h = video.videoHeight;
  canvas.width = w;
  canvas.height = h;

  for (let i = 0; i < times.length; i++) {
    options.onProgress?.(
      Math.round((i / times.length) * 100),
      `Извлечение кадра ${i + 1} из ${times.length}…`
    );

    await seekVideo(video, times[i]);
    ctx.drawImage(video, 0, 0, w, h);

    const frameCanvas = document.createElement('canvas');
    frameCanvas.width = w;
    frameCanvas.height = h;
    frameCanvas.getContext('2d')?.drawImage(canvas, 0, 0);
    frames.push(frameCanvas);
  }

  URL.revokeObjectURL(url);
  options.onProgress?.(100, 'Кадры извлечены');
  return frames;
}

function seekVideo(video: HTMLVideoElement, time: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const onSeeked = () => {
      video.removeEventListener('seeked', onSeeked);
      resolve();
    };
    video.addEventListener('seeked', onSeeked);
    video.currentTime = Math.min(time, Math.max(0, video.duration - 0.01));
    setTimeout(() => {
      video.removeEventListener('seeked', onSeeked);
      resolve();
    }, 3000);
    video.onerror = () => reject(new Error('Ошибка перемотки видео'));
  });
}
