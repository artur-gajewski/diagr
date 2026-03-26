import type { UMLElement, Point, Rect, AnchorSide } from '@/types';

// ────────── Layout constants ──────────
export const BOX_WIDTH          = 200;
export const BOX_HEIGHT         = 72;   // fixed height for class / interface / abstract
export const NOTE_MIN_HEIGHT    = 148;
export const NOTE_HEADER_HEIGHT = 32;
export const GRID_STEP          = 24;

export function snapToGrid(value: number, step = GRID_STEP): number {
  return Math.round(value / step) * step;
}

// kept for any legacy references — no longer used by non-note boxes
export const HEADER_HEIGHT         = BOX_HEIGHT;
export const SECTION_HEADER_HEIGHT = 28;
export const ROW_HEIGHT            = 28;
export const ADD_BTN_HEIGHT        = 30;
export const SECTION_BOTTOM_PAD    = 4;

export function getBoxHeight(el: UMLElement): number {
  if (el.type === 'note') return el.noteHeight ?? NOTE_MIN_HEIGHT;
  return el.boxHeight ?? BOX_HEIGHT;
}

export function getBoxWidth(el: UMLElement): number {
  if (el.type === 'note') return BOX_WIDTH;
  return el.boxWidth ?? BOX_WIDTH;
}

export function getBoxRect(el: UMLElement): Rect {
  return { x: el.x, y: el.y, width: getBoxWidth(el), height: getBoxHeight(el) };
}

// ────────── Anchor points ──────────
export function getAnchorPoint(rect: Rect, side: AnchorSide): Point {
  switch (side) {
    case 'top':
      return { x: rect.x + rect.width / 2, y: rect.y };
    case 'bottom':
      return { x: rect.x + rect.width / 2, y: rect.y + rect.height };
    case 'left':
      return { x: rect.x, y: rect.y + rect.height / 2 };
    case 'right':
      return { x: rect.x + rect.width, y: rect.y + rect.height / 2 };
  }
}

/** Pick the best opposing anchor sides based on the vector between box centres. */
export function bestAnchorPair(
  src: Rect,
  tgt: Rect
): { srcSide: AnchorSide; tgtSide: AnchorSide } {
  const srcCx = src.x + src.width / 2;
  const srcCy = src.y + src.height / 2;
  const tgtCx = tgt.x + tgt.width / 2;
  const tgtCy = tgt.y + tgt.height / 2;

  const dx = tgtCx - srcCx;
  const dy = tgtCy - srcCy;
  const angle = Math.atan2(dy, dx); // -π … π

  if (angle > -Math.PI / 4 && angle <= Math.PI / 4) {
    return { srcSide: 'right', tgtSide: 'left' };
  } else if (angle > Math.PI / 4 && angle <= (3 * Math.PI) / 4) {
    return { srcSide: 'bottom', tgtSide: 'top' };
  } else if (angle > (3 * Math.PI) / 4 || angle <= (-3 * Math.PI) / 4) {
    return { srcSide: 'left', tgtSide: 'right' };
  } else {
    return { srcSide: 'top', tgtSide: 'bottom' };
  }
}

/** Build a cubic-bezier SVG path string between two anchored points. */
const CTRL_OFFSET = 80;

export function buildBezierPath(
  start: Point,
  end: Point,
  srcSide: AnchorSide,
  tgtSide: AnchorSide
): string {
  const cp1 = outwardControl(start, srcSide);
  const cp2 = outwardControl(end, tgtSide);
  return `M ${fmt(start.x)} ${fmt(start.y)} C ${fmt(cp1.x)} ${fmt(cp1.y)}, ${fmt(cp2.x)} ${fmt(cp2.y)}, ${fmt(end.x)} ${fmt(end.y)}`;
}

function outwardControl(p: Point, side: AnchorSide): Point {
  switch (side) {
    case 'top':
      return { x: p.x, y: p.y - CTRL_OFFSET };
    case 'bottom':
      return { x: p.x, y: p.y + CTRL_OFFSET };
    case 'left':
      return { x: p.x - CTRL_OFFSET, y: p.y };
    case 'right':
      return { x: p.x + CTRL_OFFSET, y: p.y };
  }
}

function fmt(n: number) {
  return Math.round(n * 10) / 10;
}

/** Midpoint along a cubic bezier at t=0.5, used for label placement. */
export function bezierMidpoint(
  start: Point,
  end: Point,
  srcSide: AnchorSide,
  tgtSide: AnchorSide
): Point {
  const cp1 = outwardControl(start, srcSide);
  const cp2 = outwardControl(end, tgtSide);
  const t = 0.5;
  const mt = 1 - t;
  return {
    x:
      mt * mt * mt * start.x +
      3 * mt * mt * t * cp1.x +
      3 * mt * t * t * cp2.x +
      t * t * t * end.x,
    y:
      mt * mt * mt * start.y +
      3 * mt * mt * t * cp1.y +
      3 * mt * t * t * cp2.y +
      t * t * t * end.y,
  };
}

// ────────── Fit to content ──────────
export interface FitToContentResult {
  zoom: number;
  panX: number;
  panY: number;
}

export function calculateFitToContent(
  elements: UMLElement[],
  relationships: any[],
  viewportWidth: number,
  viewportHeight: number
): FitToContentResult {
  if (elements.length === 0) {
    return { zoom: 1, panX: 0, panY: 0 };
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

  // Include all elements
  elements.forEach((el) => {
    const r = getBoxRect(el);
    includeRect(r.x, r.y, r.width, r.height);
  });

  // Include all relationships (control points)
  const elMap = new Map(elements.map((e) => [e.id, e]));
  const CTRL_OFFSET = 80;
  const outwardControl = (p: Point, side: AnchorSide): Point => {
    switch (side) {
      case 'top':
        return { x: p.x, y: p.y - CTRL_OFFSET };
      case 'bottom':
        return { x: p.x, y: p.y + CTRL_OFFSET };
      case 'left':
        return { x: p.x - CTRL_OFFSET, y: p.y };
      case 'right':
        return { x: p.x + CTRL_OFFSET, y: p.y };
    }
  };

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
  const boundsMinX = minX - padX;
  const boundsMinY = minY - padY;
  const boundsW = contentW + padX * 2;
  const boundsH = contentH + padY * 2;

  if (viewportWidth <= 0 || viewportHeight <= 0) {
    return { zoom: 1, panX: 0, panY: 0 };
  }

  const nextZoom = Math.min(3, Math.max(0.2, Math.min(viewportWidth / boundsW, viewportHeight / boundsH)));
  const nextPanX = (viewportWidth - boundsW * nextZoom) / 2 - boundsMinX * nextZoom;
  const nextPanY = (viewportHeight - boundsH * nextZoom) / 2 - boundsMinY * nextZoom;

  return { zoom: nextZoom, panX: nextPanX, panY: nextPanY };
}
