import type {
  UMLElement,
  Point,
  Rect,
  AnchorSide,
  Relationship,
  RelationshipRoutingMode,
} from '@/types';

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
const REL_LANE_SPACING = 20;
const BRIDGE_HALF_WIDTH = 8;
const BRIDGE_HEIGHT = 8;
const BRIDGE_MARGIN = 14;

export interface RelationshipRouteMeta {
  routeIndex: number;
  routeCount: number;
}

export interface RelationshipSegment {
  orientation: 'horizontal' | 'vertical';
  start: Point;
  end: Point;
  segmentIndex: number;
}

export interface RelationshipRoute {
  relationshipId: string;
  routingMode: RelationshipRoutingMode;
  srcSide: AnchorSide;
  tgtSide: AnchorSide;
  start: Point;
  end: Point;
  drawPathD: string;
  hitPathD: string;
  labelPoint: Point;
  sourceMultiplicityPoint: Point;
  targetMultiplicityPoint: Point;
  boundsPoints: Point[];
  points: Point[];
  segments: RelationshipSegment[];
}

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

export function offsetOutsideBox(point: Point, side: AnchorSide, distance: number): Point {
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

export function buildRelationshipRouteMeta(
  relationships: Relationship[]
): Map<string, RelationshipRouteMeta> {
  const byPair = new Map<string, string[]>();
  relationships.forEach((r) => {
    const [a, b] = [r.sourceId, r.targetId].sort((x, y) => x.localeCompare(y));
    const key = `${a}::${b}`;
    const ids = byPair.get(key);
    if (ids) ids.push(r.id);
    else byPair.set(key, [r.id]);
  });

  const meta = new Map<string, RelationshipRouteMeta>();
  byPair.forEach((ids) => {
    ids.forEach((id, idx) => {
      meta.set(id, { routeIndex: idx, routeCount: ids.length });
    });
  });
  return meta;
}

export function buildRelationshipRoutes(
  elements: UMLElement[],
  relationships: Relationship[]
): Map<string, RelationshipRoute> {
  const metaMap = buildRelationshipRouteMeta(relationships);
  const routes = new Map<string, RelationshipRoute>();

  relationships.forEach((relationship) => {
    const route = computeRelationshipRoute(
      relationship,
      elements,
      metaMap.get(relationship.id) ?? { routeIndex: 0, routeCount: 1 }
    );
    if (route) routes.set(relationship.id, route);
  });

  applyOrthogonalBridges(routes);
  return routes;
}

function computeRelationshipRoute(
  relationship: Relationship,
  elements: UMLElement[],
  meta: RelationshipRouteMeta
): RelationshipRoute | null {
  const src = elements.find((e) => e.id === relationship.sourceId);
  const tgt = elements.find((e) => e.id === relationship.targetId);
  if (!src || !tgt) return null;

  const srcRect = getBoxRect(src);
  const tgtRect = getBoxRect(tgt);
  const pair = bestAnchorPair(srcRect, tgtRect);
  const srcSide: AnchorSide = relationship.sourceAnchorOverride ?? pair.srcSide;
  const tgtSide: AnchorSide = relationship.targetAnchorOverride ?? pair.tgtSide;
  const rawStart = getAnchorPoint(srcRect, srcSide);
  const rawEnd = getAnchorPoint(tgtRect, tgtSide);

  const srcCenter = { x: srcRect.x + srcRect.width / 2, y: srcRect.y + srcRect.height / 2 };
  const tgtCenter = { x: tgtRect.x + tgtRect.width / 2, y: tgtRect.y + tgtRect.height / 2 };
  const canonicalForward = relationship.sourceId.localeCompare(relationship.targetId) <= 0;
  const pairFrom = canonicalForward ? srcCenter : tgtCenter;
  const pairTo = canonicalForward ? tgtCenter : srcCenter;
  const pairDx = pairTo.x - pairFrom.x;
  const pairDy = pairTo.y - pairFrom.y;
  const pairLen = Math.hypot(pairDx, pairDy) || 1;
  const nx = -pairDy / pairLen;
  const ny = pairDx / pairLen;

  const laneOffset = meta.routeCount > 1 ? (meta.routeIndex - (meta.routeCount - 1) / 2) * REL_LANE_SPACING : 0;
  const laneStart = { x: rawStart.x + nx * laneOffset, y: rawStart.y + ny * laneOffset };
  const laneEnd = { x: rawEnd.x + nx * laneOffset, y: rawEnd.y + ny * laneOffset };

  const markerPad = 6;
  const start = offsetOutsideBox(
    laneStart,
    srcSide,
    relationship.type === 'composition' || relationship.type === 'aggregation' ? markerPad : 2
  );
  const end = offsetOutsideBox(laneEnd, tgtSide, markerPad);

  const routingMode = relationship.routingMode ?? 'curved';

  if (routingMode === 'orthogonal') {
    const points = buildOrthogonalPoints(start, end, srcSide, tgtSide);
    const segments = buildSegments(points);
    return {
      relationshipId: relationship.id,
      routingMode,
      srcSide,
      tgtSide,
      start,
      end,
      drawPathD: buildPolylinePath(points),
      hitPathD: buildPolylinePath(points),
      labelPoint: midpointAlongSegments(segments),
      sourceMultiplicityPoint: multiplicityPoint(start, srcSide, 'source'),
      targetMultiplicityPoint: multiplicityPoint(end, tgtSide, 'target'),
      boundsPoints: [...points],
      points,
      segments,
    };
  }

  const cp1 = outwardControl(start, srcSide);
  const cp2 = outwardControl(end, tgtSide);
  return {
    relationshipId: relationship.id,
    routingMode,
    srcSide,
    tgtSide,
    start,
    end,
    drawPathD: buildBezierPath(start, end, srcSide, tgtSide),
    hitPathD: buildBezierPath(start, end, srcSide, tgtSide),
    labelPoint: bezierMidpoint(start, end, srcSide, tgtSide),
    sourceMultiplicityPoint: multiplicityPoint(start, srcSide, 'source'),
    targetMultiplicityPoint: multiplicityPoint(end, tgtSide, 'target'),
    boundsPoints: [start, end, cp1, cp2],
    points: [start, end],
    segments: [],
  };
}

function buildOrthogonalPoints(
  start: Point,
  end: Point,
  srcSide: AnchorSide,
  tgtSide: AnchorSide
): Point[] {
  const points: Point[] = [start];
  const srcHorizontal = srcSide === 'left' || srcSide === 'right';
  const tgtHorizontal = tgtSide === 'left' || tgtSide === 'right';

  if (srcHorizontal && tgtHorizontal) {
    const midX = (start.x + end.x) / 2;
    points.push({ x: midX, y: start.y }, { x: midX, y: end.y });
  } else if (!srcHorizontal && !tgtHorizontal) {
    const midY = (start.y + end.y) / 2;
    points.push({ x: start.x, y: midY }, { x: end.x, y: midY });
  } else if (srcHorizontal) {
    points.push({ x: end.x, y: start.y });
  } else {
    points.push({ x: start.x, y: end.y });
  }

  points.push(end);
  return points.filter((point, idx, arr) => idx === 0 || point.x !== arr[idx - 1].x || point.y !== arr[idx - 1].y);
}

function buildSegments(points: Point[]): RelationshipSegment[] {
  const segments: RelationshipSegment[] = [];
  let segmentIndex = 0;
  for (let i = 1; i < points.length; i += 1) {
    const start = points[i - 1];
    const end = points[i];
    if (start.x === end.x && start.y === end.y) continue;
    segments.push({
      orientation: start.y === end.y ? 'horizontal' : 'vertical',
      start,
      end,
      segmentIndex,
    });
    segmentIndex += 1;
  }
  return segments;
}

function buildPolylinePath(points: Point[]): string {
  if (points.length === 0) return '';
  let d = `M ${fmt(points[0].x)} ${fmt(points[0].y)}`;
  for (let i = 1; i < points.length; i += 1) {
    d += ` L ${fmt(points[i].x)} ${fmt(points[i].y)}`;
  }
  return d;
}

function midpointAlongSegments(segments: RelationshipSegment[]): Point {
  if (segments.length === 0) return { x: 0, y: 0 };
  const lengths = segments.map((segment) =>
    Math.abs(segment.end.x - segment.start.x) + Math.abs(segment.end.y - segment.start.y)
  );
  const total = lengths.reduce((sum, length) => sum + length, 0);
  let remaining = total / 2;

  for (let i = 0; i < segments.length; i += 1) {
    const segment = segments[i];
    const length = lengths[i];
    if (remaining <= length) {
      if (segment.orientation === 'horizontal') {
        const dir = Math.sign(segment.end.x - segment.start.x) || 1;
        return { x: segment.start.x + dir * remaining, y: segment.start.y };
      }
      const dir = Math.sign(segment.end.y - segment.start.y) || 1;
      return { x: segment.start.x, y: segment.start.y + dir * remaining };
    }
    remaining -= length;
  }

  const last = segments[segments.length - 1];
  return { ...last.end };
}

function multiplicityPoint(point: Point, side: AnchorSide, role: 'source' | 'target'): Point {
  switch (side) {
    case 'top':
      return { x: point.x + (role === 'source' ? 12 : -12), y: point.y - 8 };
    case 'bottom':
      return { x: point.x + (role === 'source' ? 12 : -12), y: point.y + 14 };
    case 'left':
      return { x: point.x - 12, y: point.y - 8 };
    case 'right':
      return { x: point.x + 12, y: point.y - 8 };
  }
}

function applyOrthogonalBridges(routes: Map<string, RelationshipRoute>) {
  const bridgeMap = new Map<string, Record<number, number[]>>();
  const orthogonalRoutes = [...routes.values()].filter((route) => route.routingMode === 'orthogonal');

  for (let i = 0; i < orthogonalRoutes.length; i += 1) {
    const routeA = orthogonalRoutes[i];
    for (let j = i + 1; j < orthogonalRoutes.length; j += 1) {
      const routeB = orthogonalRoutes[j];

      routeA.segments.filter((s) => s.orientation === 'horizontal').forEach((hs) => {
        routeB.segments.filter((s) => s.orientation === 'vertical').forEach((vs) => {
          const x = vs.start.x;
          const y = hs.start.y;
          const hMin = Math.min(hs.start.x, hs.end.x);
          const hMax = Math.max(hs.start.x, hs.end.x);
          const vMin = Math.min(vs.start.y, vs.end.y);
          const vMax = Math.max(vs.start.y, vs.end.y);
          if (
            x > hMin + BRIDGE_MARGIN &&
            x < hMax - BRIDGE_MARGIN &&
            y > vMin + BRIDGE_MARGIN &&
            y < vMax - BRIDGE_MARGIN
          ) {
            const routeBridges = bridgeMap.get(routeA.relationshipId) ?? {};
            routeBridges[hs.segmentIndex] = [...(routeBridges[hs.segmentIndex] ?? []), x].sort((a, b) => a - b);
            bridgeMap.set(routeA.relationshipId, routeBridges);
          }
        });
      });

      routeB.segments.filter((s) => s.orientation === 'horizontal').forEach((hs) => {
        routeA.segments.filter((s) => s.orientation === 'vertical').forEach((vs) => {
          const x = vs.start.x;
          const y = hs.start.y;
          const hMin = Math.min(hs.start.x, hs.end.x);
          const hMax = Math.max(hs.start.x, hs.end.x);
          const vMin = Math.min(vs.start.y, vs.end.y);
          const vMax = Math.max(vs.start.y, vs.end.y);
          if (
            x > hMin + BRIDGE_MARGIN &&
            x < hMax - BRIDGE_MARGIN &&
            y > vMin + BRIDGE_MARGIN &&
            y < vMax - BRIDGE_MARGIN
          ) {
            const routeBridges = bridgeMap.get(routeB.relationshipId) ?? {};
            routeBridges[hs.segmentIndex] = [...(routeBridges[hs.segmentIndex] ?? []), x].sort((a, b) => a - b);
            bridgeMap.set(routeB.relationshipId, routeBridges);
          }
        });
      });
    }
  }

  orthogonalRoutes.forEach((route) => {
    const bridges = bridgeMap.get(route.relationshipId) ?? {};
    route.drawPathD = buildOrthogonalBridgePath(route.points, bridges);
    route.boundsPoints = [
      ...route.points,
      ...Object.values(bridges).flat().map((x) => ({ x, y: route.points.find((p, idx) => {
        const next = route.points[idx + 1];
        return next && p.y === next.y && x >= Math.min(p.x, next.x) && x <= Math.max(p.x, next.x);
      })?.y ?? route.start.y - BRIDGE_HEIGHT }))
        .map((point) => ({ x: point.x, y: point.y - BRIDGE_HEIGHT })),
    ];
  });
}

function buildOrthogonalBridgePath(points: Point[], bridgeXsBySegment: Record<number, number[]>): string {
  if (points.length === 0) return '';

  let d = `M ${fmt(points[0].x)} ${fmt(points[0].y)}`;
  let segmentIndex = 0;

  for (let i = 1; i < points.length; i += 1) {
    const start = points[i - 1];
    const end = points[i];
    if (start.x === end.x && start.y === end.y) continue;

    if (start.y === end.y) {
      const dir = Math.sign(end.x - start.x) || 1;
      const sorted = [...(bridgeXsBySegment[segmentIndex] ?? [])].sort((a, b) => dir > 0 ? a - b : b - a);
      let cursorX = start.x;
      for (const bridgeX of sorted) {
        const preX = bridgeX - dir * BRIDGE_HALF_WIDTH;
        const postX = bridgeX + dir * BRIDGE_HALF_WIDTH;
        const valid = dir > 0
          ? preX > cursorX + 0.5 && postX < end.x - 0.5
          : preX < cursorX - 0.5 && postX > end.x + 0.5;
        if (!valid) continue;
        d += ` L ${fmt(preX)} ${fmt(start.y)}`;
        d += ` Q ${fmt(bridgeX)} ${fmt(start.y - BRIDGE_HEIGHT)} ${fmt(postX)} ${fmt(start.y)}`;
        cursorX = postX;
      }
      d += ` L ${fmt(end.x)} ${fmt(end.y)}`;
    } else {
      d += ` L ${fmt(end.x)} ${fmt(end.y)}`;
    }

    segmentIndex += 1;
  }

  return d;
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
  relationships: Relationship[],
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

  buildRelationshipRoutes(elements, relationships).forEach((route) => {
    route.boundsPoints.forEach((point) => includePoint(point.x, point.y));
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

// ────────── Anchor helpers ──────────
/**
 * Given a point in canvas space and a rect, returns the side of the rect that the
 * point "approaches from" — i.e., the side a connection exiting the rect toward that
 * point would use.  Normalises dx/dy by the half-dimensions so non-square boxes work.
 */
export function getNearestSide(point: Point, rect: Rect): AnchorSide {
  const cx = rect.x + rect.width / 2;
  const cy = rect.y + rect.height / 2;
  const dx = point.x - cx;
  const dy = point.y - cy;
  const nx = rect.width  > 0 ? dx / (rect.width  / 2) : dx;
  const ny = rect.height > 0 ? dy / (rect.height / 2) : dy;
  if (Math.abs(nx) >= Math.abs(ny)) return nx >= 0 ? 'right' : 'left';
  return ny >= 0 ? 'bottom' : 'top';
}

// ────────── Marquee selection helpers ──────────

