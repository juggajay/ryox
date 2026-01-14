"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { useAuth } from "@/lib/auth-context";
import { api } from "../../../../convex/_generated/api";

function InviteWorkerModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const { user } = useAuth();
  const createInvite = useMutation(api.workerInvites.createInvite);

  const [formData, setFormData] = useState({
    email: "",
    payRate: "",
    chargeOutRate: "",
    employmentType: "employee" as "employee" | "subcontractor",
    tradeClassification: "qualified" as
      | "apprentice"
      | "qualified"
      | "leadingHand"
      | "foreman",
  });
  const [inviteLink, setInviteLink] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setError("");
    setIsLoading(true);

    try {
      const result = await createInvite({
        createdBy: user._id,
        email: formData.email || undefined,
        payRate: parseFloat(formData.payRate),
        chargeOutRate: parseFloat(formData.chargeOutRate),
        employmentType: formData.employmentType,
        tradeClassification: formData.tradeClassification,
      });

      const link = `${window.location.origin}/invite/${result.token}`;
      setInviteLink(link);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create invite");
    } finally {
      setIsLoading(false);
    }
  };

  const copyLink = () => {
    navigator.clipboard.writeText(inviteLink);
  };

  const handleClose = () => {
    setFormData({
      email: "",
      payRate: "",
      chargeOutRate: "",
      employmentType: "employee",
      tradeClassification: "qualified",
    });
    setInviteLink("");
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
      <div className="relative bg-[var(--card)] border border-[var(--border)] rounded-xl w-full max-w-md mx-4 p-6">
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 text-[var(--foreground-muted)] hover:text-[var(--foreground)]"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <h2 className="text-xl font-semibold mb-6" style={{ fontFamily: "var(--font-display)" }}>
          Invite Worker
        </h2>

        {inviteLink ? (
          <div>
            <p className="text-[var(--foreground-muted)] mb-4">
              Share this link with your worker to let them create their account:
            </p>
            <div className="bg-[var(--background)] border border-[var(--border)] rounded-lg p-3 mb-4">
              <p className="text-sm break-all font-mono">{inviteLink}</p>
            </div>
            <div className="flex gap-3">
              <button onClick={copyLink} className="btn-primary flex-1">
                Copy Link
              </button>
              <button onClick={handleClose} className="btn-secondary flex-1">
                Done
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2 text-[var(--foreground-muted)]">
                Worker Email (optional)
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-4 py-3 bg-[var(--background)] border border-[var(--border)] rounded-lg focus:outline-none focus:border-[var(--accent)] text-[var(--foreground)]"
                placeholder="worker@example.com"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2 text-[var(--foreground-muted)]">
                  Pay Rate ($/hr)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.payRate}
                  onChange={(e) => setFormData({ ...formData, payRate: e.target.value })}
                  className="w-full px-4 py-3 bg-[var(--background)] border border-[var(--border)] rounded-lg focus:outline-none focus:border-[var(--accent)] text-[var(--foreground)]"
                  placeholder="45.00"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2 text-[var(--foreground-muted)]">
                  Charge Out Rate ($/hr)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.chargeOutRate}
                  onChange={(e) => setFormData({ ...formData, chargeOutRate: e.target.value })}
                  className="w-full px-4 py-3 bg-[var(--background)] border border-[var(--border)] rounded-lg focus:outline-none focus:border-[var(--accent)] text-[var(--foreground)]"
                  placeholder="75.00"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2 text-[var(--foreground-muted)]">
                Employment Type
              </label>
              <select
                value={formData.employmentType}
                onChange={(e) => setFormData({ ...formData, employmentType: e.target.value as any })}
                className="w-full px-4 py-3 bg-[var(--background)] border border-[var(--border)] rounded-lg focus:outline-none focus:border-[var(--accent)] text-[var(--foreground)]"
              >
                <option value="employee">Employee</option>
                <option value="subcontractor">Subcontractor</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2 text-[var(--foreground-muted)]">
                Trade Classification
              </label>
              <select
                value={formData.tradeClassification}
                onChange={(e) => setFormData({ ...formData, tradeClassification: e.target.value as any })}
                className="w-full px-4 py-3 bg-[var(--background)] border border-[var(--border)] rounded-lg focus:outline-none focus:border-[var(--accent)] text-[var(--foreground)]"
              >
                <option value="apprentice">Apprentice</option>
                <option value="qualified">Qualified Carpenter</option>
                <option value="leadingHand">Leading Hand</option>
                <option value="foreman">Foreman</option>
              </select>
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
              {isLoading ? "Creating..." : "Generate Invite Link"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

const tradeLabels: Record<string, string> = {
  apprentice: "Apprentice",
  qualified: "Qualified",
  leadingHand: "Leading Hand",
  foreman: "Foreman",
};

export default function WorkersPage() {
  const { user } = useAuth();
  const [showInviteModal, setShowInviteModal] = useState(false);

  const workers = useQuery(api.workers.list, user ? { userId: user._id } : "skip");
  const invites = useQuery(api.workerInvites.listInvites, user ? { userId: user._id } : "skip");

  const pendingInvites = invites?.filter((i) => i.status === "pending") || [];

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-semibold mb-2" style={{ fontFamily: "var(--font-display)" }}>
            Workers
          </h1>
          <p className="text-[var(--foreground-muted)]">
            Manage your team members
          </p>
        </div>
        <button onClick={() => setShowInviteModal(true)} className="btn-primary">
          Invite Worker
        </button>
      </div>

      {/* Pending Invites */}
      {pendingInvites.length > 0 && (
        <div className="mb-8">
          <h2 className="text-lg font-semibold mb-4">Pending Invites</h2>
          <div className="bg-[var(--accent)]/5 border border-[var(--accent)]/20 rounded-xl p-4">
            <ul className="space-y-3">
              {pendingInvites.map((invite) => (
                <li key={invite._id} className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">
                      {invite.email || "No email specified"}
                    </p>
                    <p className="text-sm text-[var(--foreground-muted)]">
                      {tradeLabels[invite.tradeClassification]} • ${invite.payRate}/hr
                    </p>
                  </div>
                  <span className="text-xs px-2 py-1 rounded-full bg-[var(--accent)]/10 text-[var(--accent)]">
                    Pending
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Workers List */}
      {!workers || workers.length === 0 ? (
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
              d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
            />
          </svg>
          <p className="text-[var(--foreground-muted)] mb-4">
            No workers yet. Invite your first team member!
          </p>
          <button onClick={() => setShowInviteModal(true)} className="btn-primary">
            Invite Worker
          </button>
        </div>
      ) : (
        <div className="grid gap-4">
          {workers.map((worker) => (
            <div
              key={worker._id}
              className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-6 flex items-center justify-between"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-[var(--accent)]/20 flex items-center justify-center">
                  <span className="text-[var(--accent)] font-semibold text-lg">
                    {worker.name.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div>
                  <h3 className="font-semibold">{worker.name}</h3>
                  <p className="text-sm text-[var(--foreground-muted)]">
                    {tradeLabels[worker.tradeClassification]} •{" "}
                    {worker.employmentType === "employee" ? "Employee" : "Subcontractor"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-6">
                <div className="text-right">
                  <p className="text-sm text-[var(--foreground-muted)]">Pay Rate</p>
                  <p className="font-semibold">${worker.payRate}/hr</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-[var(--foreground-muted)]">Charge Out</p>
                  <p className="font-semibold">${worker.chargeOutRate}/hr</p>
                </div>
                <span
                  className={`text-xs px-3 py-1 rounded-full ${
                    worker.status === "active"
                      ? "bg-green-500/10 text-green-400"
                      : "bg-gray-500/10 text-gray-400"
                  }`}
                >
                  {worker.status === "active" ? "Active" : "Inactive"}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      <InviteWorkerModal
        isOpen={showInviteModal}
        onClose={() => setShowInviteModal(false)}
      />
    </div>
  );
}
