import { useEffect, useRef } from 'react';
import { useUIStore } from '@/store/uiStore';
import { TopBar } from '@/components/TopBar';
import { Toolbar } from '@/components/Panels/Toolbar';
import { DiagramCanvas } from '@/components/Canvas/DiagramCanvas';
import { PropertiesPanel } from '@/components/Panels/PropertiesPanel';
import { useKeyboard } from '@/hooks/useKeyboard';

export default function App() {
  const { theme } = useUIStore();
  const canvasRef = useRef<HTMLDivElement>(null);

  // Apply dark class on mount and theme change
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  // Global keyboard shortcuts
  useKeyboard();

  return (
    <div className="flex flex-col h-full w-full bg-slate-50 dark:bg-slate-950">
      {/* Top bar */}
      <TopBar canvasRef={canvasRef} />

      {/* Main layout */}
      <div className="flex flex-1 min-h-0 relative">
        {/* Left toolbar */}
        <Toolbar />

        {/* Canvas area */}
        <main className="flex-1 relative overflow-hidden">
          <DiagramCanvas canvasRef={canvasRef} />
        </main>

        {/* Right properties panel (absolutely positioned) */}
        <PropertiesPanel />
      </div>
    </div>
  );
}

