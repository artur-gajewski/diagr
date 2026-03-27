import { toPng, toSvg } from 'html-to-image';
import { jsPDF } from 'jspdf';
import type { DiagramModel, UMLElement, Relationship } from '@/types';
import {
  BOX_WIDTH,
  getBoxHeight,
  getBoxRect,
  bestAnchorPair,
  getAnchorPoint,
  buildBezierPath,
} from '@/utils/geometry';

// ────────── PNG ──────────
export async function exportPNG(
  canvasEl: HTMLElement,
  elements: UMLElement[],
  relationships: Relationship[],
  filename: string = 'diagram.png'
): Promise<void> {
  const { dataUrl } = await renderDiagramToPngDataUrl(canvasEl, elements, relationships, 2);
  downloadDataUrl(dataUrl, filename.endsWith('.png') ? filename : `${filename}.png`);
}

// ────────── SVG (html-to-image) ──────────
export async function exportSVGCapture(
  canvasEl: HTMLElement,
  elements: UMLElement[],
  relationships: Relationship[],
  filename: string = 'diagram.svg'
): Promise<void> {
  const dataUrl = await renderDiagramToSvgDataUrl(canvasEl, elements, relationships);
  downloadDataUrl(dataUrl, filename.endsWith('.svg') ? filename : `${filename}.svg`);
}

// ────────── PDF ──────────
export async function exportPDF(
  canvasEl: HTMLElement,
  elements: UMLElement[],
  relationships: Relationship[],
  filename: string = 'diagram.pdf'
): Promise<void> {
  const { dataUrl, width, height } = await renderDiagramToPngDataUrl(canvasEl, elements, relationships, 2);

  const pdf = new jsPDF({
    orientation: width > height ? 'landscape' : 'portrait',
    unit: 'px',
    format: [width, height],
  });
  pdf.addImage(dataUrl, 'PNG', 0, 0, width, height);
  pdf.save(filename.endsWith('.pdf') ? filename : `${filename}.pdf`);
}

// ────────── JSON ──────────
export function exportJSON(model: DiagramModel, filename: string = 'diagram.json'): void {
  const blob = new Blob([JSON.stringify(model, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  downloadDataUrl(url, filename.endsWith('.json') ? filename : `${filename}.json`);
  URL.revokeObjectURL(url);
}

export function importJSON(file: File): Promise<DiagramModel> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const model = JSON.parse(e.target!.result as string) as DiagramModel;
        if (!model.elements || !model.relationships) throw new Error('Invalid model');
        resolve(model);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = reject;
    reader.readAsText(file);
  });
}

// ────────── Pure SVG generation ──────────
const FONT_FAMILY = 'Inter, system-ui, sans-serif';

