import { motion, AnimatePresence } from 'framer-motion';
import { X, Trash2, Copy } from 'lucide-react';
import { useDiagramStore } from '@/store/diagramStore';
import { useUIStore } from '@/store/uiStore';
import type { UMLElement, Relationship, RelationshipType, ElementType } from '@/types';
import { cn } from '@/lib/utils';


const EL_TYPES: { value: ElementType; label: string }[] = [
  { value: 'server',   label: 'Server'   },
  { value: 'database', label: 'Database' },
  { value: 'service',  label: 'Service'  },
  { value: 'object',   label: 'Object'   },
  { value: 'condition',label: 'Condition'},
  { value: 'yes',      label: 'Yes'      },
  { value: 'no',       label: 'No'       },
  { value: 'text',     label: 'Text'     },
];

const REL_TYPES: { value: RelationshipType; label: string }[] = [
  { value: 'association', label: 'Association' },
  { value: 'inheritance', label: 'Inheritance' },
  { value: 'composition', label: 'Composition' },
  { value: 'aggregation', label: 'Aggregation' },
  { value: 'dependency', label: 'Dependency' },
  { value: 'realization', label: 'Realization' },
];

// ────────── Field wrapper ──────────
function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
        {label}
      </label>
      {children}
    </div>
  );
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={cn(
        'w-full px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700/50 text-sm text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-blue-400',
        props.className
      )}
    />
  );
}

