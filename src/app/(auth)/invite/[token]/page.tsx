"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../../convex/_generated/api";

export default function InvitePage() {
  const router = useRouter();
  const params = useParams();
  const token = params.token as string;

  const invite = useQuery(api.workerInvites.getInviteByToken, { token });
  const acceptInvite = useMutation(api.workerInvites.acceptInvite);

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
    emergencyContactName: "",
    emergencyContactPhone: "",
    emergencyContactRelationship: "",
  });
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // Pre-fill email if provided in invite
  useEffect(() => {
    if (invite?.email) {
      setFormData((prev) => ({ ...prev, email: invite.email! }));
    }
  }, [invite?.email]);

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
      await acceptInvite({
        token,
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
        password: formData.password,
        emergencyContact: {
          name: formData.emergencyContactName,
          phone: formData.emergencyContactPhone,
          relationship: formData.emergencyContactRelationship,
        },
      });

      // Store user ID and redirect
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to accept invite");
    } finally {
      setIsLoading(false);
    }
  };

  // Loading state
  if (invite === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-2 border-[var(--accent)] border-t-transparent rounded-full" />
      </div>
    );
  }

  // Invalid or expired invite
  if (!invite || invite.status === "expired" || invite.status === "accepted") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 py-12 relative">
        <div className="fixed inset-0 gradient-radial pointer-events-none" />

        <div className="w-full max-w-sm relative z-10 text-center">
          <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-8">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-500/10 flex items-center justify-center">
              <svg
                className="w-8 h-8 text-red-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </div>
            <h1 className="text-xl font-semibold mb-2">
              {invite?.status === "accepted"
                ? "Invite Already Used"
                : "Invite Expired"}
            </h1>
            <p className="text-[var(--foreground-muted)] text-sm mb-6">
              {invite?.status === "accepted"
                ? "This invite has already been accepted."
                : "This invite link has expired or is invalid."}
            </p>
            <Link href="/sign-in" className="btn-secondary inline-block">
              Go to Sign In
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const tradeLabels: Record<string, string> = {
    apprentice: "Apprentice",
    qualified: "Qualified Carpenter",
    leadingHand: "Leading Hand",
    foreman: "Foreman",
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 py-12 relative">
      {/* Background effects */}
      <div className="fixed inset-0 gradient-radial pointer-events-none" />
      <div className="fixed inset-0 gradient-spotlight pointer-events-none" />

      <div className="w-full max-w-md relative z-10">
        {/* Logo */}
        <div className="flex justify-center mb-8 opacity-0 animate-fade-in">
          <Image
            src="https://ryoxcarpentry.wordifysites.com/wp-content/uploads/2015/04/33333.png"
            alt="Ryox Carpentry"
            width={180}
            height={90}
            className="w-auto h-auto max-w-[180px] logo-glow"
            priority
          />
        </div>

        {/* Invite Info Card */}
        <div
          className="bg-[var(--accent)]/10 border border-[var(--accent)]/20 rounded-xl p-4 mb-6 opacity-0 animate-fade-in"
          style={{ animationDelay: "100ms" }}
        >
          <p className="text-sm text-center">
            You&apos;ve been invited to join{" "}
            <span className="font-semibold text-[var(--accent)]">
              {invite.organizationName}
            </span>{" "}
            as a {tradeLabels[invite.tradeClassification]}
          </p>
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
            Complete your profile
          </h1>
          <p className="text-[var(--foreground-muted)] text-center mb-8 text-sm">
            Enter your details to join the team
          </p>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Personal Info */}
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label
                  htmlFor="name"
                  className="block text-sm font-medium mb-2 text-[var(--foreground-muted)]"
                >
                  Full Name
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

              <div className="col-span-2 sm:col-span-1">
                <label
                  htmlFor="phone"
                  className="block text-sm font-medium mb-2 text-[var(--foreground-muted)]"
                >
                  Phone
                </label>
                <input
                  id="phone"
                  name="phone"
                  type="tel"
                  value={formData.phone}
                  onChange={handleChange}
                  className="w-full px-4 py-3 bg-[var(--background)] border border-[var(--border)] rounded-lg focus:outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)] transition-colors text-[var(--foreground)]"
                  placeholder="0400 123 456"
                  required
                />
              </div>
            </div>

            {/* Emergency Contact */}
            <div className="pt-2">
              <div className="text-xs uppercase tracking-wider text-[var(--foreground-muted)] mb-3 flex items-center gap-2">
                <div className="h-px flex-1 bg-[var(--border)]" />
                <span>Emergency Contact</span>
                <div className="h-px flex-1 bg-[var(--border)]" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 sm:col-span-1">
                <label
                  htmlFor="emergencyContactName"
                  className="block text-sm font-medium mb-2 text-[var(--foreground-muted)]"
                >
                  Contact Name
                </label>
                <input
                  id="emergencyContactName"
                  name="emergencyContactName"
                  type="text"
                  value={formData.emergencyContactName}
                  onChange={handleChange}
                  className="w-full px-4 py-3 bg-[var(--background)] border border-[var(--border)] rounded-lg focus:outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)] transition-colors text-[var(--foreground)]"
                  placeholder="Jane Smith"
                  required
                />
              </div>

              <div className="col-span-2 sm:col-span-1">
                <label
                  htmlFor="emergencyContactPhone"
                  className="block text-sm font-medium mb-2 text-[var(--foreground-muted)]"
                >
                  Contact Phone
                </label>
                <input
                  id="emergencyContactPhone"
                  name="emergencyContactPhone"
                  type="tel"
                  value={formData.emergencyContactPhone}
                  onChange={handleChange}
                  className="w-full px-4 py-3 bg-[var(--background)] border border-[var(--border)] rounded-lg focus:outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)] transition-colors text-[var(--foreground)]"
                  placeholder="0400 987 654"
                  required
                />
              </div>

              <div className="col-span-2">
                <label
                  htmlFor="emergencyContactRelationship"
                  className="block text-sm font-medium mb-2 text-[var(--foreground-muted)]"
                >
                  Relationship
                </label>
                <input
                  id="emergencyContactRelationship"
                  name="emergencyContactRelationship"
                  type="text"
                  value={formData.emergencyContactRelationship}
                  onChange={handleChange}
                  className="w-full px-4 py-3 bg-[var(--background)] border border-[var(--border)] rounded-lg focus:outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)] transition-colors text-[var(--foreground)]"
                  placeholder="Partner, Parent, etc."
                  required
                />
              </div>
            </div>

            {/* Password */}
            <div className="pt-2">
              <div className="text-xs uppercase tracking-wider text-[var(--foreground-muted)] mb-3 flex items-center gap-2">
                <div className="h-px flex-1 bg-[var(--border)]" />
                <span>Create Password</span>
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
                  Joining team...
                </span>
              ) : (
                "Join Team"
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
