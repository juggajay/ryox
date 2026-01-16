'use client';

import { useState, useEffect } from 'react';
import { X, Share, PlusSquare } from 'lucide-react';
import { usePWAInstall } from '@/hooks/use-pwa-install';

const STORAGE_KEY = 'carptrack_ios_prompt_dismissed';
const VISIT_COUNT_KEY = 'carptrack_visit_count';
const MIN_VISITS = 3;

export function IOSInstallPrompt() {
  const { isIOS, isStandalone } = usePWAInstall();
  const [show, setShow] = useState(false);

  useEffect(() => {
    // Don't show if not iOS, already installed, or previously dismissed
    if (!isIOS || isStandalone) return;
    if (localStorage.getItem(STORAGE_KEY)) return;

    // Track visits, only show after MIN_VISITS
    const visits = parseInt(localStorage.getItem(VISIT_COUNT_KEY) || '0') + 1;
    localStorage.setItem(VISIT_COUNT_KEY, visits.toString());

    if (visits >= MIN_VISITS) {
      // Delay showing to not interrupt immediately
      const timer = setTimeout(() => setShow(true), 2000);
      return () => clearTimeout(timer);
    }
  }, [isIOS, isStandalone]);

  const dismiss = () => {
    localStorage.setItem(STORAGE_KEY, 'true');
    setShow(false);
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

      <h3 className="font-display font-semibold text-[var(--foreground)] mb-2">
        Install CarpTrack
      </h3>

      <p className="text-sm text-[var(--muted-foreground)] mb-4">
        Add to your home screen for quick access and to stay logged in.
      </p>

      <div className="space-y-3 text-sm">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[var(--secondary)] flex items-center justify-center">
            <Share className="w-4 h-4 text-[var(--accent)]" />
          </div>
          <span className="text-[var(--foreground)]">
            Tap the <strong>Share</strong> button
          </span>
        </div>

        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[var(--secondary)] flex items-center justify-center">
            <PlusSquare className="w-4 h-4 text-[var(--accent)]" />
          </div>
          <span className="text-[var(--foreground)]">
            Tap <strong>Add to Home Screen</strong>
          </span>
        </div>
      </div>

      <button
        onClick={dismiss}
        className="mt-4 w-full py-2 text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
      >
        Maybe later
      </button>
    </div>
  );
}
