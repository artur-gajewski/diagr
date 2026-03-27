import * as Dialog from '@radix-ui/react-dialog';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Trash2, Copy, ArrowUpRight, ArrowDownLeft } from 'lucide-react';
import { useDiagramStore } from '@/store/diagramStore';
import { useUIStore } from '@/store/uiStore';
import type { DeleteConfirmState } from '@/store/uiStore';
import type { UMLElement, Relationship, RelationshipType, ElementType } from '@/types';
import { cn } from '@/lib/utils';
import { getBoxRect } from '@/utils/geometry';


const EL_TYPES: { value: ElementType; label: string }[] = [
  { value: 'server',   label: 'Server'   },
  { value: 'database', label: 'Database' },
  { value: 'service',  label: 'Service'  },
  { value: 'object',   label: 'Object'   },
  { value: 'condition',label: 'Condition'},
  { value: 'yes',      label: 'Yes'      },
  { value: 'no',       label: 'No'       },
  { value: 'text',     label: 'Text'     },
  { value: 'area',     label: 'Area'     },
  { value: 'image',    label: 'Image'    },
];

const REL_TYPES: { value: RelationshipType; label: string }[] = [
  { value: 'association', label: 'Association' },
  { value: 'inheritance', label: 'Inheritance' },
  { value: 'composition', label: 'Composition' },
  { value: 'aggregation', label: 'Aggregation' },
  { value: 'dependency', label: 'Dependency' },
  { value: 'realization', label: 'Realization' },
];

