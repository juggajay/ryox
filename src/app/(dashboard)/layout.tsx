"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Sidebar } from "@/components/sidebar";
import { MobileNav } from "@/components/mobile-nav";
import { MobileHeader } from "@/components/mobile-header";
import { useAuth } from "@/lib/auth-context";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { user, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/sign-in");
    }
  }, [user, isLoading, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-2 border-[var(--accent)] border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-[var(--background)]">
      {/* Desktop Sidebar - hidden on mobile */}
      <div className="hidden md:block">
        <Sidebar />
      </div>

      {/* Mobile Header - visible on mobile only */}
      <MobileHeader />

      {/* Main content area */}
      <main className="
        md:ml-64 md:p-8
        pt-[calc(4rem+env(safe-area-inset-top,0px))]
        pb-[calc(5rem+env(safe-area-inset-bottom,0px))]
        px-4
        md:pt-8 md:pb-8
      ">
        {children}
      </main>

      {/* Mobile Bottom Navigation - visible on mobile only */}
      <MobileNav />
    </div>
  );
}
