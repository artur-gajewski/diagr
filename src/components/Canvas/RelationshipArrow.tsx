import { useState } from 'react';
import { motion } from 'framer-motion';
import type { Relationship, UMLElement } from '@/types';
import {
  getBoxRect,
  bestAnchorPair,
  getAnchorPoint,
  buildBezierPath,
} from '@/utils/geometry';
import type { AnchorSide, Point } from '@/types';
import { useUIStore } from '@/store/uiStore';


const REL_COLORS: Record<string, string> = {
  association: '#3b82f6',
  inheritance: '#8b5cf6',
  composition: '#dc2626',
  aggregation: '#0891b2',
  dependency:  '#6b7280',
  realization: '#10b981',
};

interface RelationshipArrowProps {
  relationship: Relationship;
  elements: UMLElement[];
  routeIndex?: number;
  routeCount?: number;
}

export function RelationshipArrow({ relationship, elements, routeIndex = 0, routeCount = 1 }: RelationshipArrowProps) {
  const [hovered, setHovered] = useState(false);
  const { selectedRelationshipId, selectRelationship, tool } = useUIStore();

  const src = elements.find((e) => e.id === relationship.sourceId);
  const tgt = elements.find((e) => e.id === relationship.targetId);
  if (!src || !tgt) return null;

  const srcRect = getBoxRect(src);
  const tgtRect = getBoxRect(tgt);
  const { srcSide, tgtSide } = bestAnchorPair(srcRect, tgtRect);
  const rawStart  = getAnchorPoint(srcRect, srcSide);
  const rawEnd    = getAnchorPoint(tgtRect, tgtSide);

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

  const laneSpacing = 20;
  const laneOffset = routeCount > 1 ? (routeIndex - (routeCount - 1) / 2) * laneSpacing : 0;
  const laneStart = { x: rawStart.x + nx * laneOffset, y: rawStart.y + ny * laneOffset };
  const laneEnd = { x: rawEnd.x + nx * laneOffset, y: rawEnd.y + ny * laneOffset };

  const markerPad = 6;
  const start = offsetOutsideBox(laneStart, srcSide, relationship.type === 'composition' || relationship.type === 'aggregation' ? markerPad : 2);
  const end = offsetOutsideBox(laneEnd, tgtSide, markerPad);
  const d = buildBezierPath(start, end, srcSide, tgtSide);

  const isSelected  = selectedRelationshipId === relationship.id;
  const active      = hovered || isSelected;
  const color       = REL_COLORS[relationship.type] ?? '#6b7280';
  const isDashed    = relationship.isDashed ?? (relationship.type === 'dependency' || relationship.type === 'realization');
  const typeDash    = relationship.type === 'aggregation' ? '2 5' : undefined;
  const dashArray   = isDashed ? '7 4' : typeDash;
  const baseWidth   = relationship.type === 'composition' ? 1.9 : 1.5;
  const activeWidth = relationship.type === 'composition' ? 2.9 : 2.5;

  const markerEnd   = (relationship.type === 'inheritance' || relationship.type === 'realization')
    ? 'url(#mk-arrow-hollow)'
    : 'url(#mk-arrow-open)';
  const markerStart = relationship.type === 'composition'
    ? 'url(#mk-diamond-filled)'
    : relationship.type === 'aggregation'
    ? 'url(#mk-diamond-hollow)'
    : undefined;

  const handleLineClick = (e: React.MouseEvent) => {
    if (tool !== 'select') return;
    e.stopPropagation();
    selectRelationship(isSelected ? null : relationship.id);
  };

  return (
    <g
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ pointerEvents: 'all' }}
    >
      {/* ── Wide invisible hit target ── */}
      <path
        d={d}
        fill="none"
        stroke="transparent"
        strokeWidth={18}
        style={{ cursor: tool === 'select' ? 'pointer' : 'default', pointerEvents: 'stroke' }}
        onClick={handleLineClick}
      />

      {/* ── Visual arrow line ── */}
      <motion.path
        d={d}
        fill="none"
        stroke={color}
        strokeWidth={active ? activeWidth : baseWidth}
        strokeDasharray={dashArray}
        strokeLinecap={relationship.type === 'aggregation' ? 'round' : 'butt'}
        markerEnd={markerEnd}
        markerStart={markerStart}
        opacity={active ? 1 : 0.7}
        animate={{ strokeWidth: active ? activeWidth : baseWidth, opacity: active ? 1 : 0.7 }}
        transition={{ duration: 0.15 }}
        style={{ color, pointerEvents: 'none' }}
      />

      {/* ── Selected highlight glow ── */}
      {isSelected && (
        <path
          d={d}
          fill="none"
          stroke={color}
          strokeWidth={6}
          opacity={0.18}
          style={{ pointerEvents: 'none' }}
        />
      )}

      {/* ── Multiplicity labels (always shown when present) ── */}
      {relationship.sourceMultiplicity && (
        <text x={start.x + 10} y={start.y - 6} fontSize={10} fill={color} textAnchor="middle"
          fontFamily="Inter, system-ui, sans-serif" style={{ pointerEvents: 'none' }}>
          {relationship.sourceMultiplicity}
        </text>
      )}
      {relationship.targetMultiplicity && (
        <text x={end.x - 10} y={end.y - 6} fontSize={10} fill={color} textAnchor="middle"
          fontFamily="Inter, system-ui, sans-serif" style={{ pointerEvents: 'none' }}>
          {relationship.targetMultiplicity}
        </text>
      )}

    </g>
  );
}

function offsetOutsideBox(point: Point, side: AnchorSide, distance: number): Point {
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

