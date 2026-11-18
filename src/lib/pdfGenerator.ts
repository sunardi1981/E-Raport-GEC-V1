import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatIndonesianDate } from './dateUtils';
import {
  GRADE_LABELS,
  type AttitudeItem,
  type KnowledgeItem,
  type SkillItem,
} from '../types/database';

export interface ReportPdfPayload {
  studentName: string;
  educationLevel: string;
  className: string;
  schoolName?: string | null;
  parentName?: string | null;
  semester: string;
  academicYear: string;
  reportPeriod: string;
  reportDate: string;
  reportCity: string;
  teacherName: string;
  knowledgeData: KnowledgeItem[];
  attitudeData: AttitudeItem[];
  skillData: SkillItem[];
  teacherNotes?: string | null;
  logoUrl?: string;
}

async function loadImageAsDataUrl(
  src: string
): Promise<{ dataUrl: string; width: number; height: number } | null> {
  try {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('Image load failed'));
      img.src = src;
    });
    const naturalW = img.naturalWidth || 256;
    const naturalH = img.naturalHeight || 200;
    const canvas = document.createElement('canvas');
    canvas.width = naturalW;
    canvas.height = naturalH;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0);
    return {
      dataUrl: canvas.toDataURL('image/png'),
      width: naturalW,
      height: naturalH,
    };
  } catch {
    return null;
  }
}

function sanitizeFilenamePart(value: string): string {
  return value
    .trim()
    .replace(/[^a-zA-Z0-9\s_-]/g, '')
    .replace(/\s+/g, '')
    .slice(0, 40) || 'Siswa';
}

