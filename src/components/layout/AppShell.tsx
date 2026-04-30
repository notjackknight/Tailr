import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Sparkles,
  LayoutDashboard,
  Settings,
} from 'lucide-react';
import { cn } from '../../lib/utils';

type View = 'dashboard' | 'studio' | 'settings';

interface AppShellProps {
  children: React.ReactNode;
  currentView: View;
  onNavigate: (view: View) => void;
  /** Floating top-right slot — used by the setup popover. */
  topRightSlot?: React.ReactNode;
}

export const AppShell = ({ children, currentView, onNavigate, topRightSlot }: AppShellProps) => {
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard size={20} /> },
    { id: 'studio', label: 'Studio', icon: <Sparkles size={20} /> },
    { id: 'settings', label: 'Settings', icon: <Settings size={20} /> },
  ];

  return (
    <div className="flex h-screen w-full bg-obsidian text-white overflow-hidden">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-20 lg:w-64 h-full glass-panel border-r border-white/5 z-50">
        <div className="p-6 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-tailr flex items-center justify-center shrink-0">
            <Sparkles className="text-white w-5 h-5" />
          </div>
          <span className="font-bold text-xl tracking-tight hidden lg:block">Tailr</span>
        </div>

        <nav className="flex-1 px-4 py-6 space-y-2">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id as View)}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group",
                currentView === item.id
                  ? "bg-white/10 text-white shadow-lg shadow-white/5"
                  : "text-gray-400 hover:text-white hover:bg-white/5"
              )}
            >
              <div className={cn(
                "transition-colors",
                currentView === item.id ? "text-white" : "text-gray-400 group-hover:text-white"
              )}>
                {item.icon}
              </div>
              <span className="font-medium hidden lg:block">{item.label}</span>
              {currentView === item.id && (
                <motion.div
                  layoutId="activeNav"
                  className="absolute left-0 w-1 h-8 bg-gradient-tailr rounded-r-full hidden lg:block"
                />
              )}
            </button>
          ))}
        </nav>

      </aside>

      {/* Main Content Area */}
      <main className="flex-1 relative h-full overflow-hidden flex flex-col">
        {topRightSlot}
        <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 md:p-8 pb-28 md:pb-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentView}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              className="min-h-full lg:h-full max-w-7xl mx-auto flex flex-col"
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      {/* Mobile Bottom Nav */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 glass-panel border-t border-white/10 z-50 pb-safe">
        <div className="flex justify-around items-center p-4">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id as View)}
              className={cn(
                "flex flex-col items-center gap-1 p-2 rounded-xl transition-colors",
                currentView === item.id ? "text-white" : "text-gray-500"
              )}
            >
              <div className={cn(
                "p-2 rounded-full transition-all",
                currentView === item.id ? "bg-white/10" : "bg-transparent"
              )}>
                {item.icon}
              </div>
              <span className="text-[10px] font-medium uppercase tracking-wider">{item.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
