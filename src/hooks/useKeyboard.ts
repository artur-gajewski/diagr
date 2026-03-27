import { useEffect } from 'react';
import { useDiagramStore } from '@/store/diagramStore';
import { useUIStore } from '@/store/uiStore';

export function useKeyboard() {
  const updateRelationship = useDiagramStore((s) => s.updateRelationship);
  const undoDiagram = useDiagramStore((s) => s.undoDiagram);
  const canUndo = useDiagramStore((s) => s.canUndo);
  const elements = useDiagramStore((s) => s.elements);
  const relationships = useDiagramStore((s) => s.relationships);
  const deleteElement = useDiagramStore((s) => s.deleteElement);
  const deleteRelationship = useDiagramStore((s) => s.deleteRelationship);
  const {
    selectedElementId,
    selectedElementIds,
    selectedRelationshipId,
    selectElement,
    selectRelationship,
    setTool,
    setSelectedElements,
    fitToContent,
    zoom,
    zoomAtViewportCenter,
    snapToGrid,
    setSnapToGrid,
    requireDeleteConfirmation,
    deleteConfirm,
    requestDeleteConfirm,
  } =
    useUIStore();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Ignore when typing in an input / textarea
      const target = e.target as HTMLElement;
      const tag = target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || target.isContentEditable) return;

      const key = e.key.toLowerCase();

      if (deleteConfirm) {
        return;
      }

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

      // Select all elements (A)
      if (key === 'a') {
        e.preventDefault();
        const allIds = useDiagramStore.getState().elements.map((el) => el.id);
        setSelectedElements(allIds);
        setTool('select');
      }

      // Fit to content (F)
      if (key === 'f') {
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
        if (selectedElementIds.length > 1) {
          const action = {
            title: 'Delete Elements?',
            description: `This will permanently remove ${selectedElementIds.length} elements and any connected relationships.`,
            confirmLabel: 'Delete Elements',
            onConfirm: () => {
              selectedElementIds.forEach((id) => deleteElement(id));
              selectElement(null);
            },
          };
          if (requireDeleteConfirmation) requestDeleteConfirm(action);
          else action.onConfirm();
        } else if (selectedElementIds.length === 1 || selectedElementId) {
          const elementId = selectedElementId ?? selectedElementIds[0];
          if (!elementId) return;
          const action = {
            title: 'Delete Element?',
            description: 'This will permanently remove this element and any connected relationships.',
            confirmLabel: 'Delete Element',
            onConfirm: () => {
              deleteElement(elementId);
              selectElement(null);
            },
          };
          if (requireDeleteConfirmation) requestDeleteConfirm(action);
          else action.onConfirm();
        } else if (selectedRelationshipId) {
          const action = {
            title: 'Delete Relationship?',
            description: 'This will permanently remove this relationship from the canvas.',
            confirmLabel: 'Delete Relationship',
            onConfirm: () => {
              deleteRelationship(selectedRelationshipId);
              selectRelationship(null);
            },
          };
          if (requireDeleteConfirmation) requestDeleteConfirm(action);
          else action.onConfirm();
        }
      }

      // Toggle grid/snap mode (G)
      if (key === 'g') {
        e.preventDefault();
        setSnapToGrid(!snapToGrid);
      }

      // Add image (I)
      if (key === 'i') {
        e.preventDefault();
        const imageInput = document.querySelector('input[type="file"][accept*="image"]') as HTMLInputElement;
        if (imageInput) {
          imageInput.click();
        }
      }

      // Undo last change (U)
      if (key === 'u' && canUndo) {
        e.preventDefault();
        undoDiagram();
        selectElement(null);
        selectRelationship(null);
        setTool('select');
      }

      // Toggle selected relationship routing (R)
      if (key === 'r' && selectedRelationshipId) {
        e.preventDefault();
        const relationship = relationships.find((r) => r.id === selectedRelationshipId);
        if (relationship) {
          updateRelationship(selectedRelationshipId, {
            routingMode: relationship.routingMode === 'orthogonal' ? 'curved' : 'orthogonal',
          });
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
    snapToGrid,
    canUndo,
    deleteElement,
    deleteRelationship,
    requireDeleteConfirmation,
    deleteConfirm,
    requestDeleteConfirm,
    updateRelationship,
    undoDiagram,
    selectElement,
    selectRelationship,
    setSelectedElements,
    setTool,
    setSnapToGrid,
    fitToContent,
    zoomAtViewportCenter,
  ]);
}

