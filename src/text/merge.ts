import type { OcrFrameResult } from '../ocr/run';

const GAP_PLACEHOLDER = /\[?\s*(?:\.\.\.|…|___+|не\s*читается|неразборчиво)\s*\]?/gi;
const LOW_CONF_MARK = '⟨?⟩';

/** Нормализация строки для сравнения */
function normalizeLine(s: string): string {
  return s
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[^\p{L}\p{N}\s.,;:!?\-—«»()"']/gu, '')
    .trim();
}

/** Расстояние Левенштейна (упрощённо для коротких строк) */
function similarity(a: string, b: string): number {
  const na = normalizeLine(a);
  const nb = normalizeLine(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  if (na.includes(nb) || nb.includes(na)) return 0.85;
  const longer = na.length > nb.length ? na : nb;
  const shorter = na.length > nb.length ? nb : na;
  let matches = 0;
  const wordsS = shorter.split(' ');
  const wordsL = longer.split(' ');
  for (const w of wordsS) {
    if (wordsL.some((x) => x === w || x.startsWith(w.slice(0, 4)))) matches++;
  }
  return matches / Math.max(wordsS.length, 1);
}

function splitParagraphs(text: string): string[] {
  return text
    .split(/\n{2,}|\r\n{2,}/)
    .map((p) => p.replace(/\s+/g, ' ').trim())
    .filter((p) => p.length > 2);
}

/** Объединение OCR с нескольких кадров без дублирования */
export function mergeOcrResults(results: OcrFrameResult[]): string {
  if (results.length === 0) return '';

  const sorted = [...results].sort((a, b) => b.confidence - a.confidence);
  const paragraphs: { text: string; conf: number }[] = [];

  for (const { text, confidence } of sorted) {
    const parts = splitParagraphs(text);
    for (const part of parts) {
      const dup = paragraphs.find((p) => similarity(p.text, part) > 0.72);
      if (dup) {
        if (part.length > dup.text.length && confidence >= dup.conf) {
          dup.text = part;
          dup.conf = confidence;
        }
      } else {
        paragraphs.push({ text: part, conf: confidence });
      }
    }
  }

  paragraphs.sort((a, b) => a.text.localeCompare(b.text, 'ru'));
  return paragraphs.map((p) => p.text).join('\n\n');
}

/** Восстановление пропусков по соседним абзацам */
export function restoreGaps(raw: string): string {
  let text = raw.replace(GAP_PLACEHOLDER, LOW_CONF_MARK);

  const lines = text.split('\n');
  const restored: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    if (!line.includes(LOW_CONF_MARK)) {
      restored.push(line);
      continue;
    }

    const prev = restored.filter(Boolean).pop() ?? '';
    const next = lines.slice(i + 1).find((l) => l.trim() && !l.includes(LOW_CONF_MARK)) ?? '';

    line = line.replace(new RegExp(LOW_CONF_MARK.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), () => {
      return inferMissingFragment(prev, next);
    });
    restored.push(line);
  }

  return restored.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

function inferMissingFragment(prev: string, next: string): string {
  const pWords = prev.split(/\s+/).filter(Boolean);
  const nWords = next.split(/\s+/).filter(Boolean);
  if (pWords.length === 0 && nWords.length === 0) return '…';
  if (pWords.length === 0) return nWords.slice(0, 3).join(' ') + '…';
  if (nWords.length === 0) return '…' + pWords.slice(-3).join(' ');

  const pEnd = pWords[pWords.length - 1];
  const nStart = nWords[0];
  if (pEnd.endsWith(',') || pEnd.endsWith(':') || pEnd.endsWith(';')) {
    return nWords.slice(0, Math.min(5, nWords.length)).join(' ');
  }
  return `${pWords.slice(-2).join(' ')} … ${nWords.slice(0, 2).join(' ')}`;
}

/** Финальная сборка документа */
export function buildDocument(results: OcrFrameResult[]): string {
  const merged = mergeOcrResults(results);
  return restoreGaps(merged);
}
