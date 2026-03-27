import { useContext, useLayoutEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Trash2, GripHorizontal, StickyNote, Zap, Check, X } from 'lucide-react';
import type { UMLElement } from '@/types';
import { useDiagramStore } from '@/store/diagramStore';
import { useUIStore } from '@/store/uiStore';
import { CanvasContext } from './DiagramCanvas';
import { BOX_WIDTH, BOX_HEIGHT, NOTE_MIN_HEIGHT, NOTE_HEADER_HEIGHT, getBoxWidth, getBoxHeight, snapToGrid } from '@/utils/geometry';
import { cn } from '@/lib/utils';

// ── Type styles ──
const BOX_GRADIENT: Record<string, string> = {
  server:   'from-blue-500 to-blue-700',
  database: 'from-emerald-500 to-emerald-700',
  service:  'from-violet-500 to-violet-700',
  object:   'from-orange-500 to-orange-700',
  yes:      'from-green-500 to-green-700',
  no:       'from-rose-500 to-rose-700',
};



// ── Note Box ──────────────────────────────────────────────────
function NoteBox({
  element, isSelected, isConnectSource, onMouseDown, onClick,
}: {
  element: UMLElement;
  isSelected: boolean;
  isConnectSource: boolean;
  onMouseDown: (e: React.MouseEvent) => void;
  onClick: (e: React.MouseEvent) => void;
}) {
  const { updateElement, deleteElement } = useDiagramStore();
  const { selectElement, tool } = useUIStore();
  const noteHeight    = element.noteHeight ?? NOTE_MIN_HEIGHT;
  const textAreaH     = noteHeight - NOTE_HEADER_HEIGHT - 12;

  const handleResize = (e: React.MouseEvent) => {
    e.stopPropagation();
    const startY = e.clientY, startH = noteHeight;
    const onMove = (ev: MouseEvent) =>
      updateElement(element.id, { noteHeight: Math.max(NOTE_MIN_HEIGHT, startH + ev.clientY - startY) });
    const onUp = () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  const ring = isSelected || isConnectSource
    ? 'ring-2 ring-amber-400 ring-offset-1'
    : tool === 'connect' ? 'hover:ring-2 hover:ring-amber-300 hover:ring-offset-1' : '';

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.85 }}
      transition={{ type: 'spring', stiffness: 400, damping: 28 }}
      style={{ position: 'absolute', left: element.x, top: element.y, width: BOX_WIDTH, height: noteHeight,
               cursor: tool === 'connect' ? 'crosshair' : 'default',
               zIndex: isSelected ? 30 : 20, userSelect: 'none', pointerEvents: 'auto',
               display: 'flex', flexDirection: 'column' }}
      className={cn('rounded-xl shadow-md border border-yellow-300 dark:border-yellow-700 bg-yellow-50 dark:bg-yellow-950/40 overflow-hidden', ring)}
      onClick={onClick}
    >
      <div onMouseDown={onMouseDown}
        className="flex items-center gap-1.5 px-2 bg-yellow-200 dark:bg-yellow-900/60 border-b border-yellow-300 dark:border-yellow-700 flex-shrink-0"
        style={{ height: NOTE_HEADER_HEIGHT, cursor: tool === 'connect' ? 'crosshair' : 'grab' }}>
        <StickyNote size={12} className="text-yellow-600 dark:text-yellow-400 flex-shrink-0" />
        <span className="flex-1 text-[11px] font-medium text-yellow-800 dark:text-yellow-300 select-none">Note</span>
        {isSelected && (
          <button className="text-yellow-600 dark:text-yellow-400 hover:text-rose-500 transition-colors"
            onClick={(e) => { e.stopPropagation(); deleteElement(element.id); selectElement(null); }}>
            <Trash2 size={11} />
          </button>
        )}
      </div>
      <textarea value={element.content ?? ''} placeholder="Write notes…"
        onClick={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()}
        onChange={(e) => updateElement(element.id, { content: e.target.value })}
        className="flex-1 w-full resize-none bg-transparent text-sm text-yellow-900 dark:text-yellow-100 placeholder-yellow-400/70 dark:placeholder-yellow-700 outline-none px-3 py-2 leading-relaxed scrollbar-hide"
        style={{ height: textAreaH }} />
      <div onMouseDown={handleResize}
        className="flex items-center justify-center h-3 cursor-s-resize text-yellow-300 dark:text-yellow-800 hover:text-yellow-500 transition-colors flex-shrink-0">
        <GripHorizontal size={12} />
      </div>
      {isConnectSource && (
        <div className="absolute inset-0 rounded-xl border-2 border-amber-400 pointer-events-none">
          <div className="absolute top-1 right-1 bg-amber-400 rounded-full p-0.5"><Zap size={10} className="text-white" /></div>
        </div>
      )}
    </motion.div>
  );
}

