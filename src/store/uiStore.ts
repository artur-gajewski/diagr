import { create } from 'zustand';
import type { RelationshipType, UMLElement, Relationship } from '@/types';
import { calculateFitToContent } from '@/utils/geometry';

export type Tool = 'select' | 'connect' | 'dashed_connect' | 'pan';

interface UIStore {
  // Selection
  selectedElementId: string | null;
  selectedElementIds: string[];
  selectedRelationshipId: string | null;

  // Active tool
  tool: Tool;

  // Connect mode
  pendingRelType: RelationshipType;
  connectSourceId: string | null;
  isDashedMode: boolean;

  // Theme
  theme: 'light' | 'dark';

  // Canvas zoom / pan (managed here for export access)
  zoom: number;
  panX: number;
  panY: number;
  snapToGrid: boolean;

  // Actions
  selectElement: (id: string | null) => void;
  setSelectedElements: (ids: string[]) => void;
  selectRelationship: (id: string | null) => void;
  setTool: (tool: Tool) => void;
  setPendingRelType: (type: RelationshipType) => void;
  setConnectSource: (id: string | null) => void;
  setIsDashedMode: (isDashed: boolean) => void;
  toggleTheme: () => void;
  setZoom: (zoom: number) => void;
  setPan: (x: number, y: number) => void;
  setSnapToGrid: (value: boolean) => void;
  resetView: () => void;
  fitToContent: (elements: UMLElement[], relationships: Relationship[], viewportWidth: number, viewportHeight: number) => void;
  zoomAtViewportCenter: (nextZoomRaw: number, viewportWidth: number, viewportHeight: number) => void;
}

export const useUIStore = create<UIStore>((set) => ({
  selectedElementId: null,
  selectedElementIds: [],
  selectedRelationshipId: null,
  tool: 'select',
  pendingRelType: 'association',
  connectSourceId: null,
  isDashedMode: false,
  theme: (localStorage.getItem('diagr-theme') as 'light' | 'dark') ?? 'light',
  zoom: 1,
  panX: 0,
  panY: 0,
  snapToGrid: false,

  selectElement: (id) =>
    set({
      selectedElementId: id,
      selectedElementIds: id ? [id] : [],
      selectedRelationshipId: null,
    }),

  setSelectedElements: (ids) =>
    set({
      selectedElementId: ids[0] ?? null,
      selectedElementIds: ids,
      selectedRelationshipId: null,
    }),

  selectRelationship: (id) =>
    set({ selectedRelationshipId: id, selectedElementId: null, selectedElementIds: [] }),

  setTool: (tool) =>
    set({ tool, connectSourceId: null }),

  setPendingRelType: (type) => set({ pendingRelType: type }),

  setConnectSource: (id) => set({ connectSourceId: id }),

  setIsDashedMode: (isDashed) => set({ isDashedMode: isDashed }),

  toggleTheme: () =>
    set((s) => {
      const next = s.theme === 'light' ? 'dark' : 'light';
      localStorage.setItem('diagr-theme', next);
      if (next === 'dark') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
      return { theme: next };
    }),

  setZoom: (zoom) => set({ zoom }),
  setPan: (panX, panY) => set({ panX, panY }),
  setSnapToGrid: (value) => set({ snapToGrid: value }),
  resetView: () => set({ zoom: 1, panX: 0, panY: 0 }),
  fitToContent: (elements, relationships, viewportWidth, viewportHeight) => {
    const { zoom, panX, panY } = calculateFitToContent(elements, relationships, viewportWidth, viewportHeight);
    set({ zoom, panX, panY });
  },
  zoomAtViewportCenter: (nextZoomRaw, viewportWidth, viewportHeight) => {
    set((s) => {
      const nextZoom = Math.min(3, Math.max(0.2, nextZoomRaw));
      if (nextZoom === s.zoom) return s;

      const cx = viewportWidth / 2;
      const cy = viewportHeight / 2;
      const scale = nextZoom / s.zoom;

      return {
        zoom: nextZoom,
        panX: cx - scale * (cx - s.panX),
        panY: cy - scale * (cy - s.panY),
      };
    });
  },
}));

