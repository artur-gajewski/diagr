import { createContext, useRef, useCallback, useEffect, useState, useMemo } from 'react';
import { AnimatePresence } from 'framer-motion';
import { useDiagramStore } from '@/store/diagramStore';
import { useUIStore } from '@/store/uiStore';
import { getBoxRect } from '@/utils/geometry';
import { UMLBox } from './UMLBox';
import { RelationshipArrow } from './RelationshipArrow';
import { SvgDefs } from './SvgDefs';

// ────────── Canvas context ──────────
interface CanvasContextValue { zoom: number }
export const CanvasContext = createContext<CanvasContextValue>({ zoom: 1 });

const CANVAS_SIZE = 5000;
const MIN_ZOOM = 0.2;
const MAX_ZOOM = 3;

export function DiagramCanvas({ canvasRef }: { canvasRef: React.RefObject<HTMLDivElement | null> }) {
  const elements      = useDiagramStore((s) => s.elements);
  const relationships = useDiagramStore((s) => s.relationships);

  const { tool, selectElement, setSelectedElements, selectRelationship, setConnectSource, setTool,
          zoom, panX, panY, setZoom, setPan } = useUIStore();

  const isPanning   = useRef(false);
  const panStart    = useRef({ x: 0, y: 0 });
  const panOrigin   = useRef({ x: 0, y: 0 });
  const isMarqueeSelecting = useRef(false);
  const marqueeStart = useRef({ x: 0, y: 0 });
  const marqueeRectRef = useRef<{ x: number; y: number; w: number; h: number } | null>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const toolBeforeSpace = useRef<typeof tool | null>(null);
  const [marqueeRect, setMarqueeRect] = useState<{ x: number; y: number; w: number; h: number } | null>(null);

  const relationshipRouteMeta = useMemo(() => {
    const byPair = new Map<string, string[]>();
    relationships.forEach((r) => {
      const [a, b] = [r.sourceId, r.targetId].sort((x, y) => x.localeCompare(y));
      const key = `${a}::${b}`;
      const ids = byPair.get(key);
      if (ids) ids.push(r.id);
      else byPair.set(key, [r.id]);
    });

    const meta = new Map<string, { routeIndex: number; routeCount: number }>();
    byPair.forEach((ids) => {
      ids.forEach((id, idx) => {
        meta.set(id, { routeIndex: idx, routeCount: ids.length });
      });
    });

    return meta;
  }, [relationships]);

  // ── Spacebar → temporary pan mode ──
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code !== 'Space') return;
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.target instanceof HTMLElement && e.target.isContentEditable) return;
      if (toolBeforeSpace.current !== null) return;
      e.preventDefault();
      toolBeforeSpace.current = useUIStore.getState().tool;
      setTool('pan');
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code !== 'Space') return;
      if (toolBeforeSpace.current === null) return;
      // Prevent Space keyup from activating a previously focused toolbar button.
      e.preventDefault();
      setTool(toolBeforeSpace.current);
      toolBeforeSpace.current = null;
      isPanning.current = false;
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup',   onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup',   onKeyUp);
    };
  }, [setTool]);

  // ── Zoom via wheel (zoom toward cursor) ──
  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();
    const vp = viewportRef.current;
    if (!vp) return;
    const rect  = vp.getBoundingClientRect();
    const mx    = e.clientX - rect.left;
    const my    = e.clientY - rect.top;
    const { zoom: z, panX: px, panY: py } = useUIStore.getState();
    // Use a smooth exponential curve and reduce sensitivity for pinch gestures.
    const sensitivity = e.ctrlKey ? 0.0050 : 0.0032;
    const delta = Math.exp(-e.deltaY * sensitivity);
    const newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z * delta));
    const scale   = newZoom / z;
    setZoom(newZoom);
    setPan(mx - scale * (mx - px), my - scale * (my - py));
  }, [setZoom, setPan]);

  useEffect(() => {
    const vp = viewportRef.current;
    if (!vp) return;
    vp.addEventListener('wheel', handleWheel, { passive: false });
    return () => vp.removeEventListener('wheel', handleWheel);
  }, [handleWheel]);


  const toCanvasPoint = useCallback((clientX: number, clientY: number) => {
    const vp = viewportRef.current;
    if (!vp) return null;
    const rect = vp.getBoundingClientRect();
    return {
      x: (clientX - rect.left - useUIStore.getState().panX) / useUIStore.getState().zoom,
      y: (clientY - rect.top - useUIStore.getState().panY) / useUIStore.getState().zoom,
    };
  }, []);

  const rectsIntersect = useCallback(
    (a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; width: number; height: number }) =>
      a.x <= b.x + b.width && a.x + a.w >= b.x && a.y <= b.y + b.height && a.y + a.h >= b.y,
    []
  );

  // ── Pan via middle-mouse or pan tool ──
  const handleViewportMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 1 || tool === 'pan') {
      e.preventDefault();
      isPanning.current = true;
      panStart.current  = { x: e.clientX, y: e.clientY };
      panOrigin.current = { x: useUIStore.getState().panX, y: useUIStore.getState().panY };
      return;
    }
    // Start marquee anywhere in the viewport in select mode;
    // element/relationship interactions already stop propagation.
    if (e.button === 0 && tool === 'select') {
      const start = toCanvasPoint(e.clientX, e.clientY);
      if (!start) return;
      isMarqueeSelecting.current = true;
      marqueeStart.current = start;
      const initialRect = { x: start.x, y: start.y, w: 0, h: 0 };
      marqueeRectRef.current = initialRect;
      setMarqueeRect(initialRect);
      setConnectSource(null);
      selectRelationship(null);
      return;
    }

    const hitBackground =
      e.target === viewportRef.current ||
      e.target === canvasRef.current ||
      e.target instanceof SVGSVGElement;

    if (e.button === 0) {
      // Only clear selection/connect source on true canvas background clicks.
      if (hitBackground) {
        selectElement(null);
        selectRelationship(null);
        setConnectSource(null);
      }
    }
  }, [tool, canvasRef, toCanvasPoint, selectElement, selectRelationship, setConnectSource]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isMarqueeSelecting.current) {
      const curr = toCanvasPoint(e.clientX, e.clientY);
      if (!curr) return;
      const sx = marqueeStart.current.x;
      const sy = marqueeStart.current.y;
      const nextRect = {
        x: Math.min(sx, curr.x),
        y: Math.min(sy, curr.y),
        w: Math.abs(curr.x - sx),
        h: Math.abs(curr.y - sy),
      };
      marqueeRectRef.current = nextRect;
      setMarqueeRect(nextRect);
      return;
    }
    if (!isPanning.current) return;
    setPan(
      panOrigin.current.x + e.clientX - panStart.current.x,
      panOrigin.current.y + e.clientY - panStart.current.y,
    );
  }, [setPan, toCanvasPoint]);

  const handleMouseUp = useCallback((e?: React.MouseEvent) => {
    if (isMarqueeSelecting.current) {
      let rect = marqueeRectRef.current;
      // Finalize rect using the actual mouse-up position to avoid missing the last drag delta.
      if (e) {
        const end = toCanvasPoint(e.clientX, e.clientY);
        if (end) {
          const sx = marqueeStart.current.x;
          const sy = marqueeStart.current.y;
          rect = {
            x: Math.min(sx, end.x),
            y: Math.min(sy, end.y),
            w: Math.abs(end.x - sx),
            h: Math.abs(end.y - sy),
          };
        }
      }
      const smallDrag = !rect || (rect.w < 4 && rect.h < 4);
      if (smallDrag) {
        setSelectedElements([]);
      } else if (rect) {
        const hitIds = elements
          .filter((el) => rectsIntersect(rect, getBoxRect(el)))
          .map((el) => el.id);
        setSelectedElements(hitIds);
      }
      isMarqueeSelecting.current = false;
      marqueeRectRef.current = null;
      setMarqueeRect(null);
    }
    isPanning.current = false;
  }, [elements, rectsIntersect, selectRelationship, setSelectedElements, toCanvasPoint]);

  const isDark = typeof document !== 'undefined' &&
    document.documentElement.classList.contains('dark');

  return (
    <CanvasContext.Provider value={{ zoom }}>
      <div
        ref={viewportRef}
        className="absolute inset-0 overflow-hidden select-none"
        style={{ cursor: isPanning.current ? 'grabbing' : tool === 'pan' ? 'grab' : tool === 'connect' ? 'crosshair' : 'default' }}
        onMouseDown={handleViewportMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {/* Transformed canvas */}
        <div
          ref={canvasRef as React.RefObject<HTMLDivElement>}
          style={{
            position: 'absolute',
            width: CANVAS_SIZE,
            height: CANVAS_SIZE,
            transformOrigin: '0 0',
            transform: `translate(${panX}px, ${panY}px) scale(${zoom})`,
          }}
          className="canvas-dots bg-canvas-light dark:bg-canvas-dark"
        >
          {/* SVG layer for relationships */}
          <svg style={{ position: 'absolute', inset: 0, width: CANVAS_SIZE, height: CANVAS_SIZE,
                        zIndex: 10, color: isDark ? '#94a3b8' : '#475569', overflow: 'visible' }}>
            <SvgDefs />
            {relationships.map((r) => (
              <RelationshipArrow
                key={r.id}
                relationship={r}
                elements={elements}
                routeIndex={relationshipRouteMeta.get(r.id)?.routeIndex ?? 0}
                routeCount={relationshipRouteMeta.get(r.id)?.routeCount ?? 1}
              />
            ))}
          </svg>

          {/* UML boxes */}
          <div style={{ position: 'absolute', inset: 0, zIndex: 20, pointerEvents: 'none' }}>
            <AnimatePresence>
              {elements.map((el) => (
                <UMLBox key={el.id} element={el} />
              ))}
            </AnimatePresence>
          </div>

          {/* Marquee selection overlay */}
          {marqueeRect && (
            <div
              style={{
                position: 'absolute',
                left: marqueeRect.x,
                top: marqueeRect.y,
                width: marqueeRect.w,
                height: marqueeRect.h,
                zIndex: 40,
                pointerEvents: 'none',
                border: '1px solid rgba(59, 130, 246, 0.9)',
                background: 'rgba(59, 130, 246, 0.12)',
              }}
            />
          )}
        </div>

        {/* Zoom indicator */}
        <div className="absolute bottom-4 right-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-full px-3 py-1 text-xs font-mono text-slate-500 dark:text-slate-400 shadow">
          {Math.round(zoom * 100)}%
        </div>
      </div>
    </CanvasContext.Provider>
  );
}