// ── Plain Text Box ───────────────────────────────────────────
function TextBox({
  element,
  isSelected,
  isConnectSource,
  onMouseDown,
  onClick,
}: {
  element: UMLElement;
  isSelected: boolean;
  isConnectSource: boolean;
  onMouseDown: (e: React.MouseEvent) => void;
  onClick: (e: React.MouseEvent) => void;
}) {
  const { updateElement } = useDiagramStore();
  const { tool } = useUIStore();
  const { zoom } = useContext(CanvasContext);
  const fontSize = Math.max(10, element.fontSize ?? 24);
  const textAlign = element.textAlign ?? 'left';
  const [hovered, setHovered] = useState(false);
  const [resizing, setResizing] = useState(false);
  const [editing, setEditing] = useState(false);
  const textRef = useRef<HTMLDivElement>(null);

  const ring = isConnectSource
    ? 'outline outline-2 outline-amber-400'
    : isSelected
    ? 'outline outline-1 outline-blue-400/80'
    : (tool === 'connect' || tool === 'dashed_connect') ? 'hover:outline hover:outline-1 hover:outline-blue-300/70' : '';

  // Keep the element hitbox aligned with the rendered text size (for selection, drag, and relationships).
  useLayoutEffect(() => {
    const n = textRef.current;
    if (!n) return;
    const nextW = Math.max(16, Math.ceil(n.offsetWidth));
    const nextH = Math.max(16, Math.ceil(n.offsetHeight));
    const prevW = Math.ceil(element.boxWidth ?? 0);
    const prevH = Math.ceil(element.boxHeight ?? 0);
    if (nextW !== prevW || nextH !== prevH) {
      updateElement(element.id, { boxWidth: nextW, boxHeight: nextH });
    }
  }, [element.id, element.boxWidth, element.boxHeight, element.content, element.fontSize, editing, updateElement]);

  const handleFontResize = (e: React.MouseEvent) => {
    e.stopPropagation();
    const startX = e.clientX;
    const startY = e.clientY;
    const startSize = fontSize;
    setResizing(true);

    const onMove = (ev: MouseEvent) => {
      const dx = (ev.clientX - startX) / zoom;
      const dy = (ev.clientY - startY) / zoom;
      const delta = (dx + dy) / 2;
      updateElement(element.id, { fontSize: Math.max(10, Math.min(120, startSize + delta)) });
    };
    const onUp = () => {
      setResizing(false);
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.85 }}
      transition={{ type: 'spring', stiffness: 400, damping: 28 }}
      style={{
        position: 'absolute',
        left: element.x,
        top: element.y,
        cursor: (tool === 'connect' || tool === 'dashed_connect') ? 'crosshair' : 'grab',
        zIndex: isSelected ? 30 : 20,
        userSelect: 'none',
        pointerEvents: 'auto',
      }}
      className={cn('overflow-visible inline-block', ring)}
      onMouseDown={onMouseDown}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {editing ? (
        <textarea
          autoFocus
          value={element.content ?? ''}
          placeholder="Type text..."
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          onBlur={() => setEditing(false)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              setEditing(false);
              e.currentTarget.blur();
            }
            e.stopPropagation();
          }}
          onChange={(e) => updateElement(element.id, { content: e.target.value })}
          style={{ fontSize, textAlign }}
          className="min-w-[24px] min-h-[24px] resize-none overflow-hidden bg-transparent text-slate-700 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 outline-none px-1 py-0.5 leading-relaxed"
        />
      ) : (
        <div
          ref={textRef}
          onDoubleClick={(e) => {
            e.stopPropagation();
            setEditing(true);
          }}
          className="px-1 py-0.5 whitespace-pre-wrap break-words text-slate-700 dark:text-slate-200"
          style={{ fontSize, lineHeight: 1.25, textAlign }}
          title="Double-click to edit text"
        >
          {(element.content && element.content.length > 0) ? element.content : 'Text'}
        </div>
      )}

      {(hovered || resizing) && (
        <div
          onMouseDown={handleFontResize}
          className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize bg-slate-300/60 dark:bg-slate-600/70 hover:bg-slate-400/70 dark:hover:bg-slate-500/80 transition-colors rounded-tl-md"
          title="Drag to resize text"
        />
      )}

      {isConnectSource && (
        <div className="absolute inset-0 rounded-lg border-2 border-amber-400 pointer-events-none">
          <div className="absolute top-1 right-1 bg-amber-400 rounded-full p-0.5"><Zap size={10} className="text-white" /></div>
        </div>
      )}
    </motion.div>
  );
}

