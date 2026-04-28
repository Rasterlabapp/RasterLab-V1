'use client';

import { Toolbar } from './Toolbar';
import { LeftSidebar } from './LeftSidebar';
import { Canvas } from './Canvas';
import { RightSidebar } from './RightSidebar';
import { StatusBar } from './StatusBar';
import { MobileEditor } from './mobile/MobileEditor';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { useIsMobile } from '@/hooks/useIsMobile';

export function Editor() {
  useKeyboardShortcuts();
  const isMobile = useIsMobile(768);

  if (isMobile) return <MobileEditor />;

  return (
    <div className="h-screen flex flex-col bg-zinc-950 text-white overflow-hidden">
      <Toolbar />
      <div className="flex flex-1 overflow-hidden">
        <LeftSidebar />
        <Canvas />
        <RightSidebar />
      </div>
      <StatusBar />
    </div>
  );
}
