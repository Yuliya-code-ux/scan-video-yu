import './styles.css';
import { extractFramesFromVideo } from './video/frames';
import { ocrFrames, terminateOcr, type OcrLang } from './ocr/run';
import { buildDocument } from './text/merge';
import { exportToPdf } from './export/pdf';
import { exportToDocx } from './export/docx';

interface AppState {
  videoFile: File | null;
  resultText: string;
  processing: boolean;
}

const state: AppState = {
  videoFile: null,
  resultText: '',
  processing: false,
};

const app = document.getElementById('app')!;

app.innerHTML = `
  <header>
    <h1>Сканер документов из видео</h1>
    <p>Загрузите видео обзора документа — получите полный текст в PDF и DOCX</p>
  </header>

  <section class="card">
    <h2>1. Видео</h2>
    <div class="upload-zone" id="uploadZone">
      <div class="upload-icon">📹</div>
      <p><strong>Нажмите или перетащите</strong> видеофайл</p>
      <p class="hint">С телефона: «Снять» или выбрать из галереи (MP4, MOV, WebM)</p>
      <input type="file" id="fileInput" accept="video/*" capture="environment" />
    </div>
    <video id="preview" class="preview-video hidden" controls playsinline></video>
    <div class="btn-row">
      <button type="button" class="btn-secondary" id="btnCamera">📷 Снять видео</button>
    </div>
  </section>

  <section class="card">
    <h2>2. Настройки</h2>
    <label class="field">
      Язык документа
      <select id="langSelect">
        <option value="rus">Русский</option>
        <option value="eng">English</option>
        <option value="rus+eng" selected>Русский + English</option>
      </select>
    </label>
    <label class="field">
      Интервал кадров: <span id="intervalLabel">1.0</span> сек
      <input type="range" id="intervalRange" min="0.5" max="3" step="0.5" value="1" />
    </label>
    <p class="hint">Меньший интервал — точнее, но дольше. Для длинного видео увеличьте интервал.</p>
  </section>

  <section class="card">
    <h2>3. Обработка</h2>
    <button type="button" class="btn-primary" id="btnProcess" disabled>
      Распознать документ
    </button>
    <div class="progress-wrap hidden" id="progressWrap">
      <div class="progress-bar"><div class="progress-fill" id="progressFill"></div></div>
      <p class="progress-text" id="progressText">Подготовка…</p>
    </div>
  </section>

  <section class="card hidden" id="resultSection">
    <h2>4. Результат <span class="status-badge ok" id="resultBadge">готово</span></h2>
    <textarea class="result-text" id="resultText" placeholder="Текст появится здесь…"></textarea>
    <p class="hint">Проверьте и отредактируйте текст перед экспортом. Пропуски восстановлены по контексту соседних фрагментов.</p>
    <div class="export-row" style="margin-top: 0.75rem">
      <button type="button" class="btn-accent" id="btnPdf">📄 Скачать PDF</button>
      <button type="button" class="btn-accent" id="btnDocx">📝 Скачать DOCX</button>
    </div>
  </section>

  <footer>
    Обработка выполняется на вашем устройстве. Данные не отправляются на сервер.
  </footer>
`;

const uploadZone = document.getElementById('uploadZone')!;
const fileInput = document.getElementById('fileInput') as HTMLInputElement;
const preview = document.getElementById('preview') as HTMLVideoElement;
const btnProcess = document.getElementById('btnProcess') as HTMLButtonElement;
const btnCamera = document.getElementById('btnCamera') as HTMLButtonElement;
const progressWrap = document.getElementById('progressWrap')!;
const progressFill = document.getElementById('progressFill')!;
const progressText = document.getElementById('progressText')!;
const resultSection = document.getElementById('resultSection')!;
const resultText = document.getElementById('resultText') as HTMLTextAreaElement;
const intervalRange = document.getElementById('intervalRange') as HTMLInputElement;
const intervalLabel = document.getElementById('intervalLabel')!;
const langSelect = document.getElementById('langSelect') as HTMLSelectElement;

