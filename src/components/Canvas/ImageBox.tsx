import { useContext, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Trash2, Zap } from 'lucide-react';
import type { UMLElement } from '@/types';
import { useDiagramStore } from '@/store/diagramStore';
import { useUIStore } from '@/store/uiStore';
import { CanvasContext } from './DiagramCanvas';
import { snapToGrid as snapFn } from '@/utils/geometry';

interface ImageBoxProps {
  element: UMLElement;
}

export function ImageBox({ element }: ImageBoxProps) {
  const { updateElement, deleteElement, addRelationship, updateRelationship } = useDiagramStore();
  const {
    selectedElementId,
    selectedElementIds,
    selectElement,
    setModifierSelectedElements,
    tool,
    connectSourceId,
    setConnectSource,
    pendingRelType,
    defaultRelationshipRoutingMode,
    snapToGrid: snapEnabled,
    requireDeleteConfirmation,
    requestDeleteConfirm,
  } = useUIStore();
  const { zoom } = useContext(CanvasContext);
  const [aspectRatio, setAspectRatio] = useState<number | null>(null);

  const suppressNextClickRef = useRef(false);
  const dragMovedRef = useRef(false);
  const ctrlSelectionWasInRef = useRef(false);

  const isSelected =
    selectedElementId === element.id || selectedElementIds.includes(element.id);
  const isConnectSource = connectSourceId === element.id;

  const boxW = element.boxWidth ?? 200;
  const boxH = element.boxHeight ?? 200;

  // Handle image load to extract aspect ratio
  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    if (img.naturalWidth && img.naturalHeight) {
      const ratio = img.naturalWidth / img.naturalHeight;
      setAspectRatio(ratio);
      
      // Update the element's dimensions to match the image's aspect ratio
      // Keep the current width and adjust height accordingly
      const currentW = boxW;
      const newH = currentW / ratio;
      
      // Only update if the height actually changed
      if (Math.abs(newH - boxH) > 0.1) {
        updateElement(element.id, { boxHeight: newH });
      }
    }
  };

  // ── Drag ──
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    if (tool === 'pan') {
      suppressNextClickRef.current = true;
      return;
    }
    if (tool === 'connect' || tool === 'dashed_connect') return;
    suppressNextClickRef.current = false;
    e.stopPropagation();

    // ── Ctrl/Cmd+click: add to multi-selection ──
    if (e.ctrlKey || e.metaKey) {
      const currentIds = useUIStore.getState().selectedElementIds;
      ctrlSelectionWasInRef.current = currentIds.includes(element.id);
      if (!ctrlSelectionWasInRef.current) {
        setModifierSelectedElements([...currentIds, element.id]);
      }
    }

    const sx = e.clientX;
    const sy = e.clientY;
    dragMovedRef.current = false;

    // Use fresh state so Ctrl-updated selection is included in the drag.
    const freshIds = useUIStore.getState().selectedElementIds;
    const moveIds = freshIds.includes(element.id) ? [...freshIds] : [element.id];
    const snapshot = new Map(
      useDiagramStore
        .getState()
        .elements
        .filter((el) => moveIds.includes(el.id))
        .map((el) => [el.id, { x: el.x, y: el.y }])
    );

    const onMove = (ev: MouseEvent) => {
      if (!dragMovedRef.current) {
        if (Math.abs(ev.clientX - sx) > 3 || Math.abs(ev.clientY - sy) > 3) {
          dragMovedRef.current = true;
        }
      }
      const dx = (ev.clientX - sx) / zoom;
      const dy = (ev.clientY - sy) / zoom;
      moveIds.forEach((id) => {
        const origin = snapshot.get(id);
        if (!origin) return;
        const nextX = origin.x + dx;
        const nextY = origin.y + dy;
        updateElement(id, {
          x: snapEnabled ? snapFn(nextX) : nextX,
          y: snapEnabled ? snapFn(nextY) : nextY,
        });
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

  // ── Click (select / connect) ──
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (suppressNextClickRef.current) {
      suppressNextClickRef.current = false;
      return;
    }
    if (tool === 'connect' || tool === 'dashed_connect') {
      if (!connectSourceId) {
        setConnectSource(element.id);
      } else if (connectSourceId !== element.id) {
        const relId = addRelationship(connectSourceId, element.id, pendingRelType);
        if (relId) {
          updateRelationship(relId, {
            routingMode: defaultRelationshipRoutingMode,
            ...(tool === 'dashed_connect' ? { isDashed: true } : {}),
          });
        }
        setConnectSource(null);
      }
    } else if (e.ctrlKey || e.metaKey) {
      // If element was already selected before mousedown → toggle it off
      if (ctrlSelectionWasInRef.current) {
        const currentIds = useUIStore.getState().selectedElementIds;
        setModifierSelectedElements(currentIds.filter((id) => id !== element.id));
      }
      ctrlSelectionWasInRef.current = false;
    } else {
      selectElement(isSelected ? null : element.id);
    }
  };

  // ── Resize (bottom-right corner) with aspect ratio lock ──
  const handleResize = (e: React.MouseEvent) => {
    e.stopPropagation();
    const startX = e.clientX;
    const startY = e.clientY;
    const startW = boxW;
    const startH = boxH;
    const MIN = 40;
    const ratio = aspectRatio || 1; // Default to square if no aspect ratio yet

    const onMove = (ev: MouseEvent) => {
      const rawDeltaX = (ev.clientX - startX) / zoom;
      const rawDeltaY = (ev.clientY - startY) / zoom;

      // Resize based on the larger delta, maintaining aspect ratio
      let newW = startW + rawDeltaX;
      let newH = startH + rawDeltaY;

      // If aspect ratio is locked, prefer the horizontal delta and adjust height
      if (aspectRatio && Math.abs(rawDeltaX) > Math.abs(rawDeltaY)) {
        newW = Math.max(MIN, startW + rawDeltaX);
        newH = newW / ratio;
      } else if (aspectRatio) {
        newH = Math.max(MIN, startH + rawDeltaY);
        newW = newH * ratio;
      } else {
        newW = Math.max(MIN, newW);
        newH = Math.max(MIN, newH);
      }

      const finalW = snapEnabled ? Math.max(MIN, snapFn(newW)) : newW;
      const finalH = snapEnabled ? Math.max(MIN, snapFn(newH)) : newH;

      updateElement(element.id, {
        boxWidth: finalW,
        boxHeight: finalH,
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
      initial={{ opacity: 0, scale: 0.85 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.85 }}
      transition={{ type: 'spring', stiffness: 400, damping: 28 }}
      style={{
        position: 'absolute',
        left: element.x,
        top: element.y,
        width: boxW,
        height: boxH,
        cursor: tool === 'connect' || tool === 'dashed_connect' ? 'crosshair' : 'grab',
        zIndex: isSelected ? 30 : 20,
        userSelect: 'none',
        pointerEvents: 'auto',
        borderRadius: 12,
        overflow: 'hidden',
        outline: isSelected
          ? '3px solid rgba(56, 189, 248, 0.85)'
          : 'none',
        outlineOffset: 3,
        boxShadow: isSelected
          ? '0 0 0 7px rgba(56, 189, 248, 0.16), 0 14px 30px rgba(15, 23, 42, 0.12)'
          : 'none',
      }}
      onMouseDown={handleMouseDown}
      onClick={handleClick}
    >
      {/* Image content */}
      {element.imageData ? (
        <img
          src={element.imageData}
          alt={element.name}
          onLoad={handleImageLoad}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'contain',
            pointerEvents: 'none',
          }}
        />
      ) : (
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#f1f5f9',
            color: '#94a3b8',
            fontSize: 12,
            textAlign: 'center',
            padding: 8,
            pointerEvents: 'none',
          }}
        >
          No image
        </div>
      )}

      {isConnectSource && (
        <div className="absolute inset-0 rounded-xl border-2 border-amber-400 pointer-events-none">
          <div className="absolute top-1 right-1 bg-amber-400 rounded-full p-0.5"><Zap size={10} className="text-white" /></div>
        </div>
      )}

      {/* Delete button (visible when selected) */}
      {isSelected && (
        <button
          style={{ position: 'absolute', top: 4, right: 4, zIndex: 10 }}
          className="text-slate-400 hover:text-rose-500 transition-colors p-1 rounded bg-white/80 dark:bg-slate-900/80"
          onClick={(e) => {
            e.stopPropagation();
            const action = {
              title: 'Delete Image?',
              description: 'This will permanently remove this image from the canvas.',
              confirmLabel: 'Delete Image',
              onConfirm: () => {
                deleteElement(element.id);
                selectElement(null);
              },
            };
            if (requireDeleteConfirmation) requestDeleteConfirm(action);
            else action.onConfirm();
          }}
          title="Delete image"
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
            background: 'rgba(56, 189, 248, 0.6)',
            zIndex: 10,
          }}
          title="Drag to resize"
        />
      )}
    </motion.div>
  );
}

