import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
} from 'docx';

const BODY_FONT = 'Calibri';
const HEADING_FONT = 'Calibri';
const CODE_FONT = 'Consolas';

const BODY_SIZE = 22; // half-points => 11pt
const TITLE_SIZE = 56; // 28pt
const HEADING_SIZES = {
  1: 36, // 18pt
  2: 30, // 15pt
  3: 26, // 13pt
  4: 24, // 12pt
};

function inlineRuns(text, baseProps = {}) {
  if (!text) return [new TextRun({ text: '', font: BODY_FONT, size: BODY_SIZE, ...baseProps })];

  const tokens = [];
  const regex = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|\[[^\]]+\]\([^\)]+\))/g;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      tokens.push({ kind: 'text', text: text.slice(lastIndex, match.index) });
    }

    const token = match[0];
    if (token.startsWith('**')) {
      tokens.push({ kind: 'bold', text: token.slice(2, -2) });
    } else if (token.startsWith('`')) {
      tokens.push({ kind: 'code', text: token.slice(1, -1) });
    } else if (token.startsWith('[')) {
      const linkText = token.match(/\[([^\]]+)\]/)?.[1] || '';
      tokens.push({ kind: 'link', text: linkText });
    } else if (token.startsWith('*')) {
      tokens.push({ kind: 'italic', text: token.slice(1, -1) });
    } else {
      tokens.push({ kind: 'text', text: token });
    }

    lastIndex = match.index + token.length;
  }

  if (lastIndex < text.length) {
    tokens.push({ kind: 'text', text: text.slice(lastIndex) });
  }

  if (!tokens.length) {
    tokens.push({ kind: 'text', text });
  }

  return tokens.map((token) => {
    const common = { font: BODY_FONT, size: BODY_SIZE, ...baseProps };
    switch (token.kind) {
      case 'bold':
        return new TextRun({ ...common, text: token.text, bold: true });
      case 'italic':
        return new TextRun({ ...common, text: token.text, italics: true });
      case 'code':
        return new TextRun({ ...common, text: token.text, font: CODE_FONT });
      case 'link':
        return new TextRun({ ...common, text: token.text, color: '2563EB', underline: {} });
      default:
        return new TextRun({ ...common, text: token.text });
    }
  });
}

function blocksFromMarkdown(markdown) {
  const lines = String(markdown || '').replace(/\r\n/g, '\n').split('\n');
  const blocks = [];
  let inCode = false;
  let codeBuffer = [];

  const flushCode = () => {
    if (!codeBuffer.length) return;
    codeBuffer.forEach((line) => {
      blocks.push(
        new Paragraph({
          children: [new TextRun({ text: line, font: CODE_FONT, size: 20 })],
          spacing: { after: 0, line: 280 },
          shading: { type: 'clear', fill: 'F1F5F9' },
        })
      );
    });
    codeBuffer = [];
  };

  for (const rawLine of lines) {
    const line = rawLine.replace(/\s+$/, '');

    if (line.trim().startsWith('```')) {
      if (inCode) {
        flushCode();
        inCode = false;
      } else {
        inCode = true;
      }
      continue;
    }

    if (inCode) {
      codeBuffer.push(line);
      continue;
    }

    if (!line.trim()) {
      blocks.push(
        new Paragraph({
          children: [new TextRun({ text: '', font: BODY_FONT, size: BODY_SIZE })],
        })
      );
      continue;
    }

    const headingMatch = line.match(/^(#{1,4})\s+(.*)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const text = headingMatch[2].trim();
      const headingMap = {
        1: HeadingLevel.HEADING_1,
        2: HeadingLevel.HEADING_2,
        3: HeadingLevel.HEADING_3,
        4: HeadingLevel.HEADING_4,
      };
      blocks.push(
        new Paragraph({
          heading: headingMap[level],
          spacing: { before: 240, after: 120, line: 320 },
          children: [
            new TextRun({
              text,
              font: HEADING_FONT,
              size: HEADING_SIZES[level],
              bold: true,
              color: level <= 2 ? '1E293B' : '334155',
            }),
          ],
        })
      );
      continue;
    }

    const bulletMatch = line.match(/^\s*[-*+]\s+(.*)$/);
    if (bulletMatch) {
      blocks.push(
        new Paragraph({
          bullet: { level: 0 },
          spacing: { after: 60, line: 320 },
          children: inlineRuns(bulletMatch[1]),
        })
      );
      continue;
    }

    const orderedMatch = line.match(/^\s*\d+\.\s+(.*)$/);
    if (orderedMatch) {
      blocks.push(
        new Paragraph({
          numbering: { reference: 'default-numbering', level: 0 },
          spacing: { after: 60, line: 320 },
          children: inlineRuns(orderedMatch[1]),
        })
      );
      continue;
    }

    if (line.trim().startsWith('>')) {
      blocks.push(
        new Paragraph({
          children: inlineRuns(line.replace(/^\s*>\s?/, ''), { italics: true, color: '475569' }),
          indent: { left: 360 },
          spacing: { after: 120, line: 320 },
          border: {
            left: { color: '94A3B8', size: 12, space: 8, style: 'single' },
          },
        })
      );
      continue;
    }

    blocks.push(
      new Paragraph({
        children: inlineRuns(line),
        spacing: { after: 140, line: 320 },
        alignment: AlignmentType.JUSTIFIED,
      })
    );
  }

  if (inCode) flushCode();

  return blocks;
}

export async function buildDocxBuffer({ title, content }) {
  const children = [];
  if (title) {
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: title,
            font: HEADING_FONT,
            size: TITLE_SIZE,
            bold: true,
            color: '0F172A',
          }),
        ],
        alignment: AlignmentType.LEFT,
        spacing: { after: 240, line: 320 },
        border: {
          bottom: { color: 'CBD5E1', size: 12, space: 4, style: 'single' },
        },
      })
    );
  }
  children.push(...blocksFromMarkdown(content));

  const doc = new Document({
    creator: 'SEO Pro Tool',
    title: title || 'Document',
    styles: {
      default: {
        document: {
          run: { font: BODY_FONT, size: BODY_SIZE },
          paragraph: { spacing: { line: 320 } },
        },
      },
    },
    numbering: {
      config: [
        {
          reference: 'default-numbering',
          levels: [
            {
              level: 0,
              format: 'decimal',
              text: '%1.',
              alignment: AlignmentType.LEFT,
            },
          ],
        },
      ],
    },
    sections: [
      {
        properties: {
          page: {
            margin: { top: 1440, bottom: 1440, left: 1440, right: 1440 },
          },
        },
        children,
      },
    ],
  });

  return Packer.toBuffer(doc);
}