export function generateSVGString(
  elements: UMLElement[],
  relationships: Relationship[],
  dark: boolean
): string {
  const bounds = computeDiagramBounds(elements, relationships);
  const { minX, minY, width: W, height: H } = bounds;

  const bg = dark ? '#0f172a' : '#f1f5f9';
  const textCol = dark ? '#f1f5f9' : '#1e293b';
  const mutedCol = dark ? '#94a3b8' : '#64748b';
  const borderCol = dark ? '#334155' : '#e2e8f0';
  const boxBg = dark ? '#1e293b' : '#ffffff';

  const elMap = new Map(elements.map((e) => [e.id, e]));

  // --- Arrows ---
  const arrowPaths = relationships
    .map((r) => {
      const src = elMap.get(r.sourceId);
      const tgt = elMap.get(r.targetId);
      if (!src || !tgt) return '';
      const srcRect = getBoxRect(src);
      const tgtRect = getBoxRect(tgt);
      const { srcSide, tgtSide } = bestAnchorPair(srcRect, tgtRect);
      const markerPad = 6;
      const startRaw = getAnchorPoint(srcRect, srcSide);
      const endRaw = getAnchorPoint(tgtRect, tgtSide);
      const start = offsetOutsideBox(startRaw, srcSide, r.type === 'composition' || r.type === 'aggregation' ? markerPad : 2);
      const end = offsetOutsideBox(endRaw, tgtSide, markerPad);
      const d = buildBezierPath(start, end, srcSide, tgtSide);
      const color = relationColorSVG(r.type);
      const dashed = r.isDashed ?? (r.type === 'dependency' || r.type === 'realization');
      const typeDash = r.type === 'aggregation' ? '2 5' : '';
      const dash = dashed ? '6 4' : typeDash;
      const strokeWidth = r.type === 'composition' ? '1.9' : '1.5';
      const lineCap = r.type === 'aggregation' ? 'round' : 'butt';
      const marker = svgMarkerRef(r.type, dark);
      const markerStart = r.type === 'composition' || r.type === 'aggregation' ? svgMarkerStartRef(r.type, dark) : '';
      return `<path d="${d}" fill="none" stroke="${color}" stroke-width="${strokeWidth}" stroke-linecap="${lineCap}"
        ${dash ? `stroke-dasharray="${dash}"` : ''}
        ${markerStart ? `marker-start="${markerStart}"` : ''}
        ${marker ? `marker-end="${marker}"` : ''}
      />`;
    })
    .join('\n');

  // --- Boxes ---
  const imageSVGs = elements
    .filter((el) => el.type === 'image')
    .map((el) => {
      const w = el.boxWidth ?? 200;
      const h = el.boxHeight ?? 200;
      if (!el.imageData) return '';
      return `<image x="${el.x}" y="${el.y}" width="${w}" height="${h}" href="${el.imageData}" preserveAspectRatio="xMidYMid slice" />`;
    })
    .join('\n');

  const areaSVGs = elements
    .filter((el) => el.type === 'area')
    .map((el) => {
      const w = el.boxWidth ?? 320;
      const h = el.boxHeight ?? 220;
      const color = el.color ?? '#1e3a5f';
      const r = parseInt(color.slice(1, 3), 16) || 30;
      const g = parseInt(color.slice(3, 5), 16) || 58;
      const b = parseInt(color.slice(5, 7), 16) || 95;
      const fill = `rgba(${r},${g},${b},0.06)`;
      return [
        `<rect x="${el.x}" y="${el.y}" width="${w}" height="${h}" rx="12" ry="12" fill="${fill}" stroke="${color}" stroke-width="2" stroke-dasharray="8 5"/>`,
        svgText(el.x + 12, el.y + 20, el.name.toUpperCase(), color, 11, 'start', false, true),
      ].join('\n');
    })
    .join('\n');

  const boxSVGs = elements
    .filter((el) => el.type !== 'area' && el.type !== 'image')
    .map((el) => {
      // ── Plain text element ──
      if (el.type === 'text') {
        const rect = getBoxRect(el);
        const textValue = (el.content ?? '').trim();
        const lines = textValue.length > 0 ? textValue.split('\n') : [el.name || 'Text'];
        const size = Math.max(10, el.fontSize ?? 24);
        const align = el.textAlign ?? 'left';
        const anchor = align === 'center' ? 'middle' : align === 'right' ? 'end' : 'start';
        const tx = align === 'center' ? el.x + rect.width / 2 : align === 'right' ? el.x + rect.width - 6 : el.x + 6;
        const lineH = Math.max(14, size * 1.25);
        let ty = el.y + size;
        return lines
          .map((line) => {
            const node = svgText(tx, ty, line, textCol, size, anchor);
            ty += lineH;
            return node;
          })
          .join('\n');
      }

      // ── Note element ──
      if (el.type === 'note') {
        const nh = el.noteHeight ?? 148;
        const noteBg  = dark ? 'rgba(120,53,15,0.3)' : '#fefce8';
        const noteBdr = dark ? '#92400e' : '#fde68a';
        const noteHdr = dark ? 'rgba(120,53,15,0.6)' : '#fef08a';
        const noteClr = dark ? '#fef3c7' : '#713f12';
        const lines = [
          `<rect x="${el.x}" y="${el.y}" width="${BOX_WIDTH}" height="${nh}" rx="10" ry="10" fill="${noteBg}" stroke="${noteBdr}" stroke-width="1.5"/>`,
          `<rect x="${el.x}" y="${el.y}" width="${BOX_WIDTH}" height="32" rx="10" ry="10" fill="${noteHdr}"/>`,
          `<rect x="${el.x}" y="${el.y + 20}" width="${BOX_WIDTH}" height="12" fill="${noteHdr}"/>`,
          svgText(el.x + 8, el.y + 21, '📝 Note', noteClr, 11, 'start'),
        ];
        if (el.content) {
          const lineH = 18;
          let ty = el.y + 48;
          el.content.split('\n').forEach((line) => {
            if (line) lines.push(svgText(el.x + 8, ty, line, noteClr, 12, 'start'));
            ty += lineH;
          });
        }
        return lines.join('\n');
      }

      // ── Architecture element (service / system / actor) ──
      const rect = getBoxRect(el);
      const h = getBoxHeight(el);

      if (el.type === 'condition') {
        const cx = el.x + rect.width / 2;
        const cy = el.y + h / 2;
        return [
          `<rect x="${el.x}" y="${el.y}" width="${rect.width}" height="${h}" rx="10" ry="10" fill="#ffffff" stroke="#94a3b8" stroke-width="2"/>`,
          svgText(cx, cy + 5, el.name, '#334155', 14, 'middle', false, true),
        ].join('\n');
      }

      if (el.type === 'yes' || el.type === 'no') {
        const fill = el.type === 'yes' ? '#22c55e' : '#dc2626';
        const icon = el.type === 'yes' ? '✓' : '✕';
        return [
          `<rect x="${el.x}" y="${el.y}" width="${rect.width}" height="${h}" rx="10" ry="10" fill="${fill}" stroke="none"/>`,
          svgText(el.x + rect.width / 2, el.y + h / 2 + 5, icon, '#ffffff', 20, 'middle', false, true),
        ].join('\n');
      }

      const hdrColor = headerColorSVG(el.type);

      const lines = [
        `<rect x="${el.x}" y="${el.y}" width="${rect.width}" height="${h}" rx="10" ry="10" fill="${hdrColor}" stroke="none"/>`,
        svgText(el.x + rect.width / 2, el.y + h / 2 + 5, el.name, '#ffffff', 14, 'middle', false, true),
      ];

      return lines.join('\n');
    })
    .join('\n');

  const defs = buildSVGDefs(dark);

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg"
  viewBox="${minX} ${minY} ${W} ${H}"
  width="${W}" height="${H}"
  font-family="${FONT_FAMILY}">
  <rect x="${minX}" y="${minY}" width="${W}" height="${H}" fill="${bg}"/>
  <defs>${defs}</defs>
  ${areaSVGs}
  ${imageSVGs}
  ${arrowPaths}
  ${boxSVGs}
</svg>`;
}

async function renderDiagramToPngDataUrl(
  canvasEl: HTMLElement,
  elements: UMLElement[],
  relationships: Relationship[],
  pixelRatio = 2
): Promise<{ dataUrl: string; width: number; height: number }> {
  const bounds = computeDiagramBounds(elements, relationships);
  const exportRoot = await buildExportRoot(canvasEl, bounds);
  try {
    const dataUrl = await toPng(exportRoot, {
      cacheBust: true,
      backgroundColor: getComputedStyle(canvasEl).backgroundColor,
      width: Math.max(1, Math.round(bounds.width)),
      height: Math.max(1, Math.round(bounds.height)),
      pixelRatio,
    });

    return { dataUrl, width: Math.round(bounds.width), height: Math.round(bounds.height) };
  } finally {
    exportRoot.remove();
  }
}

async function renderDiagramToSvgDataUrl(
  canvasEl: HTMLElement,
  elements: UMLElement[],
  relationships: Relationship[]
): Promise<string> {
  const bounds = computeDiagramBounds(elements, relationships);
  const exportRoot = await buildExportRoot(canvasEl, bounds);
  try {
    return await toSvg(exportRoot, {
      cacheBust: true,
      backgroundColor: getComputedStyle(canvasEl).backgroundColor,
      width: Math.max(1, Math.round(bounds.width)),
      height: Math.max(1, Math.round(bounds.height)),
    });
  } finally {
    exportRoot.remove();
  }
}

async function buildExportRoot(
  canvasEl: HTMLElement,
  bounds: DiagramBounds
): Promise<HTMLDivElement> {
  if ('fonts' in document) {
    try {
      await (document as Document & { fonts?: FontFaceSet }).fonts?.ready;
    } catch {
      // best effort only
    }
  }

  const exportRoot = document.createElement('div');
  const computed = getComputedStyle(canvasEl);
  const rootComputed = getComputedStyle(document.documentElement);
  const cssVars = [
    '--bg-fill',
    '--panel-bg',
    '--border-color',
    '--text-primary',
    '--text-muted',
    '--canvas-bg',
    '--dot-color',
  ] as const;

  exportRoot.style.position = 'fixed';
  exportRoot.style.left = '0';
  exportRoot.style.top = '0';
  exportRoot.style.width = `${Math.max(1, Math.round(bounds.width))}px`;
  exportRoot.style.height = `${Math.max(1, Math.round(bounds.height))}px`;
  exportRoot.style.overflow = 'hidden';
  exportRoot.style.pointerEvents = 'none';
  exportRoot.style.zIndex = '-1';
  exportRoot.style.isolation = 'isolate';
  exportRoot.style.backgroundColor = computed.backgroundColor;
  exportRoot.style.backgroundImage = computed.backgroundImage;
  exportRoot.style.backgroundSize = computed.backgroundSize;
  exportRoot.style.backgroundPosition = computed.backgroundPosition;
  exportRoot.style.backgroundRepeat = computed.backgroundRepeat;
  exportRoot.style.backgroundColor = computed.backgroundColor;
  exportRoot.style.color = computed.color;

  cssVars.forEach((name) => {
    const value = rootComputed.getPropertyValue(name);
    if (value) exportRoot.style.setProperty(name, value);
  });

  const clone = canvasEl.cloneNode(true) as HTMLDivElement;
  clone.style.position = 'absolute';
  clone.style.left = `${-bounds.minX}px`;
  clone.style.top = `${-bounds.minY}px`;
  clone.style.transform = 'none';
  clone.style.transformOrigin = '0 0';
  clone.style.width = computed.width;
  clone.style.height = computed.height;
  clone.style.margin = '0';
  clone.style.backgroundColor = computed.backgroundColor;
  clone.style.backgroundImage = computed.backgroundImage;
  clone.style.backgroundSize = computed.backgroundSize;
  clone.style.backgroundPosition = computed.backgroundPosition;
  clone.style.backgroundRepeat = computed.backgroundRepeat;
  clone.style.color = computed.color;

  cssVars.forEach((name) => {
    const value = rootComputed.getPropertyValue(name);
    if (value) clone.style.setProperty(name, value);
  });

  exportRoot.appendChild(clone);
  document.body.appendChild(exportRoot);
  return exportRoot;
}

type DiagramBounds = { minX: number; minY: number; maxX: number; maxY: number; width: number; height: number };

function computeDiagramBounds(elements: UMLElement[], relationships: Relationship[]): DiagramBounds {
  if (elements.length === 0) {
    return { minX: 0, minY: 0, maxX: 400, maxY: 300, width: 400, height: 300 };
  }

  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  const includePoint = (x: number, y: number) => {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  };
  const includeRect = (x: number, y: number, w: number, h: number) => {
    includePoint(x, y);
    includePoint(x + w, y + h);
  };

  elements.forEach((el) => {
    const r = getBoxRect(el);
    includeRect(r.x, r.y, r.width, r.height);
  });

  const elMap = new Map(elements.map((e) => [e.id, e]));
  relationships.forEach((r) => {
    const src = elMap.get(r.sourceId);
    const tgt = elMap.get(r.targetId);
    if (!src || !tgt) return;
    const srcRect = getBoxRect(src);
    const tgtRect = getBoxRect(tgt);
    const { srcSide, tgtSide } = bestAnchorPair(srcRect, tgtRect);
    const start = getAnchorPoint(srcRect, srcSide);
    const end = getAnchorPoint(tgtRect, tgtSide);
    const cp1 = outwardControl(start, srcSide);
    const cp2 = outwardControl(end, tgtSide);
    includePoint(start.x, start.y);
    includePoint(end.x, end.y);
    includePoint(cp1.x, cp1.y);
    includePoint(cp2.x, cp2.y);
  });

  const contentW = Math.max(1, maxX - minX);
  const contentH = Math.max(1, maxY - minY);
  const padX = Math.max(16, contentW * 0.1);
  const padY = Math.max(16, contentH * 0.1);
  const outMinX = minX - padX;
  const outMinY = minY - padY;
  const outMaxX = maxX + padX;
  const outMaxY = maxY + padY;

  return {
    minX: outMinX,
    minY: outMinY,
    maxX: outMaxX,
    maxY: outMaxY,
    width: outMaxX - outMinX,
    height: outMaxY - outMinY,
  };
}

function outwardControl(p: { x: number; y: number }, side: 'top' | 'right' | 'bottom' | 'left') {
  const offset = 80;
  switch (side) {
    case 'top':
      return { x: p.x, y: p.y - offset };
    case 'bottom':
      return { x: p.x, y: p.y + offset };
    case 'left':
      return { x: p.x - offset, y: p.y };
    case 'right':
      return { x: p.x + offset, y: p.y };
  }
}

function offsetOutsideBox(
  point: { x: number; y: number },
  side: 'top' | 'right' | 'bottom' | 'left',
  distance: number
) {
  switch (side) {
    case 'top':
      return { x: point.x, y: point.y - distance };
    case 'bottom':
      return { x: point.x, y: point.y + distance };
    case 'left':
      return { x: point.x - distance, y: point.y };
    case 'right':
      return { x: point.x + distance, y: point.y };
  }
}

function svgText(
  x: number,
  y: number,
  text: string,
  fill: string,
  size: number,
  anchor: string,
  italic = false,
  bold = false
) {
  const style = `font-size:${size}px;${italic ? 'font-style:italic;' : ''}${bold ? 'font-weight:600;' : ''}`;
  const safe = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return `<text x="${x}" y="${y}" fill="${fill}" text-anchor="${anchor}" style="${style}">${safe}</text>`;
}

function headerColorSVG(type: string) {
  if (type === 'database') return '#10b981'; // emerald
  if (type === 'service')  return '#7c3aed'; // violet
  if (type === 'object')   return '#f97316'; // orange
  if (type === 'note')     return '#fef08a';
  return '#2563eb'; // server (default, blue)
}

function relationColorSVG(type: string) {
  if (type === 'composition') return '#dc2626';
  if (type === 'aggregation') return '#0891b2';
  if (type === 'inheritance') return '#8b5cf6';
  if (type === 'association') return '#3b82f6';
  if (type === 'realization') return '#10b981';
  return '#6b7280';
}

function svgMarkerRef(type: string, _dark: boolean): string {
  switch (type) {
    case 'association':
    case 'dependency':
      return 'url(#arrow-open)';
    case 'inheritance':
    case 'realization':
      return 'url(#arrow-hollow)';
    case 'composition':
    case 'aggregation':
      return 'url(#arrow-open)';
    default:
      return '';
  }
}

function svgMarkerStartRef(type: string, _dark: boolean): string {
  if (type === 'composition') return 'url(#diamond-filled)';
  if (type === 'aggregation') return 'url(#diamond-hollow)';
  return '';
}

function buildSVGDefs(_dark: boolean) {
  const stroke = _dark ? '#94a3b8' : '#475569';
  const fill = _dark ? '#1e293b' : '#ffffff';
  return `
  <marker id="arrow-open" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto">
    <polygon points="0,0 10,5 0,10" fill="${stroke}" stroke="${stroke}" stroke-width="1"/>
  </marker>
  <marker id="arrow-hollow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="10" markerHeight="10" orient="auto">
    <polygon points="0,0 10,5 0,10" fill="${stroke}" stroke="${stroke}" stroke-width="1"/>
  </marker>
  <marker id="diamond-filled" viewBox="0 0 20 10" refX="1" refY="5" markerWidth="14" markerHeight="10" orient="auto-start-reverse">
    <polygon points="0,5 10,0 20,5 10,10" fill="${stroke}" stroke="${stroke}" stroke-width="1"/>
  </marker>
  <marker id="diamond-hollow" viewBox="0 0 20 10" refX="1" refY="5" markerWidth="14" markerHeight="10" orient="auto-start-reverse">
    <polygon points="0,5 10,0 20,5 10,10" fill="${fill}" stroke="${stroke}" stroke-width="1.5"/>
  </marker>`;
}

export async function exportSVGGenerated(
  canvasEl: HTMLElement,
  elements: UMLElement[],
  relationships: Relationship[],
  filename: string = 'diagram.svg'
): Promise<void> {
  await exportSVGCapture(canvasEl, elements, relationships, filename);
}

// ────────── Helper ──────────
function downloadDataUrl(url: string, filename: string) {
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
}

