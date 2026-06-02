import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Sparkles,
  LayoutDashboard,
  Settings,
  AlertTriangle,
  CheckCircle2,
  Archive,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { getActiveProvider, hasActiveKey, PROVIDER_LABELS, subscribeApiKey } from '../../lib/apiKey';
import type { AppConfig, LlmProvider } from '../../../shared/types';

type View = 'dashboard' | 'studio' | 'settings' | 'vault';

interface AppShellProps {
  children: React.ReactNode;
  currentView: View;
  onNavigate: (view: View) => void;
  /** Floating top-right slot — used by the setup popover (desktop only). */
  topRightSlot?: React.ReactNode;
  /** Mobile top-bar setup chip slot. */
  mobileSetupSlot?: React.ReactNode;
  /** Used to render footer state: profile name, provider, setup count. */
  config?: AppConfig | null;
  /** Number of remaining setup items — drives the sidebar footer + mobile pill. */
  setupRemaining?: number;
}

const navItems: Array<{ id: View; label: string; icon: React.ReactNode }> = [
  { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard size={20} /> },
  { id: 'studio', label: 'Tailor', icon: <Sparkles size={20} /> },
  { id: 'vault', label: 'Vault', icon: <Archive size={20} /> },
  { id: 'settings', label: 'Settings', icon: <Settings size={20} /> },
];

const VIEW_TITLES: Record<View, string> = {
  dashboard: 'Dashboard',
  studio: 'Tailor',
  vault: 'Vault',
  settings: 'Settings',
};

