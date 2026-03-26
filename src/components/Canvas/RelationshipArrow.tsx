import { useState } from 'react';
import { motion } from 'framer-motion';
import type { Relationship, UMLElement } from '@/types';
import {
  getBoxRect,
  bestAnchorPair,
  getAnchorPoint,
  buildBezierPath,
} from '@/utils/geometry';
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
}

export function RelationshipArrow({ relationship, elements }: RelationshipArrowProps) {
  const [hovered, setHovered] = useState(false);
  const { selectedRelationshipId, selectRelationship, tool } = useUIStore();

  const src = elements.find((e) => e.id === relationship.sourceId);
  const tgt = elements.find((e) => e.id === relationship.targetId);
  if (!src || !tgt) return null;

  const srcRect = getBoxRect(src);
  const tgtRect = getBoxRect(tgt);
  const { srcSide, tgtSide } = bestAnchorPair(srcRect, tgtRect);
  const start  = getAnchorPoint(srcRect, srcSide);
  const end    = getAnchorPoint(tgtRect, tgtSide);
  const d      = buildBezierPath(start, end, srcSide, tgtSide);

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

