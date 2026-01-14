"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { useAuth } from "@/lib/auth-context";
import { api } from "../../../../convex/_generated/api";

function AddBuilderModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const { user } = useAuth();
  const createBuilder = useMutation(api.builders.create);

  const [formData, setFormData] = useState({
    companyName: "",
    abn: "",
    paymentTerms: "30",
    notes: "",
    contactName: "",
    contactPhone: "",
    contactEmail: "",
    contactRole: "Project Manager",
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setError("");
    setIsLoading(true);

    try {
      await createBuilder({
        userId: user._id,
        companyName: formData.companyName,
        abn: formData.abn,
        paymentTerms: parseInt(formData.paymentTerms),
        notes: formData.notes || undefined,
        primaryContact: formData.contactName
          ? {
              name: formData.contactName,
              phone: formData.contactPhone,
              email: formData.contactEmail,
              role: formData.contactRole,
            }
          : undefined,
      });
      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create builder");
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setFormData({
      companyName: "",
      abn: "",
      paymentTerms: "30",
      notes: "",
      contactName: "",
      contactPhone: "",
      contactEmail: "",
      contactRole: "Project Manager",
    });
    setError("");
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={handleClose}
      />
      <div className="relative bg-[var(--card)] border border-[var(--border)] rounded-xl w-full max-w-lg mx-4 p-6 max-h-[90vh] overflow-y-auto">
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 text-[var(--foreground-muted)] hover:text-[var(--foreground)]"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <h2 className="text-xl font-semibold mb-6" style={{ fontFamily: "var(--font-display)" }}>
          Add Builder
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2 text-[var(--foreground-muted)]">
              Company Name
            </label>
            <input
              type="text"
              value={formData.companyName}
              onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
              className="w-full px-4 py-3 bg-[var(--background)] border border-[var(--border)] rounded-lg focus:outline-none focus:border-[var(--accent)] text-[var(--foreground)]"
              placeholder="ABC Builders Pty Ltd"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2 text-[var(--foreground-muted)]">
                ABN
              </label>
              <input
                type="text"
                value={formData.abn}
                onChange={(e) => setFormData({ ...formData, abn: e.target.value })}
                className="w-full px-4 py-3 bg-[var(--background)] border border-[var(--border)] rounded-lg focus:outline-none focus:border-[var(--accent)] text-[var(--foreground)]"
                placeholder="12 345 678 901"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2 text-[var(--foreground-muted)]">
                Payment Terms (days)
              </label>
              <select
                value={formData.paymentTerms}
                onChange={(e) => setFormData({ ...formData, paymentTerms: e.target.value })}
                className="w-full px-4 py-3 bg-[var(--background)] border border-[var(--border)] rounded-lg focus:outline-none focus:border-[var(--accent)] text-[var(--foreground)]"
              >
                <option value="7">7 days</option>
                <option value="14">14 days</option>
                <option value="30">30 days</option>
                <option value="60">60 days</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2 text-[var(--foreground-muted)]">
              Notes
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="w-full px-4 py-3 bg-[var(--background)] border border-[var(--border)] rounded-lg focus:outline-none focus:border-[var(--accent)] text-[var(--foreground)] resize-none"
              rows={2}
              placeholder="Any special requirements or notes..."
            />
          </div>

          <div className="pt-2">
            <div className="text-xs uppercase tracking-wider text-[var(--foreground-muted)] mb-3 flex items-center gap-2">
              <div className="h-px flex-1 bg-[var(--border)]" />
              <span>Primary Contact (Optional)</span>
              <div className="h-px flex-1 bg-[var(--border)]" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2 text-[var(--foreground-muted)]">
                Contact Name
              </label>
              <input
                type="text"
                value={formData.contactName}
                onChange={(e) => setFormData({ ...formData, contactName: e.target.value })}
                className="w-full px-4 py-3 bg-[var(--background)] border border-[var(--border)] rounded-lg focus:outline-none focus:border-[var(--accent)] text-[var(--foreground)]"
                placeholder="John Doe"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2 text-[var(--foreground-muted)]">
                Role
              </label>
              <input
                type="text"
                value={formData.contactRole}
                onChange={(e) => setFormData({ ...formData, contactRole: e.target.value })}
                className="w-full px-4 py-3 bg-[var(--background)] border border-[var(--border)] rounded-lg focus:outline-none focus:border-[var(--accent)] text-[var(--foreground)]"
                placeholder="Project Manager"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2 text-[var(--foreground-muted)]">
                Phone
              </label>
              <input
                type="tel"
                value={formData.contactPhone}
                onChange={(e) => setFormData({ ...formData, contactPhone: e.target.value })}
                className="w-full px-4 py-3 bg-[var(--background)] border border-[var(--border)] rounded-lg focus:outline-none focus:border-[var(--accent)] text-[var(--foreground)]"
                placeholder="0400 123 456"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2 text-[var(--foreground-muted)]">
                Email
              </label>
              <input
                type="email"
                value={formData.contactEmail}
                onChange={(e) => setFormData({ ...formData, contactEmail: e.target.value })}
                className="w-full px-4 py-3 bg-[var(--background)] border border-[var(--border)] rounded-lg focus:outline-none focus:border-[var(--accent)] text-[var(--foreground)]"
                placeholder="john@builder.com"
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
            className="btn-primary w-full disabled:opacity-50"
          >
            {isLoading ? "Creating..." : "Add Builder"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function BuildersPage() {
  const { user } = useAuth();
  const [showAddModal, setShowAddModal] = useState(false);

  const builders = useQuery(api.builders.list, user ? { userId: user._id } : "skip");

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-semibold mb-2" style={{ fontFamily: "var(--font-display)" }}>
            Builders
          </h1>
          <p className="text-[var(--foreground-muted)]">
            Manage your client relationships
          </p>
        </div>
        <button onClick={() => setShowAddModal(true)} className="btn-primary">
          Add Builder
        </button>
      </div>

      {!builders || builders.length === 0 ? (
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-12 text-center">
          <svg
            className="w-16 h-16 mx-auto mb-4 text-[var(--foreground-muted)] opacity-50"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5"
            />
          </svg>
          <p className="text-[var(--foreground-muted)] mb-4">
            No builders yet. Add your first client!
          </p>
          <button onClick={() => setShowAddModal(true)} className="btn-primary">
            Add Builder
          </button>
        </div>
      ) : (
        <div className="grid gap-4">
          {builders.map((builder) => (
            <div
              key={builder._id}
              className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-6"
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold mb-1">{builder.companyName}</h3>
                  <p className="text-sm text-[var(--foreground-muted)]">
                    ABN: {builder.abn}
                  </p>
                </div>
                <span
                  className={`text-xs px-3 py-1 rounded-full ${
                    builder.status === "active"
                      ? "bg-green-500/10 text-green-400"
                      : "bg-gray-500/10 text-gray-400"
                  }`}
                >
                  {builder.status === "active" ? "Active" : "Inactive"}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-4 mb-4">
                <div>
                  <p className="text-xs text-[var(--foreground-muted)] mb-1">Payment Terms</p>
                  <p className="font-medium">{builder.paymentTerms} days</p>
                </div>
                <div>
                  <p className="text-xs text-[var(--foreground-muted)] mb-1">Active Jobs</p>
                  <p className="font-medium">{builder.stats.activeJobs}</p>
                </div>
                <div>
                  <p className="text-xs text-[var(--foreground-muted)] mb-1">Total Jobs</p>
                  <p className="font-medium">{builder.stats.totalJobs}</p>
                </div>
              </div>

              {builder.contacts.length > 0 && (
                <div className="pt-4 border-t border-[var(--border)]">
                  <p className="text-xs text-[var(--foreground-muted)] mb-2">Contacts</p>
                  <div className="flex flex-wrap gap-2">
                    {builder.contacts.map((contact) => (
                      <span
                        key={contact._id}
                        className="text-sm px-3 py-1 bg-[var(--background)] rounded-full"
                      >
                        {contact.name} • {contact.role}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <AddBuilderModal isOpen={showAddModal} onClose={() => setShowAddModal(false)} />
    </div>
  );
}
