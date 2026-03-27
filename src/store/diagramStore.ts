import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';
import type {
  UMLElement,
  UMLMember,
  Relationship,
  DiagramModel,
  ElementType,
  RelationshipType,
  Visibility,
} from '@/types';

// ────────── Initial example diagram ──────────
const makeId = () => uuidv4();

const INITIAL_ELEMENTS: UMLElement[] = [];

const INITIAL_RELATIONSHIPS: Relationship[] = [];

// ────────── Store interface ──────────
interface DiagramStore {
  elements: UMLElement[];
  relationships: Relationship[];
  previousDiagram: DiagramModel | null;
  canUndo: boolean;
  undoCaptureKey: string | null;
  undoCaptureAt: number;

  // Element CRUD
  addElement: (type: ElementType) => string;
  duplicateElement: (id: string) => string | null;
  updateElement: (id: string, patch: Partial<Omit<UMLElement, 'id'>>) => void;
  deleteElement: (id: string) => void;

  // Member CRUD
  addMember: (elementId: string, section: 'properties' | 'methods') => string;
  updateMember: (elementId: string, memberId: string, patch: Partial<UMLMember>) => void;
  deleteMember: (elementId: string, memberId: string) => void;

  // Relationship CRUD
  addRelationship: (sourceId: string, targetId: string, type: RelationshipType) => string | null;
  updateRelationship: (id: string, patch: Partial<Omit<Relationship, 'id'>>) => void;
  deleteRelationship: (id: string) => void;

  // Import / export
  loadDiagram: (model: DiagramModel) => void;
  exportDiagram: () => DiagramModel;
  clearDiagram: () => void;
  undoDiagram: () => void;
}

const DEFAULT_VIS: Visibility = '+';
const UNDO_GROUP_WINDOW_MS = 450;

function cloneValue<T>(value: T): T {
  if (typeof structuredClone === 'function') return structuredClone(value);
  return JSON.parse(JSON.stringify(value)) as T;
}

function createDiagramSnapshot(elements: UMLElement[], relationships: Relationship[]): DiagramModel {
  return {
    version: '1.0.0',
    elements: cloneValue(elements),
    relationships: cloneValue(relationships),
  };
}

function nextUndoState(
  s: DiagramStore,
  captureKey: string,
  force = false,
): Pick<DiagramStore, 'previousDiagram' | 'canUndo' | 'undoCaptureKey' | 'undoCaptureAt'> {
  const now = Date.now();
  const reuseExisting =
    !force &&
    s.previousDiagram &&
    s.undoCaptureKey === captureKey &&
    now - s.undoCaptureAt < UNDO_GROUP_WINDOW_MS;

  if (reuseExisting) {
    return {
      previousDiagram: s.previousDiagram,
      canUndo: s.canUndo,
      undoCaptureKey: s.undoCaptureKey,
      undoCaptureAt: now,
    };
  }

  return {
    previousDiagram: createDiagramSnapshot(s.elements, s.relationships),
    canUndo: true,
    undoCaptureKey: captureKey,
    undoCaptureAt: now,
  };
}

