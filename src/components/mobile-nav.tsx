"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useState } from "react";

const workerNavItems = [
  {
    name: "Home",
    href: "/dashboard",
    icon: (active: boolean) => (
      <svg
        className="w-6 h-6"
        fill={active ? "currentColor" : "none"}
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={active ? 0 : 1.5}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25"
        />
      </svg>
    ),
  },
  {
    name: "Timesheets",
    href: "/timesheets",
    icon: (active: boolean) => (
      <svg
        className="w-6 h-6"
        fill={active ? "currentColor" : "none"}
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={active ? 0 : 1.5}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
    ),
  },
  {
    name: "Chat",
    href: "/chat",
    icon: (active: boolean) => (
      <svg
        className="w-6 h-6"
        fill={active ? "currentColor" : "none"}
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={active ? 0 : 1.5}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z"
        />
      </svg>
    ),
  },
  {
    name: "AI Help",
    href: "/knowledge",
    icon: (active: boolean) => (
      <svg
        className="w-6 h-6"
        fill={active ? "currentColor" : "none"}
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={active ? 0 : 1.5}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z"
        />
      </svg>
    ),
  },
];

const ownerMenuItems = [
  { name: "Workers", href: "/workers", icon: "👷" },
  { name: "Builders", href: "/builders", icon: "🏗️" },
  { name: "Jobs", href: "/jobs", icon: "📋" },
  { name: "Invoices", href: "/invoices", icon: "💰" },
  { name: "Expenses", href: "/expenses", icon: "🧾" },
  { name: "Reports", href: "/reports", icon: "📊" },
  { name: "Settings", href: "/settings", icon: "⚙️" },
];

export function MobileNav() {
  const pathname = usePathname();
  const { user } = useAuth();
  const [showOwnerMenu, setShowOwnerMenu] = useState(false);

  const isOwner = user?.role === "owner";

  // Check if current path is an owner-only page
  const isOnOwnerPage = ownerMenuItems.some(item => pathname.startsWith(item.href));

  return (
    <>
      {/* Owner Menu Overlay */}
      {showOwnerMenu && (
        <div
          className="fixed inset-0 z-40 md:hidden"
          onClick={() => setShowOwnerMenu(false)}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

          {/* Menu Panel */}
          <div
            className="absolute bottom-[4.5rem] left-4 right-4 bg-[var(--card)] border border-[var(--border)] rounded-2xl p-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="grid grid-cols-3 gap-3">
              {ownerMenuItems.map((item) => (
                <Link
                  key={item.name}
                  href={item.href}
                  onClick={() => setShowOwnerMenu(false)}
                  className={`
                    flex flex-col items-center justify-center p-4 rounded-xl
                    transition-all active:scale-95
                    ${pathname.startsWith(item.href)
                      ? "bg-[var(--accent)] text-[var(--background)]"
                      : "bg-[var(--secondary)] text-[var(--foreground)] hover:bg-[var(--border)]"
                    }
                  `}
                >
                  <span className="text-2xl mb-1">{item.icon}</span>
                  <span className="text-xs font-medium">{item.name}</span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden">
        {/* Blur backdrop */}
        <div className="absolute inset-0 bg-[#0a0a0a]/90 backdrop-blur-xl border-t border-[var(--border)]" />

        {/* Safe area spacer for notched phones */}
        <div className="relative flex items-center justify-around px-2 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
          {workerNavItems.map((item) => {
            const isActive = pathname === item.href ||
              (item.href === "/dashboard" && pathname === "/");

            return (
              <Link
                key={item.name}
                href={item.href}
                className={`
                  flex flex-col items-center justify-center
                  min-w-[4rem] py-2 px-2 rounded-2xl
                  transition-all duration-200 ease-out
                  ${isActive
                    ? "text-[var(--accent)] scale-105"
                    : "text-[var(--foreground-muted)] active:scale-95"
                  }
                `}
              >
                {/* Icon container with glow effect when active */}
                <div className={`
                  relative flex items-center justify-center
                  ${isActive ? "drop-shadow-[0_0_8px_rgba(212,165,116,0.5)]" : ""}
                `}>
                  {item.icon(isActive)}

                  {/* Active indicator dot */}
                  {isActive && (
                    <span className="absolute -bottom-1 w-1 h-1 rounded-full bg-[var(--accent)]" />
                  )}
                </div>

                {/* Label */}
                <span className={`
                  text-[0.65rem] mt-1 font-medium tracking-wide
                  ${isActive ? "text-[var(--accent)]" : ""}
                `}>
                  {item.name}
                </span>
              </Link>
            );
          })}

          {/* Owner "More" button */}
          {isOwner && (
            <button
              onClick={() => setShowOwnerMenu(!showOwnerMenu)}
              className={`
                flex flex-col items-center justify-center
                min-w-[4rem] py-2 px-2 rounded-2xl
                transition-all duration-200 ease-out
                ${showOwnerMenu || isOnOwnerPage
                  ? "text-[var(--accent)] scale-105"
                  : "text-[var(--foreground-muted)] active:scale-95"
                }
              `}
            >
              <div className={`
                relative flex items-center justify-center
                ${showOwnerMenu || isOnOwnerPage ? "drop-shadow-[0_0_8px_rgba(212,165,116,0.5)]" : ""}
              `}>
                <svg
                  className="w-6 h-6"
                  fill={showOwnerMenu || isOnOwnerPage ? "currentColor" : "none"}
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={showOwnerMenu || isOnOwnerPage ? 0 : 1.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5"
                  />
                </svg>

                {(showOwnerMenu || isOnOwnerPage) && (
                  <span className="absolute -bottom-1 w-1 h-1 rounded-full bg-[var(--accent)]" />
                )}
              </div>

              <span className={`
                text-[0.65rem] mt-1 font-medium tracking-wide
                ${showOwnerMenu || isOnOwnerPage ? "text-[var(--accent)]" : ""}
              `}>
                More
              </span>
            </button>
          )}
        </div>
      </nav>
    </>
  );
}