function Select(
  props: React.SelectHTMLAttributes<HTMLSelectElement> & { options: { value: string; label: string }[] }
) {
  const { options, ...rest } = props;
  return (
    <select
      {...rest}
      className={cn(
        'w-full px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700/50 text-sm text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-blue-400',
        props.className
      )}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}


// ────────── Element panel ──────────
function ElementPanel({ element }: { element: UMLElement }) {
  const { updateElement, deleteElement, duplicateElement } = useDiagramStore();
  const { selectElement } = useUIStore();

  const handleDuplicate = () => {
    const newId = duplicateElement(element.id);
    if (newId) selectElement(newId);
  };

  // ── Note ──
  if (element.type === 'note') {
    return (
      <div className="flex flex-col gap-4">
        <Field label="Content">
          <textarea
            value={element.content ?? ''}
            rows={6}
            placeholder="Write notes…"
            onChange={(e) => updateElement(element.id, { content: e.target.value })}
            className="w-full px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700/50 text-sm text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-yellow-400 resize-none leading-relaxed"
          />
        </Field>
        <ActionBtn onClick={handleDuplicate} label="Duplicate Note" icon={<Copy size={14} />} />
        <DeleteBtn onClick={() => { deleteElement(element.id); selectElement(null); }} label="Delete Note" />
      </div>
    );
  }

  // ── Plain text ──
  if (element.type === 'text') {
    return (
      <div className="flex flex-col gap-4">
        <Field label="Content">
          <textarea
            value={element.content ?? ''}
            rows={6}
            placeholder="Type text..."
            onChange={(e) => updateElement(element.id, { content: e.target.value })}
            className="w-full px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700/50 text-sm text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-blue-400 resize-none leading-relaxed"
          />
        </Field>
        <Field label="Align">
          <div className="grid grid-cols-3 gap-1.5">
            {(['left', 'center', 'right'] as const).map((align) => {
              const active = (element.textAlign ?? 'left') === align;
              return (
                <button
                  key={align}
                  onClick={() => updateElement(element.id, { textAlign: align })}
                  className={cn(
                    'py-1.5 rounded-md text-xs font-medium border transition-colors',
                    active
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300'
                      : 'border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/50'
                  )}
                >
                  {align[0].toUpperCase() + align.slice(1)}
                </button>
              );
            })}
          </div>
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Font Size">
            <Input
              type="number"
              min={10}
              max={120}
              value={Math.round(element.fontSize ?? 24)}
              onChange={(e) => updateElement(element.id, { fontSize: Math.max(10, Math.min(120, Number(e.target.value) || 24)) })}
            />
          </Field>
        </div>
        <ActionBtn onClick={handleDuplicate} label="Duplicate Text" icon={<Copy size={14} />} />
        <DeleteBtn onClick={() => { deleteElement(element.id); selectElement(null); }} label="Delete Text" />
      </div>
    );
  }

  // ── Class / Interface / Abstract ──
  return (
    <div className="flex flex-col gap-4">
      <Field label="Type">
        <Select
          value={element.type}
          onChange={(e) => updateElement(element.id, { type: e.target.value as ElementType })}
          options={EL_TYPES}
        />
      </Field>
      <Field label="Name">
        <Input
          value={element.name}
          onChange={(e) => updateElement(element.id, { name: e.target.value })}
          placeholder="Component name"
        />
      </Field>
      <ActionBtn onClick={handleDuplicate} label="Duplicate Element" icon={<Copy size={14} />} />
      <DeleteBtn onClick={() => { deleteElement(element.id); selectElement(null); }} label="Delete Element" />
    </div>
  );
}

function ActionBtn({ onClick, label, icon }: { onClick: () => void; label: string; icon: React.ReactNode }) {
  return (
    <button
      className="flex items-center justify-center gap-2 w-full py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/50 text-sm font-medium transition-colors mt-2"
      onClick={onClick}
    >
      {icon}
      {label}
    </button>
  );
}

function DeleteBtn({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      className="flex items-center justify-center gap-2 w-full py-2 rounded-lg border border-rose-200 dark:border-rose-800 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 text-sm font-medium transition-colors mt-2"
      onClick={onClick}
    >
      <Trash2 size={14} />
      {label}
    </button>
  );
}

// ────────── Relationship panel ──────────
function RelationshipPanel({ relationship }: { relationship: Relationship }) {
  const { updateRelationship, deleteRelationship } = useDiagramStore();
  const { selectRelationship } = useUIStore();

  return (
    <div className="flex flex-col gap-4">
      <Field label="Type">
        <Select
          value={relationship.type}
          onChange={(e) =>
            updateRelationship(relationship.id, { type: e.target.value as RelationshipType })
          }
          options={REL_TYPES}
        />
      </Field>

      <button
        className="mt-2 flex items-center justify-center gap-2 w-full py-2 rounded-lg border border-rose-200 dark:border-rose-800 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 text-sm font-medium transition-colors"
        onClick={() => {
          deleteRelationship(relationship.id);
          selectRelationship(null);
        }}
      >
        <Trash2 size={14} />
        Delete Relationship
      </button>
    </div>
  );
}

// ────────── PropertiesPanel (outer) ──────────
export function PropertiesPanel() {
  const { selectedElementId, selectedElementIds, selectedRelationshipId, selectElement, selectRelationship } =
    useUIStore();
  const elements = useDiagramStore((s) => s.elements);
  const relationships = useDiagramStore((s) => s.relationships);

  const isMultiElementSelection = selectedElementIds.length > 1;

  const selectedElement = isMultiElementSelection
    ? null
    : elements.find((e) => e.id === selectedElementId) ?? null;
  const selectedRelationship =
    relationships.find((r) => r.id === selectedRelationshipId) ?? null;

  const isOpen = !isMultiElementSelection && Boolean(selectedElement || selectedRelationship);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.aside
          key="props-panel"
          initial={{ x: '100%', opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: '100%', opacity: 0 }}
          transition={{ type: 'spring', stiffness: 340, damping: 32 }}
          className="absolute right-0 top-0 bottom-0 w-64 bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-700 overflow-y-auto scrollbar-hide z-50 shadow-xl"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-700 sticky top-0 bg-white dark:bg-slate-900 z-10">
            <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
              {selectedElement ? 'Element' : 'Relationship'}
            </span>
            <button
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              onClick={() => {
                selectElement(null);
                selectRelationship(null);
              }}
            >
              <X size={16} />
            </button>
          </div>

          {/* Content */}
          <div className="p-4">
            {selectedElement && <ElementPanel element={selectedElement} />}
            {selectedRelationship && (
              <RelationshipPanel relationship={selectedRelationship} />
            )}
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}

