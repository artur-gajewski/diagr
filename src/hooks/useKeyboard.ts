import { useEffect } from 'react';
import { useDiagramStore } from '@/store/diagramStore';
import { useUIStore } from '@/store/uiStore';

export function useKeyboard() {
  const deleteElement = useDiagramStore((s) => s.deleteElement);
  const deleteRelationship = useDiagramStore((s) => s.deleteRelationship);
  const elements = useDiagramStore((s) => s.elements);
  const relationships = useDiagramStore((s) => s.relationships);
  const { selectedElementId, selectedElementIds, selectedRelationshipId, selectElement, selectRelationship, setTool, fitToContent, zoom, zoomAtViewportCenter } =
    useUIStore();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Ignore when typing in an input / textarea
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;

      const key = e.key.toLowerCase();

      // Select tool (V)
      if (key === 'v') {
        e.preventDefault();
        setTool('select');
      }

      // Connect tool (C)
      if (key === 'c') {
        e.preventDefault();
        setTool('connect');
      }

      // Fit to content (A)
      if (key === 'a') {
        e.preventDefault();
        const vp = document.querySelector('main');
        const rect = vp?.getBoundingClientRect();
        const viewportWidth = rect?.width ?? window.innerWidth;
        const viewportHeight = rect?.height ?? window.innerHeight;
        fitToContent(elements, relationships, viewportWidth, viewportHeight);
      }

      // Zoom in (Z)
      if (key === 'z') {
        e.preventDefault();
        const vp = document.querySelector('main');
        const rect = vp?.getBoundingClientRect();
        const viewportWidth = rect?.width ?? window.innerWidth;
        const viewportHeight = rect?.height ?? window.innerHeight;
        zoomAtViewportCenter(zoom + 0.1, viewportWidth, viewportHeight);
      }

      // Zoom out (X)
      if (key === 'x') {
        e.preventDefault();
        const vp = document.querySelector('main');
        const rect = vp?.getBoundingClientRect();
        const viewportWidth = rect?.width ?? window.innerWidth;
        const viewportHeight = rect?.height ?? window.innerHeight;
        zoomAtViewportCenter(zoom - 0.1, viewportWidth, viewportHeight);
      }

      // Delete selected elements/relationships
      if (key === 'delete' || key === 'backspace' || key === 'd') {
        e.preventDefault();
        if (selectedElementIds.length > 0) {
          selectedElementIds.forEach((id) => deleteElement(id));
          selectElement(null);
        } else if (selectedElementId) {
          deleteElement(selectedElementId);
          selectElement(null);
        } else if (selectedRelationshipId) {
          deleteRelationship(selectedRelationshipId);
          selectRelationship(null);
        }
      }

      if (key === 'escape') {
        selectElement(null);
        selectRelationship(null);
        setTool('select');
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [
    selectedElementId,
    selectedElementIds,
    selectedRelationshipId,
    elements,
    relationships,
    zoom,
    deleteElement,
    deleteRelationship,
    selectElement,
    selectRelationship,
    setTool,
    fitToContent,
    zoomAtViewportCenter,
  ]);
}

