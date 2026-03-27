import { motion } from 'framer-motion';
import {
  MousePointer2,
  Hand,
  Link,
  Check,
  X,
  Image as ImageIcon,
} from 'lucide-react';
import { useDiagramStore } from '@/store/diagramStore';
import { useUIStore, type Tool } from '@/store/uiStore';
import { snapToGrid } from '@/utils/geometry';
import type { ElementType } from '@/types';
import { cn } from '@/lib/utils';
import { useRef } from 'react';

const ELEMENT_TYPES: { type: ElementType; label: string; icon: React.ReactNode; color: string }[] =
  [
    { type: 'area',     label: 'Area',     icon: <span className="w-4 h-4 rounded-sm border-2 border-dashed border-blue-900 block flex-shrink-0" />, color: 'text-blue-900'  },
    { type: 'server',   label: 'Server',   icon: <span className="w-4 h-4 rounded-sm bg-blue-500    block flex-shrink-0" />, color: 'text-blue-500'    },
    { type: 'database', label: 'Database', icon: <span className="w-4 h-4 rounded-sm bg-emerald-500 block flex-shrink-0" />, color: 'text-emerald-500' },
    { type: 'service',  label: 'Service',  icon: <span className="w-4 h-4 rounded-sm bg-violet-500  block flex-shrink-0" />, color: 'text-violet-500'  },
    { type: 'object',   label: 'Object',   icon: <span className="w-4 h-4 rounded-sm bg-orange-500  block flex-shrink-0" />, color: 'text-orange-500'  },
  ];

const EXTRA_TYPES: { type: ElementType; label: string; icon: React.ReactNode; color: string }[] =
    [
      { type: 'text',     label: 'Text',     icon: <span className="text-sm font-bold leading-none">A</span>, color: 'text-slate-500'   },
      { type: 'note',     label: 'Note',     icon: <span className="w-4 h-4 rounded-sm bg-yellow-400  block flex-shrink-0" />, color: 'text-yellow-500'  },
      { type: 'condition',label: 'Condition',icon: <span className="w-4 h-4 rounded-sm border border-slate-300 bg-white block flex-shrink-0" />, color: 'text-slate-500'  },
      { type: 'yes',      label: 'Yes',      icon: <span className="w-4 h-4 rounded-sm bg-green-500 flex items-center justify-center text-white"><Check size={12} strokeWidth={3} /></span>, color: 'text-green-500'  },
      { type: 'no',       label: 'No',       icon: <span className="w-4 h-4 rounded-sm bg-rose-500 flex items-center justify-center text-white"><X size={12} strokeWidth={3} /></span>, color: 'text-rose-500'  },
      { type: 'area',     label: 'Area',     icon: <span className="w-4 h-4 rounded-sm border-2 border-dashed border-blue-900 block flex-shrink-0" />, color: 'text-blue-900'  },
    ];

const TOOLS: { tool: Tool; icon: React.ReactNode; label: string }[] = [
  { tool: 'select', icon: <MousePointer2 size={16} />, label: 'Select (V)' },
  { tool: 'connect', icon: <Link size={16} />, label: 'Connect (C)' },
  { tool: 'pan', icon: <Hand size={16} />, label: 'Pan (Space)' },
];

export function Toolbar() {
  const { tool, setTool, setPendingRelType, selectElement, setIsDashedMode, snapToGrid: snapEnabled } = useUIStore();
  const imageInputRef = useRef<HTMLInputElement>(null);

  const handleAddElement = (type: ElementType) => {
    const { addElement, updateElement } = useDiagramStore.getState();
    const id = addElement(type);
    if (snapEnabled) {
      const created = useDiagramStore.getState().elements.find((el) => el.id === id);
      if (created) {
        updateElement(id, { x: snapToGrid(created.x), y: snapToGrid(created.y) });
      }
    }
    selectElement(id);
    setTool('select');
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      const { addElement, updateElement } = useDiagramStore.getState();
      const id = addElement('image');
      if (snapEnabled) {
        const created = useDiagramStore.getState().elements.find((el) => el.id === id);
        if (created) {
          updateElement(id, {
            x: snapToGrid(created.x),
            y: snapToGrid(created.y),
            imageData: dataUrl,
          });
        }
      } else {
        updateElement(id, { imageData: dataUrl });
      }
      selectElement(id);
      setTool('select');
    };
    reader.readAsDataURL(file);
    if (imageInputRef.current) imageInputRef.current.value = '';
  };

  return (
    <motion.aside
      initial={{ x: -80, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      className="flex flex-col gap-1 p-2 w-14 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-700 z-50 overflow-y-auto scrollbar-hide"
    >
      {/* Tool selector */}
      <Section label="Tools">
        {TOOLS.map(({ tool: t, icon, label }) => (
          <ToolButton
            key={t}
            active={tool === t}
            title={label}
            onClick={() => {
              setIsDashedMode(false);
              setTool(t);
            }}
          >
            {icon}
          </ToolButton>
        ))}
      </Section>

      <Divider />

      {/* Add elements */}
      <Section label="Add">
        {ELEMENT_TYPES.map(({ type, label, icon, color }) => (
          <ToolButton
            key={type}
            title={`Add ${label}`}
            onClick={() => handleAddElement(type)}
            className={color}
          >
            {icon}
          </ToolButton>
        ))}
      </Section>

      <Divider />

      {/* Add elements */}
      <Section label="Other">
        {EXTRA_TYPES.map(({ type, label, icon, color }) => (
            <ToolButton
                key={type}
                title={`Add ${label}`}
                onClick={() => handleAddElement(type)}
                className={color}
            >
              {icon}
            </ToolButton>
        ))}
        <input
          ref={imageInputRef}
          type="file"
          accept="image/jpeg,image/jpg,image/png,image/gif,image/svg+xml"
          onChange={handleImageUpload}
          style={{ display: 'none' }}
        />
        <ToolButton
          title="Add Image"
          onClick={() => imageInputRef.current?.click()}
          className="text-slate-600"
        >
          <ImageIcon size={16} />
        </ToolButton>
      </Section>

    </motion.aside>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[8px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-600 px-1 pt-1">
        {label}
      </span>
      {children}
    </div>
  );
}

function Divider() {
  return <div className="h-px bg-slate-200 dark:bg-slate-700 my-1" />;
}

function ToolButton({
  children,
  active,
  onClick,
  title,
  className,
}: {
  children: React.ReactNode;
  active?: boolean;
  onClick: () => void;
  title: string;
  className?: string;
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      className={cn(
        'flex items-center justify-center w-10 h-10 rounded-lg transition-all duration-150',
        'hover:bg-slate-100 dark:hover:bg-slate-800',
        active
          ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 shadow-inner'
          : 'text-slate-600 dark:text-slate-400',
        className
      )}
    >
      {children}
    </button>
  );
}

