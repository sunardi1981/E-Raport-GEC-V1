import {
  AlignmentType,
  BorderStyle,
  Document,
  ImageRun,
  Packer,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  VerticalAlign,
  WidthType,
  convertMillimetersToTwip,
} from 'docx';
import { formatIndonesianDate } from './dateUtils';
import { GRADE_LABELS } from '../types/database';
import type { ReportPdfPayload } from './pdfGenerator';

const DEFAULT_LOGO_PATH = '/assets/aistudio/logo_GEC_4cd69325.png';

const NAVY_HEX = '0F274A';
const GOLD_HEX = 'C59B27';
const SLATE_TEXT_HEX = '1E293B';
const MUTED_TEXT_HEX = '64748B';
const BORDER_HEX = 'CBD5E1';
const ZEBRA_HEX = 'F8FAFC';

function sanitizeFilenamePart(value: string): string {
  return (
    value
      .trim()
      .replace(/[^a-zA-Z0-9\s_-]/g, '')
      .replace(/\s+/g, '')
      .slice(0, 40) || 'Siswa'
  );
}

async function fetchLogoBytesAndDimensions(
  src: string
): Promise<{ data: Uint8Array; width: number; height: number } | null> {
  try {
    const response = await fetch(src);
    if (!response.ok) return null;
    const buffer = await response.arrayBuffer();
    const data = new Uint8Array(buffer);

    // Measure natural aspect ratio via Image
    const blobUrl = URL.createObjectURL(new Blob([data], { type: 'image/png' }));
    const dims = await new Promise<{ w: number; h: number }>((resolve) => {
      const img = new Image();
      img.onload = () => {
        resolve({ w: img.naturalWidth || 220, h: img.naturalHeight || 165 });
      };
      img.onerror = () => resolve({ w: 220, h: 165 });
      img.src = blobUrl;
    });
    URL.revokeObjectURL(blobUrl);

    const targetWidth = 84;
    const targetHeight = Math.max(36, Math.round((dims.h / dims.w) * targetWidth));
    return { data, width: targetWidth, height: targetHeight };
  } catch {
    return null;
  }
}

function makeCellBorders(color = BORDER_HEX) {
  return {
    top: { style: BorderStyle.SINGLE, size: 4, color },
    bottom: { style: BorderStyle.SINGLE, size: 4, color },
    left: { style: BorderStyle.SINGLE, size: 4, color },
    right: { style: BorderStyle.SINGLE, size: 4, color },
  };
}

const NO_BORDERS = {
  top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
  bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
  left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
  right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
};

function makeHeaderCell(text: string, widthPct: number, align: (typeof AlignmentType)[keyof typeof AlignmentType] = AlignmentType.LEFT) {
  return new TableCell({
    width: { size: widthPct, type: WidthType.PERCENTAGE },
    shading: { type: ShadingType.CLEAR, color: 'auto', fill: NAVY_HEX },
    borders: makeCellBorders(BORDER_HEX),
    verticalAlign: VerticalAlign.CENTER,
    margins: { top: 100, bottom: 100, left: 120, right: 120 },
    children: [
      new Paragraph({
        alignment: align,
        children: [
          new TextRun({
            text,
            bold: true,
            size: 18, // 9pt
            color: 'FFFFFF',
            font: 'Calibri',
          }),
        ],
      }),
    ],
  });
}

function makeBodyCell(
  text: string,
  widthPct: number,
  options?: {
    bold?: boolean;
    color?: string;
    align?: (typeof AlignmentType)[keyof typeof AlignmentType];
    shaded?: boolean;
  }
) {
  return new TableCell({
    width: { size: widthPct, type: WidthType.PERCENTAGE },
    shading: options?.shaded
      ? { type: ShadingType.CLEAR, color: 'auto', fill: ZEBRA_HEX }
      : undefined,
    borders: makeCellBorders(BORDER_HEX),
    verticalAlign: VerticalAlign.TOP,
    margins: { top: 90, bottom: 90, left: 120, right: 120 },
    children: [
      new Paragraph({
        alignment: options?.align ?? AlignmentType.LEFT,
        spacing: { line: 260 },
        children: [
          new TextRun({
            text: text || '-',
            bold: options?.bold ?? false,
            size: 18, // 9pt
            color: options?.color ?? SLATE_TEXT_HEX,
            font: 'Calibri',
          }),
        ],
      }),
    ],
  });
}

