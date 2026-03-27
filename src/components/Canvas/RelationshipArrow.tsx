import { useContext, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import type { Relationship } from '@/types';
import type { RelationshipRoute } from '@/utils/geometry';
import { getBoxRect, getNearestSide } from '@/utils/geometry';
import { useUIStore } from '@/store/uiStore';
import { useDiagramStore } from '@/store/diagramStore';
import { CanvasContext } from './DiagramCanvas';


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
  route: RelationshipRoute | null;
}

export function RelationshipArrow({ relationship, route }: RelationshipArrowProps) {
  const [hovered, setHovered] = useState(false);
  const [draggingHandle, setDraggingHandle] = useState<'source' | 'target' | null>(null);
  const suppressNextClickRef = useRef(false);

  const { selectedRelationshipId, selectRelationship, tool } = useUIStore();
  const updateRelationship = useDiagramStore((s) => s.updateRelationship);
  const { toCanvasPoint } = useContext(CanvasContext);

  if (!route) return null;

  const isSelected = selectedRelationshipId === relationship.id;
  const active     = hovered || isSelected;
  const color      = REL_COLORS[relationship.type] ?? '#6b7280';
  const isDashed   = relationship.isDashed ?? (relationship.type === 'dependency' || relationship.type === 'realization');
  const typeDash   = relationship.type === 'aggregation' ? '2 5' : undefined;
  const dashArray  = isDashed ? '7 4' : typeDash;
  const baseWidth  = relationship.type === 'composition' ? 1.9 : 1.5;
  const activeWidth= relationship.type === 'composition' ? 2.9 : 2.5;

  const markerEnd  = (relationship.type === 'inheritance' || relationship.type === 'realization')
    ? 'url(#mk-arrow-hollow)' : 'url(#mk-arrow-open)';
  const markerStart= relationship.type === 'composition'
    ? 'url(#mk-diamond-filled)'
    : relationship.type === 'aggregation' ? 'url(#mk-diamond-hollow)' : undefined;

  // ── Drag the line body to re-route both anchor sides ──
  const handleLineMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    if (tool === 'pan') {
      suppressNextClickRef.current = true;
      return;
    }
    if (tool !== 'select') return;

    suppressNextClickRef.current = false;
    e.stopPropagation();

    const startX = e.clientX;
    const startY = e.clientY;
    let didDrag = false;

    const onMove = (ev: MouseEvent) => {
      if (!didDrag) {
        if (Math.abs(ev.clientX - startX) > 4 || Math.abs(ev.clientY - startY) > 4) {
          didDrag = true;
          if (!isSelected) selectRelationship(relationship.id);
        }
      }
      if (!didDrag) return;

      const pt = toCanvasPoint(ev.clientX, ev.clientY);
      if (!pt) return;

      const { elements } = useDiagramStore.getState();
      const srcEl = elements.find((el) => el.id === relationship.sourceId);
      const tgtEl = elements.find((el) => el.id === relationship.targetId);
      if (!srcEl || !tgtEl) return;

      updateRelationship(relationship.id, {
        sourceAnchorOverride: getNearestSide(pt, getBoxRect(srcEl)),
        targetAnchorOverride: getNearestSide(pt, getBoxRect(tgtEl)),
      });
    };

    const onUp = () => {
      if (didDrag) suppressNextClickRef.current = true;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  // ── Drag an endpoint handle to change just that anchor side ──
  const handleEndpointMouseDown = (e: React.MouseEvent, endpoint: 'source' | 'target') => {
    if (e.button !== 0 || tool !== 'select') return;
    e.preventDefault();
    e.stopPropagation();
    setDraggingHandle(endpoint);

    const elementId = endpoint === 'source' ? relationship.sourceId : relationship.targetId;

    const onMove = (ev: MouseEvent) => {
      const pt = toCanvasPoint(ev.clientX, ev.clientY);
      if (!pt) return;
      const el = useDiagramStore.getState().elements.find((el) => el.id === elementId);
      if (!el) return;
      const side = getNearestSide(pt, getBoxRect(el));
      updateRelationship(relationship.id,
        endpoint === 'source' ? { sourceAnchorOverride: side } : { targetAnchorOverride: side }
      );
    };

    const onUp = () => {
      setDraggingHandle(null);
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  const handleLineClick = (e: React.MouseEvent) => {
    if (tool !== 'select') return;
    if (suppressNextClickRef.current) {
      suppressNextClickRef.current = false;
      return;
    }
    e.stopPropagation();
    selectRelationship(isSelected ? null : relationship.id);
  };

  const lineCursor = draggingHandle
    ? 'grabbing'
    : tool === 'select' ? 'pointer' : 'default';

  return (
    <g
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ pointerEvents: 'all' }}
    >
      {/* ── Wide invisible hit target ── */}
      <path
        d={route.hitPathD}
        fill="none"
        stroke="transparent"
        strokeWidth={18}
        style={{ cursor: lineCursor, pointerEvents: 'stroke' }}
        onMouseDown={handleLineMouseDown}
        onClick={handleLineClick}
      />

      {/* ── Visual arrow line ── */}
      <motion.path
        d={route.drawPathD}
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
          d={route.drawPathD}
          fill="none"
          stroke={color}
          strokeWidth={6}
          opacity={0.18}
          style={{ pointerEvents: 'none' }}
        />
      )}

      {/* ── Endpoint drag handles (shown when selected) ── */}
      {isSelected && (
        <>
          {/* Source handle */}
          <circle
            cx={route.start.x}
            cy={route.start.y}
            r={5}
            fill={color}
            stroke="white"
            strokeWidth={1.5}
            style={{ cursor: draggingHandle === 'source' ? 'grabbing' : 'grab', pointerEvents: 'all' }}
            onMouseDown={(e) => handleEndpointMouseDown(e, 'source')}
          />
          {/* Target handle */}
          <circle
            cx={route.end.x}
            cy={route.end.y}
            r={5}
            fill={color}
            stroke="white"
            strokeWidth={1.5}
            style={{ cursor: draggingHandle === 'target' ? 'grabbing' : 'grab', pointerEvents: 'all' }}
            onMouseDown={(e) => handleEndpointMouseDown(e, 'target')}
          />
        </>
      )}

      {/* ── Multiplicity labels ── */}
      {relationship.sourceMultiplicity && (
        <text x={route.sourceMultiplicityPoint.x} y={route.sourceMultiplicityPoint.y} fontSize={10} fill={color} textAnchor="middle"
          fontFamily="Inter, system-ui, sans-serif" style={{ pointerEvents: 'none' }}>
          {relationship.sourceMultiplicity}
        </text>
      )}
      {relationship.targetMultiplicity && (
        <text x={route.targetMultiplicityPoint.x} y={route.targetMultiplicityPoint.y} fontSize={10} fill={color} textAnchor="middle"
          fontFamily="Inter, system-ui, sans-serif" style={{ pointerEvents: 'none' }}>
          {relationship.targetMultiplicity}
        </text>
      )}
    </g>
  );
}
