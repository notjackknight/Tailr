import React, { useCallback, useEffect, useState } from 'react';
import { AppShell } from './components/layout/AppShell';
import { SetupBanner } from './components/SetupBanner';
import { Dashboard } from './views/Dashboard';
import { Studio } from './views/Studio';
import { Settings } from './views/Settings';
import { fetchConfig } from './lib/api';
import { hasActiveKey, subscribeApiKey } from './lib/apiKey';
import type { AppConfig } from '../shared/types';

type View = 'dashboard' | 'studio' | 'settings';

export default function App() {
  const [currentView, setCurrentView] = useState<View>('dashboard');
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [keyPresent, setKeyPresent] = useState<boolean>(hasActiveKey());

  const refreshConfig = useCallback(async () => {
    try {
      const c = await fetchConfig(true);
      setConfig(c);
    } catch {
      // server may be down — leave config null and let views handle it
    }
  }, []);

  useEffect(() => {
    refreshConfig();
    return subscribeApiKey(() => setKeyPresent(hasActiveKey()));
  }, [refreshConfig]);

  return (
    <AppShell
      currentView={currentView}
      onNavigate={setCurrentView}
      topRightSlot={<SetupBanner config={config} hasApiKey={keyPresent} onNavigate={setCurrentView} />}
    >
      {currentView === 'dashboard' && (
        <Dashboard config={config} hasApiKey={keyPresent} onConfigChange={refreshConfig} />
      )}
      {currentView === 'studio' && <Studio config={config} hasApiKey={keyPresent} />}
      {currentView === 'settings' && <Settings />}
    </AppShell>
  );
}
