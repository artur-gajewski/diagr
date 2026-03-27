// ────────── Primitives ──────────
export type ElementType =
  | 'server'
  | 'database'
  | 'service'
  | 'object'
  | 'condition'
  | 'yes'
  | 'no'
  | 'note'
  | 'text';
export type Visibility = '+' | '-' | '#' | '~';
export type RelationshipType =
  | 'association'
  | 'inheritance'
  | 'composition'
  | 'aggregation'
  | 'dependency'
  | 'realization';

// ────────── UML Members ──────────
export interface UMLMember {
  id: string;
  visibility: Visibility;
  name: string;
  type: string; // property type / method return type
  params?: string; // for methods
  isStatic?: boolean;
  isAbstract?: boolean;
}

// ────────── UML Element ──────────
export interface UMLElement {
  id: string;
  type: ElementType;
  name: string;
  x: number;
  y: number;
  properties: UMLMember[];
  methods: UMLMember[];
  /** Free-form text content — used by 'note' and 'text' element types */
  content?: string;
  /** Stored height in px — used by the 'note' element type for resizing */
  noteHeight?: number;
  /** Custom width for non-note boxes (defaults to BOX_WIDTH) */
  boxWidth?: number;
  /** Custom height for non-note boxes (defaults to BOX_HEIGHT) */
  boxHeight?: number;
  /** Font size in px — primarily used by the plain 'text' element type */
  fontSize?: number;
  /** Text alignment — primarily used by the plain 'text' element type */
  textAlign?: 'left' | 'center' | 'right';
}

// ────────── Relationship ──────────
export interface Relationship {
  id: string;
  type: RelationshipType;
  sourceId: string;
  targetId: string;
  label?: string;
  sourceMultiplicity?: string;
  targetMultiplicity?: string;
  isDashed?: boolean;
}

// ────────── Diagram snapshot (for import/export) ──────────
export interface DiagramModel {
  version: string;
  elements: UMLElement[];
  relationships: Relationship[];
}

// ────────── Geometry ──────────
export interface Point {
  x: number;
  y: number;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type AnchorSide = 'top' | 'right' | 'bottom' | 'left';

