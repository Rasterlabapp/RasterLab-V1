import { jsPDF } from 'jspdf';
import { renderHalftone } from './halftone-engine';
import type { HalftoneSettings } from '@/types';

export interface PDFExportOptions {
  dpi: number;         // 72 | 150 | 300 | 600
  colorMode: 'cmyk' | 'rgb';
  pageSize: 'a4' | 'letter' | 'tabloid' | 'fit';
  title: string;
  includeBleed: boolean; // 3mm bleed marks
  cropMarks: boolean;
}

const PAGE_SIZES: Record<string, [number, number]> = {
  a4:      [210, 297],   // mm
  letter:  [215.9, 279.4],
  tabloid: [279.4, 431.8],
};

export async function exportPDF(
  sourceImage: HTMLCanvasElement,
  settings: HalftoneSettings,
  options: PDFExportOptions,
): Promise<void> {
  const { dpi, pageSize, title, cropMarks, includeBleed } = options;

  // Render halftone to a fresh canvas
  const dst = document.createElement('canvas');
  renderHalftone(sourceImage, dst, settings);

  const imgDataUrl = dst.toDataURL('image/png');

  // Physical size of the image in mm (based on dpi)
  const PX_PER_MM = dpi / 25.4;
  const imgW_mm = dst.width / PX_PER_MM;
  const imgH_mm = dst.height / PX_PER_MM;

  // Determine page dimensions
  let pageW: number, pageH: number;
  if (pageSize === 'fit') {
    const bleed = includeBleed ? 6 : 0;    // 3mm each side
    const mark  = cropMarks ? 10 : 0;      // 10mm mark + gap
    pageW = imgW_mm + bleed + mark * 2;
    pageH = imgH_mm + bleed + mark * 2;
  } else {
    [pageW, pageH] = PAGE_SIZES[pageSize];
  }

  const orientation = pageW >= pageH ? 'landscape' : 'portrait';
  const pdf = new jsPDF({
    orientation,
    unit: 'mm',
    format: pageSize === 'fit' ? [pageW, pageH] : pageSize,
    compress: true,
  });

  // ── Metadata ─────────────────────────────────────────────────────────────
  pdf.setProperties({
    title: title || 'Curato Lab Halftone',
    subject: `Halftone · ${settings.mode} · ${settings.frequency}lpi · ${dpi}dpi`,
    creator: 'Curato Lab',
    keywords: `halftone, ${settings.mode}, ${dpi}dpi, curato-lab`,
  });

  // ── Image placement ───────────────────────────────────────────────────────
  const bleed_mm = includeBleed ? 3 : 0;
  const mark_mm  = cropMarks ? 10 : 0;
  const originX  = mark_mm + bleed_mm;
  const originY  = mark_mm + bleed_mm;

  // Scale to fit page if image is larger
  let drawW = imgW_mm, drawH = imgH_mm;
  const maxW = pageW - originX * 2;
  const maxH = pageH - originY * 2;
  if (drawW > maxW || drawH > maxH) {
    const scale = Math.min(maxW / drawW, maxH / drawH);
    drawW *= scale; drawH *= scale;
  }

  pdf.addImage(imgDataUrl, 'PNG', originX, originY, drawW, drawH, '', 'FAST');

  // ── Crop marks ────────────────────────────────────────────────────────────
  if (cropMarks) {
    drawCropMarks(pdf, originX, originY, drawW, drawH, bleed_mm, mark_mm);
  }

  // ── Info footer ───────────────────────────────────────────────────────────
  pdf.setFontSize(6);
  pdf.setTextColor(150);
  pdf.text(
    `Curato Lab  ·  ${settings.mode}  ·  ${settings.frequency} lpi  ·  ${dpi} dpi  ·  ${dst.width}×${dst.height}px`,
    pageW / 2,
    pageH - 4,
    { align: 'center' },
  );

  // ── Save ──────────────────────────────────────────────────────────────────
  const filename = `${title || 'curato-lab'}-${settings.mode}-${dpi}dpi.pdf`;
  pdf.save(filename);
}

function drawCropMarks(
  pdf: jsPDF,
  x: number, y: number,
  w: number, h: number,
  bleed: number,
  markLen: number,
) {
  pdf.setDrawColor(0);
  pdf.setLineWidth(0.25);

  const gap = 2; // gap between bleed edge and mark start
  const corners = [
    { cx: x - bleed, cy: y - bleed },       // top-left
    { cx: x + w + bleed, cy: y - bleed },   // top-right
    { cx: x - bleed, cy: y + h + bleed },   // bottom-left
    { cx: x + w + bleed, cy: y + h + bleed }, // bottom-right
  ];

  for (const { cx, cy } of corners) {
    const left = cx < x;
    const top  = cy < y;

    // Horizontal mark
    const hx1 = left ? cx - markLen : cx + gap;
    const hx2 = left ? cx - gap     : cx + markLen;
    pdf.line(hx1, cy, hx2, cy);

    // Vertical mark
    const vy1 = top ? cy - markLen : cy + gap;
    const vy2 = top ? cy - gap     : cy + markLen;
    pdf.line(cx, vy1, cx, vy2);
  }
}
