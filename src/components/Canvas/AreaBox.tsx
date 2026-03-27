import { useContext, useRef } from 'react';
import { motion } from 'framer-motion';
import { Trash2 } from 'lucide-react';
import type { UMLElement } from '@/types';
import { useDiagramStore } from '@/store/diagramStore';
import { useUIStore } from '@/store/uiStore';
import { CanvasContext } from './DiagramCanvas';
import { snapToGrid as snapFn } from '@/utils/geometry';

const DEFAULT_COLOR = '#1e3a5f';

function hexToRgba(hex: string, alpha: number): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return `rgba(30,58,95,${alpha})`;
  return `rgba(${parseInt(result[1], 16)},${parseInt(result[2], 16)},${parseInt(result[3], 16)},${alpha})`;
}

interface AreaBoxProps {
  element: UMLElement;
}

export function AreaBox({ element }: AreaBoxProps) {
  const { updateElement, deleteElement } = useDiagramStore();
  const {
    selectedElementId,
    selectedElementIds,
    selectElement,
    tool,
    snapToGrid: snapEnabled,
  } = useUIStore();
  const { zoom } = useContext(CanvasContext);

  const suppressNextClickRef = useRef(false);
  const dragMovedRef = useRef(false);

  const isSelected =
    selectedElementId === element.id || selectedElementIds.includes(element.id);

  const color = element.color ?? DEFAULT_COLOR;
  const boxW = element.boxWidth ?? 320;
  const boxH = element.boxHeight ?? 220;

  // ── Drag ──
  const handleMouseDown = (e: React.MouseEvent) => {
    if (tool === 'connect' || tool === 'dashed_connect' || e.button !== 0) return;
    e.stopPropagation();
    const sx = e.clientX;
    const sy = e.clientY;
    dragMovedRef.current = false;
    const origX = element.x;
    const origY = element.y;

    const onMove = (ev: MouseEvent) => {
      if (!dragMovedRef.current) {
        if (Math.abs(ev.clientX - sx) > 3 || Math.abs(ev.clientY - sy) > 3) {
          dragMovedRef.current = true;
        }
      }
      const dx = (ev.clientX - sx) / zoom;
      const dy = (ev.clientY - sy) / zoom;
      const nextX = origX + dx;
      const nextY = origY + dy;
      updateElement(element.id, {
        x: snapEnabled ? snapFn(nextX) : nextX,
        y: snapEnabled ? snapFn(nextY) : nextY,
      });
    };
    const onUp = () => {
      if (dragMovedRef.current) suppressNextClickRef.current = true;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  // ── Click (select) ──
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (suppressNextClickRef.current) {
      suppressNextClickRef.current = false;
      return;
    }
    selectElement(isSelected ? null : element.id);
  };

  // ── Resize (bottom-right corner) ──
  const handleResize = (e: React.MouseEvent) => {
    e.stopPropagation();
    const startX = e.clientX;
    const startY = e.clientY;
    const startW = boxW;
    const startH = boxH;
    const MIN = 80;
    const onMove = (ev: MouseEvent) => {
      const rawW = Math.max(MIN, startW + (ev.clientX - startX) / zoom);
      const rawH = Math.max(MIN, startH + (ev.clientY - startY) / zoom);
      updateElement(element.id, {
        boxWidth:  snapEnabled ? Math.max(MIN, snapFn(rawW)) : rawW,
        boxHeight: snapEnabled ? Math.max(MIN, snapFn(rawH)) : rawH,
      });
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{ type: 'spring', stiffness: 300, damping: 28 }}
      style={{
        position: 'absolute',
        left: element.x,
        top: element.y,
        width: boxW,
        height: boxH,
        cursor:
          tool === 'connect' || tool === 'dashed_connect' ? 'crosshair' : 'grab',
        userSelect: 'none',
        pointerEvents: 'auto',
        borderRadius: 12,
        border: `2px dashed ${color}`,
        background: hexToRgba(color, 0.06),
        boxSizing: 'border-box',
        outline: isSelected ? `2px solid ${color}` : 'none',
        outlineOffset: 3,
      }}
      onMouseDown={handleMouseDown}
      onClick={handleClick}
    >
      {/* Label */}
      <div
        style={{
          position: 'absolute',
          top: 7,
          left: 12,
          color,
          fontSize: 12,
          fontWeight: 700,
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
          opacity: 0.85,
          pointerEvents: 'none',
          userSelect: 'none',
        }}
      >
        {element.name}
      </div>

      {/* Delete button (visible when selected) */}
      {isSelected && (
        <button
          style={{ position: 'absolute', top: 4, right: 4 }}
          className="text-slate-400 hover:text-rose-500 transition-colors p-1 rounded"
          onClick={(e) => {
            e.stopPropagation();
            deleteElement(element.id);
            selectElement(null);
          }}
          title="Delete area"
        >
          <Trash2 size={12} />
        </button>
      )}

      {/* Resize handle (bottom-right, visible when selected) */}
      {isSelected && (
        <div
          onMouseDown={handleResize}
          style={{
            position: 'absolute',
            bottom: 0,
            right: 0,
            width: 18,
            height: 18,
            cursor: 'se-resize',
            borderRadius: '4px 0 10px 0',
            background: color,
            opacity: 0.35,
          }}
          title="Drag to resize"
        />
      )}
    </motion.div>
  );
}

