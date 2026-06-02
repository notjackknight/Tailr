import React, { useCallback, useEffect, useState } from 'react';
import { AnimatePresence } from 'motion/react';
import { AppShell } from './components/layout/AppShell';
import { SetupBanner, type SetupView } from './components/SetupBanner';
import { Dashboard } from './views/Dashboard';
import { Studio } from './views/Studio';
import { Settings } from './views/Settings';
import { Vault } from './views/Vault';
import { fetchConfig } from './lib/api';
import { hasActiveKey, subscribeApiKey } from './lib/apiKey';
import { ToastProvider } from './components/ui/Toast';
import { WelcomeWizard } from './components/modals/WelcomeWizard';
import type { AppConfig } from '../shared/types';

type View = 'dashboard' | 'studio' | 'settings' | 'vault';

const WIZARD_DISMISSED_KEY = 'tailr.wizardDismissed';

export default function App() {
  const [currentView, setCurrentView] = useState<View>('studio');
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [keyPresent, setKeyPresent] = useState<boolean>(hasActiveKey());
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardDismissed, setWizardDismissed] = useState<boolean>(() => {
    try {
      return localStorage.getItem(WIZARD_DISMISSED_KEY) === '1';
    } catch {
      return false;
    }
  });

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

  // Auto-open the first-run wizard the first time we meet a half-set-up state.
  useEffect(() => {
    if (!config) return;
    const setupComplete =
      keyPresent && config.profileConfigured && config.masterResumePresent;
    if (setupComplete || wizardDismissed) return;
    setWizardOpen(true);
  }, [config, keyPresent, wizardDismissed]);

  const setupRemaining = config
    ? (keyPresent ? 0 : 1) +
      (config.profileConfigured ? 0 : 1) +
      (config.masterResumePresent ? 0 : 1)
    : 0;

  const handleSetupNavigate = (view: SetupView) => setCurrentView(view as View);

  const dismissWizard = () => {
    try {
      localStorage.setItem(WIZARD_DISMISSED_KEY, '1');
    } catch { /* private mode etc. */ }
    setWizardDismissed(true);
    setWizardOpen(false);
  };

  const launchWizard = () => {
    setWizardDismissed(false);
    try {
      localStorage.removeItem(WIZARD_DISMISSED_KEY);
    } catch { /* ignore */ }
    setWizardOpen(true);
  };

  const setupBanner = (
    <SetupBanner
      config={config}
      hasApiKey={keyPresent}
      onNavigate={handleSetupNavigate}
      onLaunchWizard={launchWizard}
    />
  );

  const mobileSetupBanner = (
    <SetupBanner
      config={config}
      hasApiKey={keyPresent}
      onNavigate={handleSetupNavigate}
      onLaunchWizard={launchWizard}
      inline
    />
  );

  return (
    <>
      <AppShell
        currentView={currentView}
        onNavigate={setCurrentView}
        topRightSlot={setupBanner}
        mobileSetupSlot={setupRemaining > 0 ? mobileSetupBanner : undefined}
        config={config}
        setupRemaining={setupRemaining}
      >
        {currentView === 'dashboard' && (
          <Dashboard config={config} hasApiKey={keyPresent} onConfigChange={refreshConfig} onNavigate={setCurrentView} />
        )}
        {currentView === 'studio' && <Studio config={config} hasApiKey={keyPresent} onNavigate={setCurrentView} />}
        {currentView === 'vault' && <Vault config={config} onNavigate={setCurrentView} />}
        {currentView === 'settings' && <Settings />}
      </AppShell>

      <AnimatePresence>
        {wizardOpen && (
          <WelcomeWizard
            config={config}
            hasApiKey={keyPresent}
            onClose={dismissWizard}
            onProgress={refreshConfig}
            onComplete={() => {
              dismissWizard();
              setCurrentView('studio');
            }}
          />
        )}
      </AnimatePresence>

      <ToastProvider />
    </>
  );
}
