"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { useAuth } from "@/lib/auth-context";

export default function SignUpPage() {
  const router = useRouter();
  const { signUp } = useAuth();
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
    organizationName: "",
    abn: "",
  });
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (formData.password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    setIsLoading(true);

    try {
      await signUp({
        name: formData.name,
        email: formData.email,
        password: formData.password,
        organizationName: formData.organizationName,
        abn: formData.abn,
      });
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create account");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 py-12 relative">
      {/* Background effects */}
      <div className="fixed inset-0 gradient-radial pointer-events-none" />
      <div className="fixed inset-0 gradient-spotlight pointer-events-none" />

      <div className="w-full max-w-md relative z-10">
        {/* Logo */}
        <div className="flex justify-center mb-8 opacity-0 animate-fade-in">
          <Link href="/">
            <Image
              src="https://ryoxcarpentry.wordifysites.com/wp-content/uploads/2015/04/33333.png"
              alt="Ryox Carpentry"
              width={180}
              height={90}
              className="w-auto h-auto max-w-[180px] logo-glow"
              priority
            />
          </Link>
        </div>

        {/* Form Card */}
        <div
          className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-8 opacity-0 animate-fade-in-up"
          style={{ animationDelay: "150ms" }}
        >
          <h1
            className="text-2xl font-semibold text-center mb-2"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Create your account
          </h1>
          <p className="text-[var(--foreground-muted)] text-center mb-8 text-sm">
            Set up your business on CarpTrack
          </p>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Personal Info */}
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 sm:col-span-1">
                <label
                  htmlFor="name"
                  className="block text-sm font-medium mb-2 text-[var(--foreground-muted)]"
                >
                  Your Name
                </label>
                <input
                  id="name"
                  name="name"
                  type="text"
                  value={formData.name}
                  onChange={handleChange}
                  className="w-full px-4 py-3 bg-[var(--background)] border border-[var(--border)] rounded-lg focus:outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)] transition-colors text-[var(--foreground)]"
                  placeholder="John Smith"
                  required
                />
              </div>

              <div className="col-span-2 sm:col-span-1">
                <label
                  htmlFor="email"
                  className="block text-sm font-medium mb-2 text-[var(--foreground-muted)]"
                >
                  Email
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={handleChange}
                  className="w-full px-4 py-3 bg-[var(--background)] border border-[var(--border)] rounded-lg focus:outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)] transition-colors text-[var(--foreground)]"
                  placeholder="you@example.com"
                  required
                />
              </div>
            </div>

            {/* Business Info */}
            <div className="pt-2">
              <div className="text-xs uppercase tracking-wider text-[var(--foreground-muted)] mb-3 flex items-center gap-2">
                <div className="h-px flex-1 bg-[var(--border)]" />
                <span>Business Details</span>
                <div className="h-px flex-1 bg-[var(--border)]" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 sm:col-span-1">
                <label
                  htmlFor="organizationName"
                  className="block text-sm font-medium mb-2 text-[var(--foreground-muted)]"
                >
                  Business Name
                </label>
                <input
                  id="organizationName"
                  name="organizationName"
                  type="text"
                  value={formData.organizationName}
                  onChange={handleChange}
                  className="w-full px-4 py-3 bg-[var(--background)] border border-[var(--border)] rounded-lg focus:outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)] transition-colors text-[var(--foreground)]"
                  placeholder="Smith Carpentry"
                  required
                />
              </div>

              <div className="col-span-2 sm:col-span-1">
                <label
                  htmlFor="abn"
                  className="block text-sm font-medium mb-2 text-[var(--foreground-muted)]"
                >
                  ABN
                </label>
                <input
                  id="abn"
                  name="abn"
                  type="text"
                  value={formData.abn}
                  onChange={handleChange}
                  className="w-full px-4 py-3 bg-[var(--background)] border border-[var(--border)] rounded-lg focus:outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)] transition-colors text-[var(--foreground)]"
                  placeholder="12 345 678 901"
                  required
                />
              </div>
            </div>

            {/* Password */}
            <div className="pt-2">
              <div className="text-xs uppercase tracking-wider text-[var(--foreground-muted)] mb-3 flex items-center gap-2">
                <div className="h-px flex-1 bg-[var(--border)]" />
                <span>Security</span>
                <div className="h-px flex-1 bg-[var(--border)]" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 sm:col-span-1">
                <label
                  htmlFor="password"
                  className="block text-sm font-medium mb-2 text-[var(--foreground-muted)]"
                >
                  Password
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  value={formData.password}
                  onChange={handleChange}
                  className="w-full px-4 py-3 bg-[var(--background)] border border-[var(--border)] rounded-lg focus:outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)] transition-colors text-[var(--foreground)]"
                  placeholder="••••••••"
                  required
                />
              </div>

              <div className="col-span-2 sm:col-span-1">
                <label
                  htmlFor="confirmPassword"
                  className="block text-sm font-medium mb-2 text-[var(--foreground-muted)]"
                >
                  Confirm Password
                </label>
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  className="w-full px-4 py-3 bg-[var(--background)] border border-[var(--border)] rounded-lg focus:outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)] transition-colors text-[var(--foreground)]"
                  placeholder="••••••••"
                  required
                />
              </div>
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg
                    className="animate-spin h-4 w-4"
                    viewBox="0 0 24 24"
                    fill="none"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  Creating account...
                </span>
              ) : (
                "Create Account"
              )}
            </button>
          </form>
        </div>

        {/* Sign in link */}
        <p
          className="text-center mt-6 text-[var(--foreground-muted)] text-sm opacity-0 animate-fade-in"
          style={{ animationDelay: "300ms" }}
        >
          Already have an account?{" "}
          <Link
            href="/sign-in"
            className="text-[var(--accent)] hover:underline font-medium"
          >
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