// ── Main UML Box ───────────────────────────────────────────────
interface UMLBoxProps { element: UMLElement }

export function UMLBox({ element }: UMLBoxProps) {
  const { updateElement, deleteElement, addRelationship, updateRelationship } = useDiagramStore();
  const { selectedElementId, selectedElementIds, selectElement, tool, connectSourceId, setConnectSource, pendingRelType, snapToGrid: snapEnabled } = useUIStore();
  const { zoom } = useContext(CanvasContext);
  const suppressNextClickRef = useRef(false);
  const dragMovedRef = useRef(false);

  const isSelected      = selectedElementId === element.id || selectedElementIds.includes(element.id);
  const isConnectSource = connectSourceId   === element.id;

  const [editingName, setEditingName] = useState(false);
  const [nameValue,   setNameValue]   = useState(element.name);

  // ── Drag ──
  const handleMouseDown = (e: React.MouseEvent) => {
    if (tool === 'connect' || tool === 'dashed_connect' || e.button !== 0) return;
    e.stopPropagation();
    const sx = e.clientX;
    const sy = e.clientY;
    dragMovedRef.current = false;

    // If the dragged box is part of current multi-selection, move the entire selection together.
    const moveIds = selectedElementIds.includes(element.id) ? selectedElementIds : [element.id];
    const snapshot = new Map(
      useDiagramStore
        .getState()
        .elements
        .filter((el) => moveIds.includes(el.id))
        .map((el) => [el.id, { x: el.x, y: el.y }])
    );

    const onMove = (ev: MouseEvent) => {
      if (!dragMovedRef.current) {
        const moved = Math.abs(ev.clientX - sx) > 3 || Math.abs(ev.clientY - sy) > 3;
        if (moved) dragMovedRef.current = true;
      }
      const dx = (ev.clientX - sx) / zoom;
      const dy = (ev.clientY - sy) / zoom;
      moveIds.forEach((id) => {
        const origin = snapshot.get(id);
        if (!origin) return;
        const nextX = origin.x + dx;
        const nextY = origin.y + dy;
        updateElement(id, {
          x: snapEnabled ? snapToGrid(nextX) : nextX,
          y: snapEnabled ? snapToGrid(nextY) : nextY,
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
      if (!connectSourceId)                    { setConnectSource(element.id); }
      else if (connectSourceId !== element.id) { 
        const relId = addRelationship(connectSourceId, element.id, pendingRelType);
        if (relId && tool === 'dashed_connect') {
          updateRelationship(relId, { isDashed: true });
        }
        setConnectSource(null);
      }
    } else {
      selectElement(isSelected ? null : element.id);
    }
  };

  // ── Resize (bottom-right corner) ──
  const handleResize = (e: React.MouseEvent) => {
    if (element.type === 'note') return; // notes have their own resize
    e.stopPropagation();
    const startX = e.clientX, startY = e.clientY;
    const startW = getBoxWidth(element), startH = getBoxHeight(element);
    const MIN_SIZE = 60;
    const onMove = (ev: MouseEvent) => {
      const newW = Math.max(MIN_SIZE, startW + (ev.clientX - startX) / zoom);
      const newH = Math.max(MIN_SIZE, startH + (ev.clientY - startY) / zoom);
      updateElement(element.id, { boxWidth: newW, boxHeight: newH });
    };
    const onUp = () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  // ── Note ──
  if (element.type === 'note') {
    return <NoteBox element={element} isSelected={isSelected} isConnectSource={isConnectSource}
      onMouseDown={handleMouseDown} onClick={handleClick} />;
  }

  // ── Plain text ──
  if (element.type === 'text') {
    return (
      <TextBox
        element={element}
        isSelected={isSelected}
        isConnectSource={isConnectSource}
        onMouseDown={handleMouseDown}
        onClick={handleClick}
      />
    );
  }

  // ── Regular architecture boxes + condition / yes / no ──
  const gradient = BOX_GRADIENT[element.type] ?? BOX_GRADIENT.server;
  const boxW = getBoxWidth(element);
  const boxH = getBoxHeight(element);
  const isCondition = element.type === 'condition';
  const isYesNo = element.type === 'yes' || element.type === 'no';

  const ring = isSelected
    ? (isCondition
      ? 'ring-2 ring-blue-400/70 ring-offset-1 ring-offset-transparent'
      : 'ring-2 ring-white/60 ring-offset-2 ring-offset-transparent')
    : isConnectSource ? 'ring-2 ring-amber-400 ring-offset-1'
    : (tool === 'connect' || tool === 'dashed_connect')
      ? (isCondition ? 'hover:ring-2 hover:ring-blue-300/60 hover:ring-offset-1' : 'hover:ring-2 hover:ring-white/40 hover:ring-offset-1')
      : '';

  const boxStyle: React.CSSProperties = {
    position: 'absolute',
    left: element.x,
    top: element.y,
    width: boxW,
    height: boxH,
    cursor: (tool === 'connect' || tool === 'dashed_connect') ? 'crosshair' : 'grab',
    zIndex: isSelected ? 30 : 20,
    userSelect: 'none',
    pointerEvents: 'auto',
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.85 }}
      transition={{ type: 'spring', stiffness: 400, damping: 28 }}
      style={boxStyle}
      className={cn(
        'shadow-lg overflow-hidden select-none',
        isCondition ? 'rounded-xl bg-white border-2 border-slate-300 dark:border-slate-500' : 'rounded-xl bg-gradient-to-br',
        !isCondition && gradient,
        ring,
      )}
      onMouseDown={handleMouseDown}
      onClick={handleClick}
    >
      {/* Content */}
      <div className="flex items-center justify-center h-full px-4">
        {editingName ? (
          <input
            autoFocus
            value={nameValue}
            className={cn(
              'text-sm font-bold text-center rounded px-2 py-0.5 outline-none w-full',
              isCondition
                ? 'bg-slate-100 text-slate-800 border border-slate-300'
                : 'bg-white/20 text-white'
            )}
            onChange={(e) => setNameValue(e.target.value)}
            onBlur={() => { setEditingName(false); if (nameValue.trim()) updateElement(element.id, { name: nameValue.trim() }); }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
              if (e.key === 'Escape') { setNameValue(element.name); setEditingName(false); }
              e.stopPropagation();
            }}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <div
            className={cn(
              'font-bold text-sm text-center leading-snug px-1 cursor-text select-none',
              isCondition ? 'text-slate-700 dark:text-slate-200' : 'text-white'
            )}
            onDoubleClick={(e) => {
              if (isYesNo) return;
              e.stopPropagation();
              setNameValue(element.name);
              setEditingName(true);
            }}
            title="Double-click to rename"
          >
            {isYesNo ? (
              <span className="inline-flex items-center justify-center align-middle">
                {element.type === 'yes' ? <Check size={20} strokeWidth={3} /> : <X size={20} strokeWidth={3} />}
              </span>
            ) : (
              <span>{element.name}</span>
            )}
          </div>
        )}
      </div>


      {/* Resize handle (bottom-right, visible when selected) */}
      {isSelected && (
        <div
          onMouseDown={handleResize}
          className={cn(
            'absolute bottom-0 right-0 w-4 h-4 cursor-se-resize transition-colors',
            isCondition
              ? 'bg-slate-200/80 hover:bg-slate-300/90 rounded-tl-sm'
              : 'bg-white/20 hover:bg-white/40 rounded-tl-lg'
          )}
          title="Drag to resize"
        />
      )}

      {/* Connect-source indicator */}
      {isConnectSource && (
        <div className="absolute inset-0 rounded-xl border-2 border-amber-400 pointer-events-none">
          <div className="absolute top-1 right-1 bg-amber-400 rounded-full p-0.5"><Zap size={10} className="text-white" /></div>
        </div>
      )}
    </motion.div>
  );
}