function setProgress(pct: number, message: string) {
  progressFill.style.width = `${pct}%`;
  progressText.textContent = message;
}

function handleFile(file: File) {
  if (!file.type.startsWith('video/')) {
    alert('Выберите видеофайл');
    return;
  }
  state.videoFile = file;
  preview.src = URL.createObjectURL(file);
  preview.classList.remove('hidden');
  btnProcess.disabled = false;
}

uploadZone.addEventListener('click', () => fileInput.click());

uploadZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  uploadZone.classList.add('dragover');
});

uploadZone.addEventListener('dragleave', () => uploadZone.classList.remove('dragover'));

uploadZone.addEventListener('drop', (e) => {
  e.preventDefault();
  uploadZone.classList.remove('dragover');
  const file = e.dataTransfer?.files[0];
  if (file) handleFile(file);
});

fileInput.addEventListener('change', () => {
  const file = fileInput.files?.[0];
  if (file) handleFile(file);
});

btnCamera.addEventListener('click', () => {
  fileInput.setAttribute('capture', 'environment');
  fileInput.click();
});

intervalRange.addEventListener('input', () => {
  intervalLabel.textContent = intervalRange.value;
});

btnProcess.addEventListener('click', async () => {
  if (!state.videoFile || state.processing) return;

  state.processing = true;
  btnProcess.disabled = true;
  progressWrap.classList.remove('hidden');
  resultSection.classList.add('hidden');
  setProgress(0, 'Извлечение кадров из видео…');

  const interval = parseFloat(intervalRange.value);
  const lang = langSelect.value as OcrLang;

  try {
    const frames = await extractFramesFromVideo(state.videoFile, {
      intervalSec: interval,
      maxFrames: 40,
      onProgress: (pct, msg) => setProgress(Math.round(pct * 0.35), msg),
    });

    setProgress(40, 'Распознавание текста (OCR)…');
    const ocrResults = await ocrFrames(frames, lang, (i, total, msg) => {
      const pct = 40 + Math.round(((i + 1) / total) * 50);
      setProgress(pct, msg);
    });

    setProgress(92, 'Сборка и восстановление текста…');
    const document_text = buildDocument(ocrResults);
    state.resultText = document_text;
    resultText.value = document_text;
    resultSection.classList.remove('hidden');

    if (!document_text.trim()) {
      document.getElementById('resultBadge')!.textContent = 'мало текста';
      document.getElementById('resultBadge')!.className = 'status-badge warn';
      resultText.placeholder =
        'Текст не распознан. Попробуйте меньший интервал кадров, лучшее освещение или другой ракурс.';
    } else {
      document.getElementById('resultBadge')!.textContent = 'готово';
      document.getElementById('resultBadge')!.className = 'status-badge ok';
    }

    setProgress(100, 'Готово!');
  } catch (err) {
    console.error(err);
    alert(err instanceof Error ? err.message : 'Ошибка обработки');
    setProgress(0, 'Ошибка');
  } finally {
    state.processing = false;
    btnProcess.disabled = !state.videoFile;
  }
});

document.getElementById('btnPdf')!.addEventListener('click', () => {
  const text = resultText.value.trim();
  if (!text) {
    alert('Нет текста для экспорта');
    return;
  }
  const name = state.videoFile?.name.replace(/\.[^.]+$/, '') ?? 'document';
  exportToPdf(text, `${name}.pdf`);
});

document.getElementById('btnDocx')!.addEventListener('click', async () => {
  const text = resultText.value.trim();
  if (!text) {
    alert('Нет текста для экспорта');
    return;
  }
  const name = state.videoFile?.name.replace(/\.[^.]+$/, '') ?? 'document';
  await exportToDocx(text, `${name}.docx`);
});

window.addEventListener('beforeunload', () => {
  void terminateOcr();
});
