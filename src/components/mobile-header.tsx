"use client";

import Image from "next/image";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";

export function MobileHeader() {
  const { user, signOut } = useAuth();

  return (
    <header className="fixed top-0 left-0 right-0 z-50 md:hidden">
      {/* Blur backdrop */}
      <div className="absolute inset-0 bg-[#0a0a0a]/90 backdrop-blur-xl border-b border-[var(--border)]" />

      {/* Content with safe area */}
      <div className="relative flex items-center justify-between px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3">
        {/* Logo */}
        <Link href="/dashboard" className="flex items-center">
          <Image
            src="https://ryoxcarpentry.wordifysites.com/wp-content/uploads/2015/04/33333.png"
            alt="CarpTrack"
            width={100}
            height={50}
            className="w-auto h-8"
            priority
          />
        </Link>

        {/* User avatar dropdown */}
        <button
          onClick={signOut}
          className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--card)] border border-[var(--border)] active:scale-95 transition-transform"
        >
          <div className="w-6 h-6 rounded-full bg-[var(--accent)]/20 flex items-center justify-center">
            <span className="text-[var(--accent)] text-xs font-semibold">
              {user?.name?.charAt(0).toUpperCase() || "?"}
            </span>
          </div>
          <svg
            className="w-4 h-4 text-[var(--foreground-muted)]"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9"
            />
          </svg>
        </button>
      </div>
    </header>
  );
}
