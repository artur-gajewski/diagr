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
}

const DEFAULT_VIS: Visibility = '+';

export const useDiagramStore = create<DiagramStore>()(
  persist(
    (set, get) => ({
      elements: INITIAL_ELEMENTS,
      relationships: INITIAL_RELATIONSHIPS,

      addElement: (type) => {
        const id = makeId();
        const names: Record<ElementType, string> = {
          server:   'Server',
          database: 'DB',
          service:  'Service',
          object:   'Object',
          note:     'Note',
          text:     'Text',
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
        };
        set((s) => ({ elements: [...s.elements, el] }));
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

        set((s) => ({ elements: [...s.elements, duplicate] }));
        return dupId;
      },

      updateElement: (id, patch) =>
        set((s) => ({
          elements: s.elements.map((el) => (el.id === id ? { ...el, ...patch } : el)),
        })),

      deleteElement: (id) =>
        set((s) => ({
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
        const rel: Relationship = { id, type, sourceId, targetId };
        set((s) => ({ relationships: [...s.relationships, rel] }));
        return id;
      },

      updateRelationship: (id, patch) =>
        set((s) => ({
          relationships: s.relationships.map((r) => (r.id === id ? { ...r, ...patch } : r)),
        })),

      deleteRelationship: (id) =>
        set((s) => ({
          relationships: s.relationships.filter((r) => r.id !== id),
        })),

      loadDiagram: (model) =>
        set({ elements: model.elements, relationships: model.relationships }),

      exportDiagram: () => ({
        version: '1.0.0',
        elements: get().elements,
        relationships: get().relationships,
      }),

      clearDiagram: () => set({ elements: [], relationships: [] }),
    }),
    {
      name: 'diagr-v1',
      partialize: (s) => ({ elements: s.elements, relationships: s.relationships }),
    }
  )
);

