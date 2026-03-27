import { useRef, useState, useEffect } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Download,
  Upload,
  Sun,
  Moon,
  FileJson,
  FileImage,
  FileType,
  File,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Grid3X3,
  Trash2,
  ChevronDown,
  GitBranch,
  HelpCircle,
} from 'lucide-react';
import { useDiagramStore } from '@/store/diagramStore';
import { useUIStore } from '@/store/uiStore';
import {
  exportPNG,
  exportPDF,
  exportJSON,
  exportSVGGenerated,
  importJSON,
} from '@/utils/export';
import { getBoxRect, bestAnchorPair, getAnchorPoint } from '@/utils/geometry';
import { cn } from '@/lib/utils';

interface TopBarProps {
  canvasRef: React.RefObject<HTMLDivElement | null>;
}

export function TopBar({ canvasRef }: TopBarProps) {
  const { theme, toggleTheme, zoom, panX, panY, setZoom, setPan, resetView, snapToGrid, setSnapToGrid, selectElement, selectRelationship } = useUIStore();
  const { exportDiagram, loadDiagram, clearDiagram } = useDiagramStore();
  const elements = useDiagramStore((s) => s.elements);
  const relationships = useDiagramStore((s) => s.relationships);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [exportFilename, setExportFilename] = useState('diagram');
  const [pendingExportFormat, setPendingExportFormat] = useState<'png' | 'svg' | 'pdf' | 'json' | null>(null);
  const [clearDialogOpen, setClearDialogOpen] = useState(false);
  const [helpDialogOpen, setHelpDialogOpen] = useState(false);
  const [loading, setLoading] = useState<string | null>(null);

  const isDark = theme === 'dark';

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore when typing in an input / textarea
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;

      const key = e.key.toLowerCase();
      if (key === 'h') {
        e.preventDefault();
        setHelpDialogOpen(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);


  const zoomAtViewportCenter = (nextZoomRaw: number) => {
    const nextZoom = Math.min(3, Math.max(0.2, nextZoomRaw));
    if (nextZoom === zoom) return;

    const vp = canvasRef.current?.parentElement;
    const rect = vp?.getBoundingClientRect();
    const cx = (rect?.width ?? window.innerWidth) / 2;
    const cy = (rect?.height ?? window.innerHeight) / 2;
    const scale = nextZoom / zoom;

    setZoom(nextZoom);
    setPan(cx - scale * (cx - panX), cy - scale * (cy - panY));
  };

  const fitToContent = () => {
    if (elements.length === 0) {
      resetView();
      return;
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
    const CTRL_OFFSET = 80;
    const outwardControl = (p: { x: number; y: number }, side: 'top' | 'right' | 'bottom' | 'left') => {
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

    const vp = canvasRef.current?.parentElement;
    const rect = vp?.getBoundingClientRect();
    const vw = rect?.width ?? window.innerWidth;
    const vh = rect?.height ?? window.innerHeight;
    if (vw <= 0 || vh <= 0) return;

    const nextZoom = Math.min(3, Math.max(0.2, Math.min(vw / boundsW, vh / boundsH)));
    const nextPanX = (vw - boundsW * nextZoom) / 2 - boundsMinX * nextZoom;
    const nextPanY = (vh - boundsH * nextZoom) / 2 - boundsMinY * nextZoom;

    setZoom(nextZoom);
    setPan(nextPanX, nextPanY);
  };

  const showExportDialog = (format: 'png' | 'svg' | 'pdf' | 'json') => {
    setPendingExportFormat(format);
    setExportFilename('diagram');
    setExportDialogOpen(true);
    setExportOpen(false);
  };

  const handleExport = async (format: 'png' | 'svg' | 'pdf' | 'json', filename: string) => {
    setLoading(format);
    try {
      if (format === 'json') {
        exportJSON(exportDiagram(), filename);
      } else {
        const canvasEl = canvasRef.current;
        if (!canvasEl) throw new Error('Canvas is not available for export');

        // Clear selection so rings/handles never appear in the exported image.
        selectElement(null);
        selectRelationship(null);
        // Wait two animation frames so React re-renders and the browser paints
        // the de-selected state before we capture the canvas.
        await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));

        if (format === 'svg') await exportSVGGenerated(canvasEl, elements, relationships, filename);
        else if (format === 'png') await exportPNG(canvasEl, elements, relationships, filename);
        else if (format === 'pdf') await exportPDF(canvasEl, elements, relationships, filename);
      }
    } finally {
      setLoading(null);
      setExportDialogOpen(false);
      setPendingExportFormat(null);
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const model = await importJSON(file);
      loadDiagram(model);
    } catch {
      alert('Invalid JSON diagram file.');
    }
    e.target.value = '';
  };

  return (
    <header className="flex items-center gap-3 px-4 py-2 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 z-50 shadow-sm">
      {/* Logo */}
      <div className="flex items-center gap-2 mr-2">
        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center">
          <GitBranch size={14} className="text-white" />
        </div>
        <span className="font-bold text-sm text-slate-800 dark:text-slate-100 tracking-tight">
          Diagr
        </span>
      </div>

      {/* Zoom controls */}
      <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 rounded-lg px-1 py-0.5">
        <IconBtn
          title="Zoom out"
          onClick={() => zoomAtViewportCenter(zoom - 0.1)}
        >
          <ZoomOut size={14} />
        </IconBtn>
        <button
          className="text-xs font-mono text-slate-600 dark:text-slate-400 w-10 text-center"
          onClick={resetView}
          title="Reset zoom"
        >
          {Math.round(zoom * 100)}%
        </button>
        <IconBtn
          title="Zoom in"
          onClick={() => zoomAtViewportCenter(zoom + 0.1)}
        >
          <ZoomIn size={14} />
        </IconBtn>
        <IconBtn title="Fit content" onClick={fitToContent}>
          <Maximize2 size={14} />
        </IconBtn>
      </div>

      {/* Snap toggle */}
      <IconBtn
        title={`Snap to grid: ${snapToGrid ? 'On' : 'Off'}`}
        onClick={() => setSnapToGrid(!snapToGrid)}
        active={snapToGrid}
      >
        <Grid3X3 size={14} />
      </IconBtn>

      <div className="flex-1" />

      {/* Actions */}
      <div className="flex items-center gap-1.5">
        {/* Import JSON */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          className="hidden"
          onChange={handleImport}
        />
        <TopBarBtn
          title="Import JSON"
          icon={<Upload size={14} />}
          onClick={() => fileInputRef.current?.click()}
        >
          Import
        </TopBarBtn>

        {/* Export dropdown */}
        <div className="relative">
          <TopBarBtn
            title="Export"
            icon={<Download size={14} />}
            onClick={() => setExportOpen((o) => !o)}
            active={exportOpen}
            chevron
          >
            Export
          </TopBarBtn>

          <AnimatePresence>
            {exportOpen && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: -4 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: -4 }}
                transition={{ duration: 0.12 }}
                className="absolute right-0 top-full mt-1 w-44 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl overflow-hidden z-50"
              >
                {[
                  { format: 'png' as const, label: 'Export PNG', icon: <FileImage size={14} /> },
                  { format: 'svg' as const, label: 'Export SVG', icon: <FileType size={14} /> },
                  { format: 'pdf' as const, label: 'Export PDF', icon: <File size={14} /> },
                  { format: 'json' as const, label: 'Export JSON', icon: <FileJson size={14} /> },
                ].map(({ format, label, icon }) => (
                  <button
                    key={format}
                    disabled={loading === format}
                    className="flex items-center gap-2.5 w-full px-3 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                    onClick={() => showExportDialog(format)}
                  >
                    <span className="text-slate-400">{icon}</span>
                    {loading === format ? 'Exporting…' : label}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Clear */}
        <IconBtn
          title="Clear diagram"
          onClick={() => setClearDialogOpen(true)}
          danger
        >
          <Trash2 size={14} />
        </IconBtn>

        {/* Help */}
        <IconBtn
          title="Keyboard shortcuts and help (H)"
          onClick={() => setHelpDialogOpen(true)}
        >
          <HelpCircle size={14} />
        </IconBtn>

        {/* Theme toggle */}
        <motion.button
          whileTap={{ scale: 0.88 }}
          title={`Switch to ${isDark ? 'light' : 'dark'} mode`}
          onClick={toggleTheme}
          className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          <AnimatePresence mode="wait">
            {isDark ? (
              <motion.span
                key="sun"
                initial={{ rotate: -90, opacity: 0 }}
                animate={{ rotate: 0, opacity: 1 }}
                exit={{ rotate: 90, opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                <Sun size={16} />
              </motion.span>
            ) : (
              <motion.span
                key="moon"
                initial={{ rotate: 90, opacity: 0 }}
                animate={{ rotate: 0, opacity: 1 }}
                exit={{ rotate: -90, opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                <Moon size={16} />
              </motion.span>
            )}
          </AnimatePresence>
        </motion.button>
      </div>

      <Dialog.Root open={clearDialogOpen} onOpenChange={setClearDialogOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-slate-900/40 backdrop-blur-[1px] z-[90]" />
          <Dialog.Content
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[92vw] max-w-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xl z-[100] p-4"
          >
            <Dialog.Title className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Clear Diagram?
            </Dialog.Title>
            <Dialog.Description className="mt-1 text-sm text-slate-600 dark:text-slate-300">
              This will remove all elements and relationships from the canvas.
            </Dialog.Description>
            <div className="mt-4 flex items-center justify-end gap-2">
              <Dialog.Close asChild>
                <button className="px-3 py-1.5 rounded-lg text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                  Cancel
                </button>
              </Dialog.Close>
              <button
                className="px-3 py-1.5 rounded-lg text-sm font-medium text-white bg-rose-500 hover:bg-rose-600 transition-colors"
                onClick={() => {
                  clearDiagram();
                  setClearDialogOpen(false);
                }}
              >
                Clear
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <Dialog.Root open={exportDialogOpen} onOpenChange={setExportDialogOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-slate-900/40 backdrop-blur-[1px] z-[90]" />
          <Dialog.Content
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[92vw] max-w-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xl z-[100] p-4"
          >
            <Dialog.Title className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Export Diagram
            </Dialog.Title>
            <Dialog.Description className="mt-1 text-sm text-slate-600 dark:text-slate-300">
              Enter a filename for your export (extension will be added automatically).
            </Dialog.Description>
            <input
              type="text"
              value={exportFilename}
              onChange={(e) => setExportFilename(e.target.value)}
              placeholder="diagram"
              className="mt-3 w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && pendingExportFormat) {
                  handleExport(pendingExportFormat, exportFilename || 'diagram');
                }
              }}
              autoFocus
            />
            <div className="mt-4 flex items-center justify-end gap-2">
              <Dialog.Close asChild>
                <button className="px-3 py-1.5 rounded-lg text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                  Cancel
                </button>
              </Dialog.Close>
              <button
                disabled={loading !== null}
                className="px-3 py-1.5 rounded-lg text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                onClick={() => {
                  if (pendingExportFormat) {
                    handleExport(pendingExportFormat, exportFilename || 'diagram');
                  }
                }}
              >
                {loading ? 'Exporting…' : 'Export'}
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <Dialog.Root open={helpDialogOpen} onOpenChange={setHelpDialogOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-slate-900/40 backdrop-blur-[1px] z-[90]" />
          <Dialog.Content
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[92vw] max-w-2xl rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xl z-[100] p-6 max-h-[80vh] overflow-y-auto"
          >
            <Dialog.Title className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-4">
              Diagr Help & Keyboard Shortcuts
            </Dialog.Title>

            <div className="space-y-6">
              {/* Tools */}
              <div>
                <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3 uppercase tracking-wide">
                  Tools
                </h3>
                <div className="space-y-2 text-sm">
                  <div className="flex items-start gap-3">
                    <kbd className="px-2 py-1 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded text-slate-700 dark:text-slate-300 font-mono text-xs whitespace-nowrap">
                      V
                    </kbd>
                    <span className="text-slate-600 dark:text-slate-400">Select tool — click to select elements</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <kbd className="px-2 py-1 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded text-slate-700 dark:text-slate-300 font-mono text-xs whitespace-nowrap">
                      C
                    </kbd>
                    <span className="text-slate-600 dark:text-slate-400">Connect tool — click source then target element</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <kbd className="px-2 py-1 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded text-slate-700 dark:text-slate-300 font-mono text-xs whitespace-nowrap">
                      Space
                    </kbd>
                    <span className="text-slate-600 dark:text-slate-400">Pan tool — hold and drag to pan canvas</span>
                  </div>
                </div>
              </div>

              {/* Canvas Navigation */}
              <div>
                <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3 uppercase tracking-wide">
                  Canvas Navigation
                </h3>
                <div className="space-y-2 text-sm">
                  <div className="flex items-start gap-3">
                    <kbd className="px-2 py-1 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded text-slate-700 dark:text-slate-300 font-mono text-xs whitespace-nowrap">
                      Z
                    </kbd>
                    <span className="text-slate-600 dark:text-slate-400">Zoom in (+10%)</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <kbd className="px-2 py-1 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded text-slate-700 dark:text-slate-300 font-mono text-xs whitespace-nowrap">
                      X
                    </kbd>
                    <span className="text-slate-600 dark:text-slate-400">Zoom out (-10%)</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <kbd className="px-2 py-1 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded text-slate-700 dark:text-slate-300 font-mono text-xs whitespace-nowrap">
                      A
                    </kbd>
                    <span className="text-slate-600 dark:text-slate-400">Fit all elements to viewport</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="text-slate-500 dark:text-slate-500 text-xs">Scroll wheel</span>
                    <span className="text-slate-600 dark:text-slate-400">Zoom in/out</span>
                  </div>
                </div>
              </div>

              {/* Editing */}
              <div>
                <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3 uppercase tracking-wide">
                  Editing
                </h3>
                <div className="space-y-2 text-sm">
                  <div className="flex items-start gap-3">
                    <kbd className="px-2 py-1 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded text-slate-700 dark:text-slate-300 font-mono text-xs whitespace-nowrap">
                      Delete
                    </kbd>
                    <span className="text-slate-600 dark:text-slate-400">Delete selected element or relationship</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <kbd className="px-2 py-1 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded text-slate-700 dark:text-slate-300 font-mono text-xs whitespace-nowrap">
                      Esc
                    </kbd>
                    <span className="text-slate-600 dark:text-slate-400">Deselect all, close dialogs, return to select tool</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <kbd className="px-2 py-1 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded text-slate-700 dark:text-slate-300 font-mono text-xs whitespace-nowrap">
                      Enter
                    </kbd>
                    <span className="text-slate-600 dark:text-slate-400">Confirm in dialogs (e.g., export filename)</span>
                  </div>
                </div>
              </div>

              {/* Tips */}
              <div>
                <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3 uppercase tracking-wide">
                  Tips
                </h3>
                <ul className="space-y-2 text-sm text-slate-600 dark:text-slate-400 list-disc list-inside">
                  <li>Click elements to select them and edit properties in the right panel</li>
                  <li>Drag elements to move them around the canvas</li>
                  <li>Use the left toolbar to add new UML elements</li>
                  <li>Toggle snap-to-grid in the top bar for precise alignment</li>
                  <li>Export diagrams as PNG, SVG, PDF, or JSON with custom filenames</li>
                  <li>Import previously saved JSON diagrams</li>
                  <li>Dark mode preference is saved automatically</li>
                </ul>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <Dialog.Close asChild>
                <button className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 transition-colors">
                  Close
                </button>
              </Dialog.Close>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </header>
  );
}

// ── Helper buttons ──
function IconBtn({
  children,
  title,
  onClick,
  danger,
  active,
}: {
  children: React.ReactNode;
  title: string;
  onClick: () => void;
  danger?: boolean;
  active?: boolean;
}) {
  return (
    <motion.button
      whileTap={{ scale: 0.88 }}
      title={title}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={cn(
        'w-8 h-8 flex items-center justify-center rounded-lg transition-colors',
        danger
          ? 'text-rose-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20'
          : active
          ? 'text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/40'
          : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
      )}
    >
      {children}
    </motion.button>
  );
}

function TopBarBtn({
  children,
  icon,
  onClick,
  title,
  active,
  chevron,
}: {
  children: React.ReactNode;
  icon: React.ReactNode;
  onClick: () => void;
  title: string;
  active?: boolean;
  chevron?: boolean;
}) {
  return (
    <motion.button
      whileTap={{ scale: 0.95 }}
      title={title}
      onClick={onClick}
      className={cn(
        'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors',
        active
          ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400'
          : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
      )}
    >
      {icon}
      <span className="hidden sm:inline">{children}</span>
      {chevron && <ChevronDown size={12} className={cn('transition-transform', active && 'rotate-180')} />}
    </motion.button>
  );
}