const ROUTING_TYPES = [
  { value: 'curved', label: 'Curved' },
  { value: 'orthogonal', label: 'Orthogonal (H/V)' },
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
function ElementPanel({
  element,
  onRequestDelete,
}: {
  element: UMLElement;
  onRequestDelete: (config: DeleteConfirmState) => void;
}) {
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
        <DeleteBtn
          onClick={() =>
            onRequestDelete({
              title: 'Delete Note?',
              description: 'This will permanently remove this note from the canvas.',
              confirmLabel: 'Delete Note',
              onConfirm: () => {
                deleteElement(element.id);
                selectElement(null);
              },
            })
          }
          label="Delete Note"
        />
      </div>
    );
  }

  // ── Area ──
  if (element.type === 'area') {
    return (
      <div className="flex flex-col gap-4">
        <Field label="Label">
          <Input
            value={element.name}
            onChange={(e) => updateElement(element.id, { name: e.target.value })}
            placeholder="Area name"
          />
        </Field>
        <Field label="Color">
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={element.color ?? '#1e3a5f'}
              onChange={(e) => updateElement(element.id, { color: e.target.value })}
              className="w-10 h-9 rounded-lg border border-slate-200 dark:border-slate-600 cursor-pointer bg-transparent p-0.5"
              title="Pick area color"
            />
            <Input
              value={element.color ?? '#1e3a5f'}
              onChange={(e) => updateElement(element.id, { color: e.target.value })}
              placeholder="#1e3a5f"
              className="font-mono text-xs"
            />
          </div>
        </Field>
        <ActionBtn onClick={handleDuplicate} label="Duplicate Area" icon={<Copy size={14} />} />
        <DeleteBtn
          onClick={() =>
            onRequestDelete({
              title: 'Delete Area?',
              description: 'This will permanently remove this area and any relationships attached through its elements will remain unchanged.',
              confirmLabel: 'Delete Area',
              onConfirm: () => {
                deleteElement(element.id);
                selectElement(null);
              },
            })
          }
          label="Delete Area"
        />
      </div>
    );
  }

  // ── Plain text ──
  if (element.type === 'text') {    return (
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
        <DeleteBtn
          onClick={() =>
            onRequestDelete({
              title: 'Delete Text?',
              description: 'This will permanently remove this text element from the canvas.',
              confirmLabel: 'Delete Text',
              onConfirm: () => {
                deleteElement(element.id);
                selectElement(null);
              },
            })
          }
          label="Delete Text"
        />
      </div>
    );
  }

  // ── Image ──
  if (element.type === 'image') {
    return (
      <div className="flex flex-col gap-4">
        <div className="aspect-video rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden bg-slate-50 dark:bg-slate-800/30">
          {element.imageData ? (
            <img
              src={element.imageData}
              alt={element.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-slate-400 text-xs">
              No image
            </div>
          )}
        </div>
        <ActionBtn onClick={handleDuplicate} label="Duplicate Image" icon={<Copy size={14} />} />
        <DeleteBtn
          onClick={() =>
            onRequestDelete({
              title: 'Delete Image?',
              description: 'This will permanently remove this image from the canvas.',
              confirmLabel: 'Delete Image',
              onConfirm: () => {
                deleteElement(element.id);
                selectElement(null);
              },
            })
          }
          label="Delete Image"
        />
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
      <DeleteBtn
        onClick={() =>
          onRequestDelete({
            title: 'Delete Element?',
            description: 'This will permanently remove this element and any connected relationships.',
            confirmLabel: 'Delete Element',
            onConfirm: () => {
              deleteElement(element.id);
              selectElement(null);
            },
          })
        }
        label="Delete Element"
      />
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
function RelationshipPanel({
  relationship,
  onRequestDelete,
}: {
  relationship: Relationship;
  onRequestDelete: (config: DeleteConfirmState) => void;
}) {
  const { updateRelationship, deleteRelationship } = useDiagramStore();
  const { selectRelationship, zoom, setPan } = useUIStore();
  const elements = useDiagramStore((s) => s.elements);

  const handleGoToStart = () => {
    const sourceEl = elements.find((el) => el.id === relationship.sourceId);
    if (!sourceEl) return;

    const vp = document.querySelector('main');
    const rect = vp?.getBoundingClientRect();
    const viewportWidth = rect?.width ?? window.innerWidth;
    const viewportHeight = rect?.height ?? window.innerHeight;

    // Get source element's center in canvas space
    const boxRect = getBoxRect(sourceEl);
    const centerX = boxRect.x + boxRect.width / 2;
    const centerY = boxRect.y + boxRect.height / 2;

    // Calculate pan so the source element's center is at viewport center
    const panX = viewportWidth / 2 - centerX * zoom;
    const panY = viewportHeight / 2 - centerY * zoom;

    setPan(panX, panY);
  };

  const handleGoToEnd = () => {
    const targetEl = elements.find((el) => el.id === relationship.targetId);
    if (!targetEl) return;

    const vp = document.querySelector('main');
    const rect = vp?.getBoundingClientRect();
    const viewportWidth = rect?.width ?? window.innerWidth;
    const viewportHeight = rect?.height ?? window.innerHeight;

    // Get target element's center in canvas space
    const boxRect = getBoxRect(targetEl);
    const centerX = boxRect.x + boxRect.width / 2;
    const centerY = boxRect.y + boxRect.height / 2;

    // Calculate pan so the target element's center is at viewport center
    const panX = viewportWidth / 2 - centerX * zoom;
    const panY = viewportHeight / 2 - centerY * zoom;

    setPan(panX, panY);
  };

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

      <Field label="Routing">
        <Select
          value={relationship.routingMode ?? 'curved'}
          onChange={(e) =>
            updateRelationship(relationship.id, {
              routingMode: e.target.value as Relationship['routingMode'],
            })
          }
          options={ROUTING_TYPES}
        />
      </Field>

      <button
        className="flex items-center justify-center gap-2 w-full py-2 rounded-lg border border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 text-sm font-medium transition-colors"
        onClick={handleGoToStart}
      >
        <ArrowDownLeft size={14} />
        Go to source
      </button>

      <button
        className="flex items-center justify-center gap-2 w-full py-2 rounded-lg border border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 text-sm font-medium transition-colors"
        onClick={handleGoToEnd}
      >
        <ArrowUpRight size={14} />
        Go to target
      </button>

      <button
        className="mt-2 flex items-center justify-center gap-2 w-full py-2 rounded-lg border border-rose-200 dark:border-rose-800 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 text-sm font-medium transition-colors"
        onClick={() =>
          onRequestDelete({
            title: 'Delete Relationship?',
            description: 'This will permanently remove this relationship from the canvas.',
            confirmLabel: 'Delete Relationship',
            onConfirm: () => {
              deleteRelationship(relationship.id);
              selectRelationship(null);
            },
          })
        }
      >
        <Trash2 size={14} />
        Delete Relationship
      </button>
    </div>
  );
}

// ────────── PropertiesPanel (outer) ──────────
export function PropertiesPanel() {
  const {
    selectedElementId,
    selectedElementIds,
    selectedRelationshipId,
    selectElement,
    selectRelationship,
    requireDeleteConfirmation,
    deleteConfirm,
    requestDeleteConfirm,
    clearDeleteConfirm,
  } = useUIStore();
  const elements = useDiagramStore((s) => s.elements);
  const relationships = useDiagramStore((s) => s.relationships);

  const isMultiElementSelection = selectedElementIds.length > 1;

  const selectedElement = isMultiElementSelection
    ? null
    : elements.find((e) => e.id === selectedElementId) ?? null;
  const selectedRelationship =
    relationships.find((r) => r.id === selectedRelationshipId) ?? null;

  const isOpen = !isMultiElementSelection && Boolean(selectedElement || selectedRelationship);

  const handleConfirmDelete = () => {
    if (!deleteConfirm) return;
    deleteConfirm.onConfirm();
    clearDeleteConfirm();
  };

  const requestDeleteOrRun = (config: DeleteConfirmState) => {
    if (requireDeleteConfirmation) {
      requestDeleteConfirm(config);
      return;
    }
    config.onConfirm();
  };

  return (
    <>
      <AnimatePresence>
        {isOpen && (
        <>
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
              {selectedElement && <ElementPanel element={selectedElement} onRequestDelete={requestDeleteOrRun} />}
              {selectedRelationship && (
                <RelationshipPanel relationship={selectedRelationship} onRequestDelete={requestDeleteOrRun} />
              )}
            </div>
          </motion.aside>
        </>
        )}
      </AnimatePresence>

      <Dialog.Root open={Boolean(deleteConfirm)} onOpenChange={(open) => { if (!open) clearDeleteConfirm(); }}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-slate-900/40 backdrop-blur-[1px] z-[90]" />
          <Dialog.Content
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[92vw] max-w-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xl z-[100] p-4"
          >
            <Dialog.Title className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              {deleteConfirm?.title}
            </Dialog.Title>
            <Dialog.Description className="mt-1 text-sm text-slate-600 dark:text-slate-300">
              {deleteConfirm?.description}
            </Dialog.Description>
            <div className="mt-4 flex items-center justify-end gap-2">
              <Dialog.Close asChild>
                <button className="px-3 py-1.5 rounded-lg text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                  Cancel
                </button>
              </Dialog.Close>
              <button
                className="px-3 py-1.5 rounded-lg text-sm font-medium text-white bg-rose-500 hover:bg-rose-600 transition-colors"
                onClick={handleConfirmDelete}
              >
                {deleteConfirm?.confirmLabel ?? 'Delete'}
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}