export const useDiagramStore = create<DiagramStore>()(
  persist(
    (set, get) => ({
      elements: INITIAL_ELEMENTS,
      relationships: INITIAL_RELATIONSHIPS,
      previousDiagram: null,
      canUndo: false,
      undoCaptureKey: null,
      undoCaptureAt: 0,

      addElement: (type) => {
        const id = makeId();
        const names: Record<ElementType, string> = {
          server:   'Server',
          database: 'DB',
          service:  'Service',
          object:   'Object',
          condition:'Condition',
          yes:      'Yes',
          no:       'No',
          note:     'Note',
          text:     'Text',
          area:     'Infrastructure',
          image:    'Image',
        };
        const el: UMLElement = {
          id,
          type,
          name: names[type],
          x: 120 + Math.random() * 400,
          y: 120 + Math.random() * 300,
          properties: [],
          methods: [],
          ...((type === 'note' || type === 'text') ? { content: '' } : {}),
          ...(type === 'text' ? { boxWidth: 220, boxHeight: 120 } : {}),
          ...(type === 'text' ? { fontSize: 24 } : {}),
          ...(type === 'text' ? { textAlign: 'left' as const } : {}),
          ...(type === 'condition' ? { boxWidth: 190, boxHeight: 110 } : {}),
          ...((type === 'yes' || type === 'no') ? { boxWidth: 72, boxHeight: 52 } : {}),
          ...(type === 'area' ? { boxWidth: 320, boxHeight: 220, color: '#1e3a5f' } : {}),
          ...(type === 'image' ? { boxWidth: 200, boxHeight: 200 } : {}),
        };
        set((s) => ({
          ...nextUndoState(s, `add-element:${type}`, true),
          elements: [...s.elements, el],
        }));
        return id;
      },

      duplicateElement: (id) => {
        const source = get().elements.find((el) => el.id === id);
        if (!source) return null;

        const dupId = makeId();
        const cloneMember = (m: UMLMember): UMLMember => ({ ...m, id: makeId() });
        const duplicate: UMLElement = {
          ...source,
          id: dupId,
          name: `${source.name} Copy`,
          x: source.x + 28,
          y: source.y + 28,
          properties: source.properties.map(cloneMember),
          methods: source.methods.map(cloneMember),
        };

        set((s) => ({
          ...nextUndoState(s, `duplicate-element:${id}`, true),
          elements: [...s.elements, duplicate],
        }));
        return dupId;
      },

      updateElement: (id, patch) =>
        set((s) => ({
          ...nextUndoState(s, `update-element:${id}`),
          elements: s.elements.map((el) => (el.id === id ? { ...el, ...patch } : el)),
        })),

      deleteElement: (id) =>
        set((s) => ({
          ...nextUndoState(s, `delete-element:${id}`, true),
          elements: s.elements.filter((el) => el.id !== id),
          relationships: s.relationships.filter(
            (r) => r.sourceId !== id && r.targetId !== id
          ),
        })),

      addMember: (elementId, section) => {
        const id = makeId();
        const isMethod = section === 'methods';
        const member: UMLMember = {
          id,
          visibility: DEFAULT_VIS,
          name: isMethod ? 'newMethod' : 'newProperty',
          type: isMethod ? 'void' : 'string',
          params: isMethod ? '' : undefined,
        };
        set((s) => ({
          ...nextUndoState(s, `add-member:${elementId}:${section}`, true),
          elements: s.elements.map((el) =>
            el.id === elementId
              ? { ...el, [section]: [...el[section], member] }
              : el
          ),
        }));
        return id;
      },

      updateMember: (elementId, memberId, patch) =>
        set((s) => ({
          ...nextUndoState(s, `update-member:${elementId}:${memberId}`),
          elements: s.elements.map((el) => {
            if (el.id !== elementId) return el;
            const mapSection = (arr: UMLMember[]) =>
              arr.map((m) => (m.id === memberId ? { ...m, ...patch } : m));
            return {
              ...el,
              properties: mapSection(el.properties),
              methods: mapSection(el.methods),
            };
          }),
        })),

      deleteMember: (elementId, memberId) =>
        set((s) => ({
          ...nextUndoState(s, `delete-member:${elementId}:${memberId}`, true),
          elements: s.elements.map((el) => {
            if (el.id !== elementId) return el;
            return {
              ...el,
              properties: el.properties.filter((m) => m.id !== memberId),
              methods: el.methods.filter((m) => m.id !== memberId),
            };
          }),
        })),

      addRelationship: (sourceId, targetId, type) => {
        // prevent duplicate
        const exists = get().relationships.some(
          (r) => r.sourceId === sourceId && r.targetId === targetId && r.type === type
        );
        if (exists || sourceId === targetId) return null;
        const id = makeId();
        const rel: Relationship = { id, type, sourceId, targetId, routingMode: 'curved' };
        set((s) => ({
          ...nextUndoState(s, `add-relationship:${sourceId}:${targetId}:${type}`, true),
          relationships: [...s.relationships, rel],
        }));
        return id;
      },

      updateRelationship: (id, patch) =>
        set((s) => ({
          ...nextUndoState(s, `update-relationship:${id}`),
          relationships: s.relationships.map((r) => (r.id === id ? { ...r, ...patch } : r)),
        })),

      deleteRelationship: (id) =>
        set((s) => ({
          ...nextUndoState(s, `delete-relationship:${id}`, true),
          relationships: s.relationships.filter((r) => r.id !== id),
        })),

      loadDiagram: (model) =>
        set({
          ...nextUndoState(get(), 'load-diagram', true),
          elements: model.elements,
          relationships: model.relationships.map((r) => ({
            ...r,
            routingMode: r.routingMode ?? 'curved',
          })),
        }),

      exportDiagram: () => ({
        version: '1.0.0',
        elements: get().elements,
        relationships: get().relationships,
      }),

      clearDiagram: () =>
        set((s) => ({
          ...nextUndoState(s, 'clear-diagram', true),
          elements: [],
          relationships: [],
        })),

      undoDiagram: () =>
        set((s) => {
          if (!s.previousDiagram) return s;
          return {
            elements: cloneValue(s.previousDiagram.elements),
            relationships: cloneValue(s.previousDiagram.relationships),
            previousDiagram: null,
            canUndo: false,
            undoCaptureKey: null,
            undoCaptureAt: 0,
          };
        }),
    }),
    {
      name: 'diagr-v1',
      partialize: (s) => ({ elements: s.elements, relationships: s.relationships }),
    }
  )
);

