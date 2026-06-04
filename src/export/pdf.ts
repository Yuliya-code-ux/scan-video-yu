import { jsPDF } from 'jspdf';

/** PDF с поддержкой кириллицы через рендер текста на canvas */
export function exportToPdf(text: string, filename = 'document.pdf'): void {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 15;
  const contentW = pageW - margin * 2;
  const contentH = pageH - margin * 2;
  const pxPerMm = 3.78;
  const canvasW = Math.round(contentW * pxPerMm);
  const fontSize = 14;
  const lineHeight = 22;

  const paragraphs = text.split(/\n\n+/);
  const lines: string[] = [];

  const measure = document.createElement('canvas');
  const mctx = measure.getContext('2d')!;
  mctx.font = `${fontSize}px "Segoe UI", Arial, sans-serif`;

  for (const para of paragraphs) {
    const words = para.split(/\s+/);
    let current = '';
    for (const word of words) {
      const test = current ? `${current} ${word}` : word;
      if (mctx.measureText(test).width > canvasW - 20 && current) {
        lines.push(current);
        current = word;
      } else {
        current = test;
      }
    }
    if (current) lines.push(current);
    lines.push('');
  }

  let y = 0;
  let pageLines: string[] = [];

  const flushPage = () => {
    if (pageLines.length === 0) return;
    const canvas = document.createElement('canvas');
    const ch = Math.max(100, pageLines.length * lineHeight + 40);
    canvas.width = canvasW;
    canvas.height = ch;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvasW, ch);
    ctx.fillStyle = '#1a202c';
    ctx.font = `${fontSize}px "Segoe UI", Arial, sans-serif`;
    pageLines.forEach((line, i) => {
      ctx.fillText(line, 10, 28 + i * lineHeight);
    });
    const img = canvas.toDataURL('image/png');
    const imgHmm = ch / pxPerMm;
    doc.addImage(img, 'PNG', margin, margin, contentW, Math.min(imgHmm, contentH));
    pageLines = [];
  };

  for (const line of lines) {
    if (y + lineHeight > contentH * pxPerMm) {
      flushPage();
      doc.addPage();
      y = 0;
    }
    pageLines.push(line);
    y += lineHeight;
  }
  flushPage();

  doc.save(filename);
}