export const AppShell = ({
  children,
  currentView,
  onNavigate,
  topRightSlot,
  mobileSetupSlot,
  config,
  setupRemaining = 0,
}: AppShellProps) => {
  const [activeProvider, setActiveProviderState] = useState<LlmProvider>(() => getActiveProvider());
  const [keyPresent, setKeyPresent] = useState<boolean>(() => hasActiveKey());

  useEffect(() => {
    return subscribeApiKey(() => {
      setActiveProviderState(getActiveProvider());
      setKeyPresent(hasActiveKey());
    });
  }, []);

  // Studio gets the full canvas; other views are capped for readability.
  const constrainContent = currentView !== 'studio';

  const profileName = config?.profile?.name?.trim();
  const profileEmail = config?.profile?.email?.trim();

  return (
    <div className="flex h-screen w-full bg-obsidian text-white overflow-hidden">
      {/* Desktop Sidebar — full width on lg+, narrow rail on md, hidden on small */}
      <aside className="hidden md:flex flex-col w-16 lg:w-60 h-full glass-panel border-r border-white/10 z-50">
        <div className="p-5 lg:p-6 flex items-center gap-3">
          <button
            type="button"
            onClick={() => onNavigate('studio')}
            className="w-9 h-9 rounded-xl bg-gradient-tailr flex items-center justify-center shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF4F00] focus-visible:ring-offset-2 focus-visible:ring-offset-[#050505]"
            aria-label="Tailr — go to Tailor"
          >
            <Sparkles className="text-white w-5 h-5" />
          </button>
          <div className="hidden lg:flex flex-col leading-tight">
            <span className="font-bold text-lg tracking-tight">Tailr</span>
            <span className="text-[10px] uppercase tracking-wider text-gray-500">
              Resume optimizer
            </span>
          </div>
        </div>

        <nav className="flex-1 px-2 lg:px-3 py-4 space-y-1">
          {navItems.map((item) => {
            const active = currentView === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onNavigate(item.id)}
                className={cn(
                  'w-full relative flex items-center gap-3 px-3 lg:px-4 py-2.5 rounded-xl transition-all duration-200 group',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF4F00] focus-visible:ring-offset-2 focus-visible:ring-offset-[#050505]',
                  active
                    ? 'bg-white/10 text-white'
                    : 'text-gray-400 hover:text-white hover:bg-white/5',
                )}
                title={item.label}
                aria-current={active ? 'page' : undefined}
              >
                {active && (
                  <motion.span
                    layoutId="activeNav"
                    transition={{ type: 'spring', stiffness: 400, damping: 35 }}
                    className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-6 bg-gradient-tailr rounded-r-full"
                  />
                )}
                <span className={cn('transition-colors shrink-0', active ? 'text-white' : 'text-gray-400 group-hover:text-white')}>
                  {item.icon}
                </span>
                <span className="font-medium hidden lg:block">{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Footer: profile + provider + setup pill */}
        <div className="p-2 lg:p-3 border-t border-white/5">
          <button
            type="button"
            onClick={() => onNavigate('settings')}
            className={cn(
              'w-full flex items-center gap-3 px-2 lg:px-3 py-2 rounded-xl transition-colors text-left',
              'hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF4F00]',
            )}
            aria-label="Open settings"
          >
            <div
              className={cn(
                'w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-xs font-bold',
                profileName ? 'bg-white/10 text-white' : 'bg-white/5 text-gray-400 border border-white/10 border-dashed',
              )}
            >
              {profileName ? profileName.charAt(0).toUpperCase() : '?'}
            </div>
            <div className="hidden lg:flex flex-col leading-tight min-w-0 flex-1">
              <span className="text-sm font-medium text-white truncate">
                {profileName || 'Set up profile'}
              </span>
              <span className="text-[10px] text-gray-500 truncate flex items-center gap-1">
                {keyPresent ? (
                  <>
                    <CheckCircle2 size={10} className="text-green-400 shrink-0" />
                    {PROVIDER_LABELS[activeProvider]}
                  </>
                ) : profileEmail ? (
                  profileEmail
                ) : (
                  'No provider configured'
                )}
              </span>
            </div>
            {setupRemaining > 0 && (
              <span
                className="hidden lg:inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-yellow-500/15 text-yellow-300 text-[10px] font-bold"
                aria-label={`${setupRemaining} setup steps remaining`}
              >
                <AlertTriangle size={10} />
                {setupRemaining}
              </span>
            )}
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 relative h-full overflow-hidden flex flex-col">
        {/* Mobile top app bar */}
        <header className="md:hidden sticky top-0 z-40 glass-panel border-b border-white/10 px-4 py-3 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => onNavigate('studio')}
            className="flex items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF4F00] rounded-lg"
            aria-label="Tailr home"
          >
            <span className="w-7 h-7 rounded-lg bg-gradient-tailr flex items-center justify-center">
              <Sparkles size={14} className="text-white" />
            </span>
            <span className="font-bold text-base text-white">{VIEW_TITLES[currentView]}</span>
          </button>
          <div className="flex items-center gap-2">
            {mobileSetupSlot}
          </div>
        </header>

        {/* Desktop floating slot (e.g. SetupBanner). Hidden on mobile. */}
        <div className="hidden md:block">{topRightSlot}</div>

        <div className={cn('flex-1 overflow-y-auto overflow-x-hidden p-3 md:p-6 lg:p-8')}>
          <AnimatePresence mode="wait">
            <motion.div
              key={currentView}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              className={cn(
                // pb-24 keeps content clear of the mobile bottom nav; on md+ there
                // is no bottom nav, so trim the trailing space to a small gutter.
                'min-h-full flex flex-col pb-24 md:pb-6 lg:pb-8',
                constrainContent ? 'max-w-7xl mx-auto w-full' : 'w-full',
              )}
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      {/* Mobile Bottom Nav */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 glass-panel border-t border-white/10 z-50 pb-safe">
        <div className="flex justify-around items-stretch px-2 pt-1 pb-1">
          {navItems.map((item) => {
            const active = currentView === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onNavigate(item.id)}
                aria-current={active ? 'page' : undefined}
                aria-label={item.label}
                className={cn(
                  'flex flex-col items-center justify-center gap-0.5 px-3 py-1.5 rounded-xl transition-colors min-w-[64px] min-h-[48px]',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF4F00]',
                  active ? 'text-white' : 'text-gray-500',
                )}
              >
                <div className={cn('p-1.5 rounded-lg transition-all', active ? 'bg-white/10' : 'bg-transparent')}>
                  {item.icon}
                </div>
                <span className="text-[11px] font-semibold tracking-wide">{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