function makeSectionHeading(title: string) {
  return new Paragraph({
    spacing: { before: 260, after: 100 },
    keepNext: true,
    children: [
      new TextRun({
        text: title,
        bold: true,
        size: 21, // 10.5pt
        color: NAVY_HEX,
        font: 'Calibri',
      }),
    ],
  });
}

export async function downloadReportWord(payload: ReportPdfPayload): Promise<string> {
  const logoInfo = await fetchLogoBytesAndDimensions(payload.logoUrl ?? DEFAULT_LOGO_PATH);

  const displayParent = payload.parentName?.trim() ? payload.parentName.trim() : 'Siswa';
  const displayStudent = payload.studentName?.trim() || 'Siswa';
  const displayPeriod =
    payload.reportPeriod?.trim() || `${payload.semester} ${payload.academicYear}`;

  // Institutional Header
  const headerTextRuns = [
    new Paragraph({
      alignment: logoInfo ? AlignmentType.LEFT : AlignmentType.CENTER,
      spacing: { after: 40 },
      children: [
        new TextRun({
          text: 'BIMBEL GALAXI EDU CENTER (GEC)',
          bold: true,
          size: 28, // 14pt
          color: NAVY_HEX,
          font: 'Calibri',
        }),
      ],
    }),
    new Paragraph({
      alignment: logoInfo ? AlignmentType.LEFT : AlignmentType.CENTER,
      spacing: { after: 40 },
      children: [
        new TextRun({
          text: 'LAPORAN HASIL BELAJAR AKHIR SEMESTER',
          bold: true,
          size: 22, // 11pt
          color: SLATE_TEXT_HEX,
          font: 'Calibri',
        }),
      ],
    }),
    new Paragraph({
      alignment: logoInfo ? AlignmentType.LEFT : AlignmentType.CENTER,
      children: [
        new TextRun({
          text: `Periode Evaluasi: ${displayPeriod}`,
          size: 18, // 9pt
          color: MUTED_TEXT_HEX,
          font: 'Calibri',
        }),
      ],
    }),
  ];

  const headerBlock = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
      left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
      right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
      insideHorizontal: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
      insideVertical: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
      bottom: { style: BorderStyle.DOUBLE, size: 12, color: NAVY_HEX },
    },
    rows: [
      new TableRow({
        children: logoInfo
          ? [
              new TableCell({
                width: { size: 18, type: WidthType.PERCENTAGE },
                borders: NO_BORDERS,
                verticalAlign: VerticalAlign.CENTER,
                margins: { bottom: 120, right: 120 },
                children: [
                  new Paragraph({
                    alignment: AlignmentType.CENTER,
                    children: [
                      new ImageRun({
                        type: 'png',
                        data: logoInfo.data,
                        transformation: {
                          width: logoInfo.width,
                          height: logoInfo.height,
                        },
                      }),
                    ],
                  }),
                ],
              }),
              new TableCell({
                width: { size: 82, type: WidthType.PERCENTAGE },
                borders: NO_BORDERS,
                verticalAlign: VerticalAlign.CENTER,
                margins: { bottom: 120, left: 80 },
                children: headerTextRuns,
              }),
            ]
          : [
              new TableCell({
                width: { size: 100, type: WidthType.PERCENTAGE },
                borders: NO_BORDERS,
                margins: { bottom: 120 },
                children: headerTextRuns,
              }),
            ],
      }),
    ],
  });

  // Gold thin rule right below header
  const goldDivider = new Paragraph({
    spacing: { before: 20, after: 180 },
    border: {
      bottom: { style: BorderStyle.SINGLE, size: 6, color: GOLD_HEX },
    },
    children: [],
  });

  // Identity Table
  const identityRowsData: [string, string][] = [
    ['Nama Siswa', displayStudent],
    ['Jenjang / Kelas', `${payload.educationLevel || '-'} / ${payload.className || '-'}`],
    ['Periode Laporan', `${payload.semester} · Tahun Ajaran ${payload.academicYear}`],
  ];
  if (payload.schoolName?.trim()) {
    identityRowsData.push(['Sekolah Asal', payload.schoolName.trim()]);
  }

  const identityTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      ...NO_BORDERS,
      insideHorizontal: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
      insideVertical: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
    },
    rows: identityRowsData.map(
      ([label, val]) =>
        new TableRow({
          children: [
            new TableCell({
              width: { size: 24, type: WidthType.PERCENTAGE },
              borders: NO_BORDERS,
              margins: { top: 30, bottom: 30 },
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: label,
                      bold: true,
                      size: 19,
                      color: NAVY_HEX,
                      font: 'Calibri',
                    }),
                  ],
                }),
              ],
            }),
            new TableCell({
              width: { size: 76, type: WidthType.PERCENTAGE },
              borders: NO_BORDERS,
              margins: { top: 30, bottom: 30 },
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: `:  ${val}`,
                      size: 19,
                      color: SLATE_TEXT_HEX,
                      font: 'Calibri',
                    }),
                  ],
                }),
              ],
            }),
          ],
        })
    ),
  });

  // Salutation
  const salutationParagraph = new Paragraph({
    spacing: { before: 180, after: 120, line: 276 },
    children: [
      new TextRun({ text: 'Kepada Yth. Orang Tua/Wali ', size: 19, color: SLATE_TEXT_HEX, font: 'Calibri' }),
      new TextRun({ text: displayParent, bold: true, size: 19, color: SLATE_TEXT_HEX, font: 'Calibri' }),
      new TextRun({ text: '. Berikut perkembangan Ananda ', size: 19, color: SLATE_TEXT_HEX, font: 'Calibri' }),
      new TextRun({ text: displayStudent, bold: true, size: 19, color: SLATE_TEXT_HEX, font: 'Calibri' }),
      new TextRun({
        text: ' pada materi yang telah dipelajari sampai periode laporan.',
        size: 19,
        color: SLATE_TEXT_HEX,
        font: 'Calibri',
      }),
    ],
  });

  // Section A: Knowledge Table
  const knowledgeTableRows = [
    new TableRow({
      tableHeader: true,
      children: [
        makeHeaderCell('No', 6, AlignmentType.CENTER),
        makeHeaderCell('Mata Pelajaran', 18),
        makeHeaderCell('Materi yang Dipelajari', 22),
        makeHeaderCell('Pemahaman', 15, AlignmentType.CENTER),
        makeHeaderCell('Deskripsi Perkembangan', 39),
      ],
    }),
    ...(payload.knowledgeData.length > 0
      ? payload.knowledgeData.map(
          (row, idx) =>
            new TableRow({
              cantSplit: true,
              children: [
                makeBodyCell(String(idx + 1), 6, { align: AlignmentType.CENTER, shaded: idx % 2 === 1 }),
                makeBodyCell(row.subject || '-', 18, { bold: true, shaded: idx % 2 === 1 }),
                makeBodyCell(row.material || '-', 22, { shaded: idx % 2 === 1 }),
                makeBodyCell(`${row.grade} (${GRADE_LABELS[row.grade] || row.grade})`, 15, {
                  bold: true,
                  color: NAVY_HEX,
                  align: AlignmentType.CENTER,
                  shaded: idx % 2 === 1,
                }),
                makeBodyCell(row.description || '-', 39, { shaded: idx % 2 === 1 }),
              ],
            })
        )
      : [
          new TableRow({
            children: [
              makeBodyCell('-', 6, { align: AlignmentType.CENTER }),
              makeBodyCell('Belum ada penilaian pengetahuan', 18),
              makeBodyCell('-', 22),
              makeBodyCell('-', 15, { align: AlignmentType.CENTER }),
              makeBodyCell('-', 39),
            ],
          }),
        ]),
  ];

  const knowledgeTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: knowledgeTableRows,
  });

  // Section B: Attitude Table (4 columns with separate Predikat column)
  const attitudeTableRows = [
    new TableRow({
      tableHeader: true,
      children: [
        makeHeaderCell('No', 6, AlignmentType.CENTER),
        makeHeaderCell('Sikap', 22),
        makeHeaderCell('Predikat', 16, AlignmentType.CENTER),
        makeHeaderCell('Deskripsi Perkembangan', 56),
      ],
    }),
    ...(payload.attitudeData.length > 0
      ? payload.attitudeData.map((row, idx) => {
          const label =
            row.attitude === 'Sikap lainnya' && row.custom_attitude?.trim()
              ? row.custom_attitude.trim()
              : row.attitude;
          return new TableRow({
            cantSplit: true,
            children: [
              makeBodyCell(String(idx + 1), 6, { align: AlignmentType.CENTER, shaded: idx % 2 === 1 }),
              makeBodyCell(label || '-', 22, { bold: true, shaded: idx % 2 === 1 }),
              makeBodyCell(`${row.grade} (${GRADE_LABELS[row.grade] || row.grade})`, 16, {
                bold: true,
                color: NAVY_HEX,
                align: AlignmentType.CENTER,
                shaded: idx % 2 === 1,
              }),
              makeBodyCell(row.description || '-', 56, { shaded: idx % 2 === 1 }),
            ],
          });
        })
      : [
          new TableRow({
            children: [
              makeBodyCell('-', 6, { align: AlignmentType.CENTER }),
              makeBodyCell('Belum ada penilaian sikap', 22),
              makeBodyCell('-', 16, { align: AlignmentType.CENTER }),
              makeBodyCell('-', 56),
            ],
          }),
        ]),
  ];

  const attitudeTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: attitudeTableRows,
  });

  // Section C: Skill Table (4 columns with separate Predikat column)
  const skillTableRows = [
    new TableRow({
      tableHeader: true,
      children: [
        makeHeaderCell('No', 6, AlignmentType.CENTER),
        makeHeaderCell('Keterampilan', 22),
        makeHeaderCell('Predikat', 16, AlignmentType.CENTER),
        makeHeaderCell('Deskripsi Perkembangan', 56),
      ],
    }),
    ...(payload.skillData.length > 0
      ? payload.skillData.map((row, idx) => {
          const label =
            row.skill === 'Keterampilan lainnya' && row.custom_skill?.trim()
              ? row.custom_skill.trim()
              : row.skill;
          return new TableRow({
            cantSplit: true,
            children: [
              makeBodyCell(String(idx + 1), 6, { align: AlignmentType.CENTER, shaded: idx % 2 === 1 }),
              makeBodyCell(label || '-', 22, { bold: true, shaded: idx % 2 === 1 }),
              makeBodyCell(`${row.grade} (${GRADE_LABELS[row.grade] || row.grade})`, 16, {
                bold: true,
                color: NAVY_HEX,
                align: AlignmentType.CENTER,
                shaded: idx % 2 === 1,
              }),
              makeBodyCell(row.description || '-', 56, { shaded: idx % 2 === 1 }),
            ],
          });
        })
      : [
          new TableRow({
            children: [
              makeBodyCell('-', 6, { align: AlignmentType.CENTER }),
              makeBodyCell('Belum ada penilaian keterampilan', 22),
              makeBodyCell('-', 16, { align: AlignmentType.CENTER }),
              makeBodyCell('-', 56),
            ],
          }),
        ]),
  ];

  const skillTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: skillTableRows,
  });

  // Optional Teacher Notes
  const children: (Paragraph | Table)[] = [
    headerBlock,
    goldDivider,
    identityTable,
    salutationParagraph,
    makeSectionHeading('A. NILAI KOGNITIF / PENGETAHUAN'),
    knowledgeTable,
    makeSectionHeading('B. NILAI AFEKTIF / SIKAP'),
    attitudeTable,
    makeSectionHeading('C. NILAI PSIKOMOTOR / KETERAMPILAN'),
    skillTable,
  ];

  if (payload.teacherNotes?.trim()) {
    children.push(
      new Paragraph({ spacing: { before: 240, after: 60 }, children: [] }),
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
          new TableRow({
            children: [
              new TableCell({
                width: { size: 100, type: WidthType.PERCENTAGE },
                shading: { type: ShadingType.CLEAR, color: 'auto', fill: 'E2E8F0' },
                borders: makeCellBorders(BORDER_HEX),
                margins: { top: 80, bottom: 80, left: 120, right: 120 },
                children: [
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: 'CATATAN TAMBAHAN GURU',
                        bold: true,
                        size: 17,
                        color: NAVY_HEX,
                        font: 'Calibri',
                      }),
                    ],
                  }),
                ],
              }),
            ],
          }),
          new TableRow({
            cantSplit: true,
            children: [
              new TableCell({
                width: { size: 100, type: WidthType.PERCENTAGE },
                shading: { type: ShadingType.CLEAR, color: 'auto', fill: ZEBRA_HEX },
                borders: makeCellBorders(BORDER_HEX),
                margins: { top: 100, bottom: 100, left: 120, right: 120 },
                children: [
                  new Paragraph({
                    spacing: { line: 260 },
                    children: [
                      new TextRun({
                        text: payload.teacherNotes.trim(),
                        size: 18,
                        color: SLATE_TEXT_HEX,
                        font: 'Calibri',
                      }),
                    ],
                  }),
                ],
              }),
            ],
          }),
        ],
      })
    );
  }

  // Signature Footer
  const city = payload.reportCity?.trim() || 'Rejang Lebong';
  const formattedDate = formatIndonesianDate(payload.reportDate);

  const signatureTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      ...NO_BORDERS,
      insideHorizontal: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
      insideVertical: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
    },
    rows: [
      new TableRow({
        cantSplit: true,
        children: [
          new TableCell({
            width: { size: 62, type: WidthType.PERCENTAGE },
            borders: NO_BORDERS,
            children: [new Paragraph({ children: [] })],
          }),
          new TableCell({
            width: { size: 38, type: WidthType.PERCENTAGE },
            borders: NO_BORDERS,
            children: [
              new Paragraph({
                spacing: { before: 320, after: 40 },
                children: [
                  new TextRun({
                    text: `${city}, ${formattedDate}`,
                    size: 19,
                    color: SLATE_TEXT_HEX,
                    font: 'Calibri',
                  }),
                ],
              }),
              new Paragraph({
                spacing: { after: 720 },
                children: [
                  new TextRun({
                    text: 'Guru Pengajar,',
                    size: 19,
                    color: SLATE_TEXT_HEX,
                    font: 'Calibri',
                  }),
                ],
              }),
              new Paragraph({
                border: {
                  top: { style: BorderStyle.SINGLE, size: 4, color: '94A3B8' },
                },
                spacing: { before: 40 },
                children: [
                  new TextRun({
                    text: payload.teacherName || 'Guru Bimbel GEC',
                    bold: true,
                    size: 19,
                    color: NAVY_HEX,
                    font: 'Calibri',
                  }),
                ],
              }),
            ],
          }),
        ],
      }),
    ],
  });

  children.push(signatureTable);

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            size: {
              width: convertMillimetersToTwip(210),
              height: convertMillimetersToTwip(297),
            },
            margin: {
              top: convertMillimetersToTwip(15),
              right: convertMillimetersToTwip(16),
              bottom: convertMillimetersToTwip(15),
              left: convertMillimetersToTwip(16),
            },
          },
        },
        children,
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  const safeStudent = sanitizeFilenamePart(payload.studentName);
  const safeSemester = sanitizeFilenamePart(payload.semester);
  const safeYear = (payload.academicYear || '2026-2027')
    .replace(/\//g, '-')
    .replace(/[^a-zA-Z0-9-]/g, '');
  const filename = `Rapot_GEC_${safeStudent}_${safeSemester}_${safeYear}.docx`;

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  return filename;
}