export async function downloadReportPdf(payload: ReportPdfPayload): Promise<string> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth(); // 210mm
  const pageHeight = doc.internal.pageSize.getHeight(); // 297mm
  const marginX = 16;
  const contentWidth = pageWidth - marginX * 2; // 178mm

  const NAVY: [number, number, number] = [15, 39, 74];
  const GOLD: [number, number, number] = [180, 138, 44];
  const SLATE_TEXT: [number, number, number] = [30, 41, 59];
  const MUTED_TEXT: [number, number, number] = [100, 116, 139];
  const HEADER_FILL: [number, number, number] = [241, 245, 249];

  // Try loading GEC Logo
  const logoSrc = payload.logoUrl ?? '/assets/aistudio/logo_GEC_4cd69325.png';
  const logoAsset = await loadImageAsDataUrl(logoSrc);

  let cursorY = 14;
  let logoBoxWidth = 0;

  // Institutional Header
  if (logoAsset) {
    const drawHeight = 20;
    const drawWidth = Math.min(34, (logoAsset.width / logoAsset.height) * drawHeight);
    logoBoxWidth = drawWidth + 5;
    doc.addImage(logoAsset.dataUrl, 'PNG', marginX, cursorY, drawWidth, drawHeight);
  }

  const textCenterX = logoAsset
    ? marginX + logoBoxWidth + (contentWidth - logoBoxWidth) / 2
    : pageWidth / 2;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(...NAVY);
  doc.text('BIMBEL GALAXI EDU CENTER (GEC)', textCenterX, cursorY + 7, { align: 'center' });

  doc.setFontSize(11);
  doc.setTextColor(...SLATE_TEXT);
  doc.text('LAPORAN HASIL BELAJAR AKHIR SEMESTER', textCenterX, cursorY + 13.5, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...MUTED_TEXT);
  doc.text(
    `Periode: ${payload.reportPeriod || `${payload.semester} ${payload.academicYear}`}`,
    textCenterX,
    cursorY + 19,
    { align: 'center' }
  );

  cursorY += 24;

  // Double institutional divider (Navy + Gold)
  doc.setDrawColor(...NAVY);
  doc.setLineWidth(0.8);
  doc.line(marginX, cursorY, pageWidth - marginX, cursorY);
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.4);
  doc.line(marginX, cursorY + 1.2, pageWidth - marginX, cursorY + 1.2);

  cursorY += 7;

  // Identitas Siswa Table
  const identityRows: [string, string][] = [
    ['Nama Siswa', payload.studentName || '-'],
    ['Jenjang / Kelas', `${payload.educationLevel || '-'} / ${payload.className || '-'}`],
    ['Periode Laporan', `${payload.semester} · Tahun Ajaran ${payload.academicYear}`],
  ];
  if (payload.schoolName) {
    identityRows.push(['Sekolah Asal', payload.schoolName]);
  }

  autoTable(doc, {
    startY: cursorY,
    margin: { left: marginX, right: marginX },
    theme: 'plain',
    styles: {
      font: 'helvetica',
      fontSize: 9.5,
      cellPadding: { top: 1.5, right: 3, bottom: 1.5, left: 0 },
      textColor: SLATE_TEXT,
    },
    columnStyles: {
      0: { cellWidth: 38, fontStyle: 'bold', textColor: NAVY },
      1: { cellWidth: contentWidth - 38 },
    },
    body: identityRows.map(([k, v]) => [k, `:  ${v}`]),
  });

  cursorY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 5;

  // Salutation
  const parentLabel = payload.parentName?.trim() ? payload.parentName.trim() : 'Siswa';
  const salutation = `Kepada Yth. Orang Tua/Wali ${parentLabel}. Berikut perkembangan Ananda ${payload.studentName} pada materi yang telah dipelajari sampai periode laporan.`;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(...SLATE_TEXT);
  const splitSalutation = doc.splitTextToSize(salutation, contentWidth);
  doc.text(splitSalutation, marginX, cursorY);
  cursorY += splitSalutation.length * 4.5 + 4;

  // SECTION A: KOGNITIF / PENGETAHUAN
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(...NAVY);
  doc.text('A. NILAI KOGNITIF / PENGETAHUAN', marginX, cursorY);
  cursorY += 2.5;

  const knowledgeRows =
    payload.knowledgeData.length > 0
      ? payload.knowledgeData.map((row, idx) => [
          String(idx + 1),
          row.subject || '-',
          row.material || '-',
          `${row.grade} (${GRADE_LABELS[row.grade] || row.grade})`,
          row.description || '-',
        ])
      : [['-', 'Belum ada penilaian pengetahuan', '-', '-', '-']];

  autoTable(doc, {
    startY: cursorY,
    margin: { left: marginX, right: marginX },
    showHead: 'everyPage',
    head: [['No', 'Mata Pelajaran', 'Materi yang Dipelajari', 'Pemahaman', 'Deskripsi Perkembangan']],
    body: knowledgeRows,
    styles: {
      font: 'helvetica',
      fontSize: 8.5,
      cellPadding: 2.8,
      textColor: SLATE_TEXT,
      lineColor: [203, 213, 225],
      lineWidth: 0.2,
      overflow: 'linebreak',
      valign: 'top',
    },
    headStyles: {
      fillColor: NAVY,
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8.5,
      valign: 'middle',
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },
      1: { cellWidth: 30, fontStyle: 'bold' },
      2: { cellWidth: 36 },
      3: { cellWidth: 26, halign: 'center' },
      4: { cellWidth: contentWidth - 102 },
    },
  });

  cursorY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 7;

  // Check page break before Section B
  if (cursorY > pageHeight - 55) {
    doc.addPage();
    cursorY = 18;
  }

  // SECTION B: AFEKTIF / SIKAP
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(...NAVY);
  doc.text('B. NILAI AFEKTIF / SIKAP', marginX, cursorY);
  cursorY += 2.5;

  const attitudeRows =
    payload.attitudeData.length > 0
      ? payload.attitudeData.map((row, idx) => {
          const label =
            row.attitude === 'Sikap lainnya' && row.custom_attitude?.trim()
              ? row.custom_attitude.trim()
              : row.attitude;
          return [
            String(idx + 1),
            label || '-',
            `${row.grade} (${GRADE_LABELS[row.grade] || row.grade})`,
            row.description || '-',
          ];
        })
      : [['-', 'Belum ada penilaian sikap', '-', '-']];

  autoTable(doc, {
    startY: cursorY,
    margin: { left: marginX, right: marginX },
    showHead: 'everyPage',
    head: [['No', 'Sikap', 'Predikat', 'Deskripsi Perkembangan']],
    body: attitudeRows,
    styles: {
      font: 'helvetica',
      fontSize: 8.5,
      cellPadding: 2.8,
      textColor: SLATE_TEXT,
      lineColor: [203, 213, 225],
      lineWidth: 0.2,
      overflow: 'linebreak',
      valign: 'top',
    },
    headStyles: {
      fillColor: NAVY,
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8.5,
      valign: 'middle',
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },
      1: { cellWidth: 36, fontStyle: 'bold' },
      2: { cellWidth: 28, halign: 'center' },
      3: { cellWidth: contentWidth - 74 },
    },
  });

  cursorY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 7;

  // Check page break before Section C
  if (cursorY > pageHeight - 55) {
    doc.addPage();
    cursorY = 18;
  }

  // SECTION C: PSIKOMOTOR / KETERAMPILAN
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(...NAVY);
  doc.text('C. NILAI PSIKOMOTOR / KETERAMPILAN', marginX, cursorY);
  cursorY += 2.5;

  const skillRows =
    payload.skillData.length > 0
      ? payload.skillData.map((row, idx) => {
          const label =
            row.skill === 'Keterampilan lainnya' && row.custom_skill?.trim()
              ? row.custom_skill.trim()
              : row.skill;
          return [
            String(idx + 1),
            label || '-',
            `${row.grade} (${GRADE_LABELS[row.grade] || row.grade})`,
            row.description || '-',
          ];
        })
      : [['-', 'Belum ada penilaian keterampilan', '-', '-']];

  autoTable(doc, {
    startY: cursorY,
    margin: { left: marginX, right: marginX },
    showHead: 'everyPage',
    head: [['No', 'Keterampilan', 'Predikat', 'Deskripsi Perkembangan']],
    body: skillRows,
    styles: {
      font: 'helvetica',
      fontSize: 8.5,
      cellPadding: 2.8,
      textColor: SLATE_TEXT,
      lineColor: [203, 213, 225],
      lineWidth: 0.2,
      overflow: 'linebreak',
      valign: 'top',
    },
    headStyles: {
      fillColor: NAVY,
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8.5,
      valign: 'middle',
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },
      1: { cellWidth: 36, fontStyle: 'bold' },
      2: { cellWidth: 28, halign: 'center' },
      3: { cellWidth: contentWidth - 74 },
    },
  });

  cursorY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 7;

  // Catatan Guru (Optional)
  if (payload.teacherNotes?.trim()) {
    if (cursorY > pageHeight - 45) {
      doc.addPage();
      cursorY = 18;
    }
    autoTable(doc, {
      startY: cursorY,
      margin: { left: marginX, right: marginX },
      head: [['Catatan Tambahan Guru']],
      body: [[payload.teacherNotes.trim()]],
      styles: {
        font: 'helvetica',
        fontSize: 8.5,
        cellPadding: 3,
        textColor: SLATE_TEXT,
        lineColor: [203, 213, 225],
        lineWidth: 0.2,
        fillColor: HEADER_FILL,
      },
      headStyles: {
        fillColor: [226, 232, 240],
        textColor: NAVY,
        fontStyle: 'bold',
        fontSize: 8.5,
      },
    });
    cursorY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
  }

  // Signature Footer
  if (cursorY > pageHeight - 44) {
    doc.addPage();
    cursorY = 22;
  }

  const sigX = pageWidth - marginX - 58;
  const formattedDate = formatIndonesianDate(payload.reportDate);
  const city = payload.reportCity?.trim() || 'Rejang Lebong';

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(...SLATE_TEXT);
  doc.text(`${city}, ${formattedDate}`, sigX, cursorY);
  doc.text('Guru Pengajar,', sigX, cursorY + 5);

  // Signature Line
  doc.setDrawColor(148, 163, 184);
  doc.setLineWidth(0.3);
  doc.line(sigX, cursorY + 24, sigX + 54, cursorY + 24);

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...NAVY);
  doc.text(payload.teacherName || 'Guru Bimbel GEC', sigX, cursorY + 29);

  // Page numbers if multi-page
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...MUTED_TEXT);
    doc.text(
      'Bimbingan Belajar Galaxi Edu Center (GEC) · Rapot Digital Resmi',
      marginX,
      pageHeight - 8
    );
    if (totalPages > 1) {
      doc.text(`Halaman ${i} dari ${totalPages}`, pageWidth - marginX, pageHeight - 8, {
        align: 'right',
      });
    }
  }

  const safeStudent = sanitizeFilenamePart(payload.studentName);
  const safeSemester = sanitizeFilenamePart(payload.semester);
  const safeYear = (payload.academicYear || '2026-2027').replace(/\//g, '-').replace(/[^a-zA-Z0-9-]/g, '');
  const filename = `Rapot_GEC_${safeStudent}_${safeSemester}_${safeYear}.pdf`;

  doc.save(filename);
  return filename;
}
