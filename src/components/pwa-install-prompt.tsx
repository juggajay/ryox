'use client';

import { useState, useEffect } from 'react';
import { X, Download } from 'lucide-react';
import { usePWAInstall } from '@/hooks/use-pwa-install';

const STORAGE_KEY = 'carptrack_pwa_prompt_dismissed';
const VISIT_COUNT_KEY = 'carptrack_visit_count';
const MIN_VISITS = 3;

export function PWAInstallPrompt() {
  const { canInstall, isInstalled, isIOS, promptInstall } = usePWAInstall();
  const [show, setShow] = useState(false);

  useEffect(() => {
    // Don't show on iOS (has its own prompt), if installed, or if can't install
    if (isIOS || isInstalled || !canInstall) return;
    if (localStorage.getItem(STORAGE_KEY)) return;

    // Track visits, only show after MIN_VISITS
    const visits = parseInt(localStorage.getItem(VISIT_COUNT_KEY) || '0');
    if (visits >= MIN_VISITS) {
      const timer = setTimeout(() => setShow(true), 2000);
      return () => clearTimeout(timer);
    }
  }, [canInstall, isInstalled, isIOS]);

  const dismiss = () => {
    localStorage.setItem(STORAGE_KEY, 'true');
    setShow(false);
  };

  const handleInstall = async () => {
    const accepted = await promptInstall();
    if (!accepted) {
      dismiss();
    }
  };

  if (!show) return null;

  return (
    <div className="fixed bottom-20 left-4 right-4 md:left-auto md:right-4 md:w-80 bg-[var(--card)] border border-[var(--border)] rounded-xl p-4 shadow-lg z-50 animate-in slide-in-from-bottom">
      <button
        onClick={dismiss}
        className="absolute top-2 right-2 p-1 text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
      >
        <X className="w-4 h-4" />
      </button>

      <div className="flex items-start gap-3">
        <div className="w-12 h-12 rounded-xl bg-[var(--secondary)] flex items-center justify-center flex-shrink-0">
          <Download className="w-6 h-6 text-[var(--accent)]" />
        </div>

        <div>
          <h3 className="font-display font-semibold text-[var(--foreground)]">
            Install CarpTrack
          </h3>
          <p className="text-sm text-[var(--muted-foreground)] mt-1">
            Quick access from your home screen
          </p>
        </div>
      </div>

      <div className="flex gap-2 mt-4">
        <button
          onClick={dismiss}
          className="flex-1 py-2 text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)] border border-[var(--border)] rounded-lg"
        >
          Not now
        </button>
        <button
          onClick={handleInstall}
          className="flex-1 py-2 text-sm bg-[var(--accent)] text-[var(--accent-foreground)] rounded-lg font-medium"
        >
          Install
        </button>
      </div>
    </div>
  );
}
