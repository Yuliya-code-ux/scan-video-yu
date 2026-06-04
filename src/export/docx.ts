import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
} from 'docx';
import { saveAs } from 'file-saver';

export async function exportToDocx(
  text: string,
  filename = 'document.docx'
): Promise<void> {
  const paragraphs = text.split(/\n\n+/).filter(Boolean);

  const children = paragraphs.length
    ? paragraphs.map(
        (p) =>
          new Paragraph({
            children: [new TextRun({ text: p, size: 24 })],
            spacing: { after: 200 },
          })
      )
    : [
        new Paragraph({
          children: [new TextRun({ text: '(пустой документ)', italics: true })],
        }),
      ];

  const doc = new Document({
    sections: [
      {
        properties: {},
        children: [
          new Paragraph({
            text: 'Восстановленный документ',
            heading: HeadingLevel.HEADING_1,
          }),
          ...children,
        ],
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, filename);
}
