'use client';

export default function OfflinePage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[var(--background)] p-4">
      <div className="text-6xl mb-4">📡</div>
      <h1 className="text-2xl font-display font-bold text-[var(--foreground)] mb-2">
        You&apos;re Offline
      </h1>
      <p className="text-[var(--muted-foreground)] text-center max-w-md">
        CarpTrack needs an internet connection to sync your data.
        Check your connection and try again.
      </p>
      <button
        onClick={() => window.location.reload()}
        className="mt-6 px-6 py-3 bg-[var(--accent)] text-[var(--accent-foreground)] rounded-lg font-medium"
      >
        Try Again
      </button>
    </div>
  );
}
