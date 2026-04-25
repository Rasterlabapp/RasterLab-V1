'use client';

import { Toolbar } from './Toolbar';
import { LeftSidebar } from './LeftSidebar';
import { Canvas } from './Canvas';
import { RightSidebar } from './RightSidebar';
import { StatusBar } from './StatusBar';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';

export function Editor() {
  useKeyboardShortcuts();

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
