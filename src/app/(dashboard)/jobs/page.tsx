"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { useAuth } from "@/lib/auth-context";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import Link from "next/link";

function CreateJobModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const { user } = useAuth();
  const createJob = useMutation(api.jobs.create);
  const createBuilder = useMutation(api.builders.create);
  const builders = useQuery(api.builders.list, user ? { userId: user._id } : "skip");

  const [formData, setFormData] = useState({
    builderId: "",
    name: "",
    siteAddress: "",
    jobType: "contract" as "contract" | "labourHire",
    quotedPrice: "",
    estimatedHours: "",
    materialsBudget: "",
    startDate: new Date().toISOString().split("T")[0],
    expectedEndDate: "",
    notes: "",
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  // Quick add builder state
  const [showQuickAddBuilder, setShowQuickAddBuilder] = useState(false);
  const [builderFormData, setBuilderFormData] = useState({
    companyName: "",
    abn: "",
    paymentTerms: "30",
  });
  const [isCreatingBuilder, setIsCreatingBuilder] = useState(false);
  const [quickAddedBuilder, setQuickAddedBuilder] = useState<{ id: string; name: string } | null>(null);

  const handleQuickAddBuilder = async () => {
    if (!user) return;
    setIsCreatingBuilder(true);
    try {
      const builderName = builderFormData.companyName;
      const newBuilderId = await createBuilder({
        userId: user._id,
        companyName: builderName,
        abn: builderFormData.abn || "N/A",
        paymentTerms: parseInt(builderFormData.paymentTerms) || 30,
      });
      setFormData({ ...formData, builderId: newBuilderId });
      setQuickAddedBuilder({ id: newBuilderId, name: builderName });
      setShowQuickAddBuilder(false);
      setBuilderFormData({ companyName: "", abn: "", paymentTerms: "30" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create builder");
    } finally {
      setIsCreatingBuilder(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setError("");
    setIsLoading(true);

    try {
      await createJob({
        userId: user._id,
        builderId: formData.builderId as Id<"builders">,
        name: formData.name,
        siteAddress: formData.siteAddress,
        jobType: formData.jobType,
        quotedPrice: formData.quotedPrice ? parseFloat(formData.quotedPrice) : undefined,
        estimatedHours: formData.estimatedHours ? parseFloat(formData.estimatedHours) : undefined,
        materialsBudget: formData.materialsBudget ? parseFloat(formData.materialsBudget) : undefined,
        startDate: new Date(formData.startDate).getTime(),
        expectedEndDate: formData.expectedEndDate
          ? new Date(formData.expectedEndDate).getTime()
          : undefined,
        notes: formData.notes || undefined,
      });
      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create job");
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setFormData({
      builderId: "",
      name: "",
      siteAddress: "",
      jobType: "contract",
      quotedPrice: "",
      estimatedHours: "",
      materialsBudget: "",
      startDate: new Date().toISOString().split("T")[0],
      expectedEndDate: "",
      notes: "",
    });
    setShowQuickAddBuilder(false);
    setBuilderFormData({ companyName: "", abn: "", paymentTerms: "30" });
    setQuickAddedBuilder(null);
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
          Create Job
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2 text-[var(--foreground-muted)]">
              Builder
            </label>

            {/* Success message when builder was just created */}
            {quickAddedBuilder && formData.builderId === quickAddedBuilder.id && (
              <div className="mb-3 p-3 bg-green-500/10 border border-green-500/30 rounded-lg flex items-center gap-2">
                <svg className="w-5 h-5 text-green-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-sm text-green-400">
                  Builder &quot;{quickAddedBuilder.name}&quot; created and selected
                </span>
                <button
                  type="button"
                  onClick={() => setQuickAddedBuilder(null)}
                  className="ml-auto text-green-400/60 hover:text-green-400"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            )}

            <div className="space-y-2">
              <select
                value={formData.builderId}
                onChange={(e) => {
                  setFormData({ ...formData, builderId: e.target.value });
                  setQuickAddedBuilder(null);
                }}
                className="w-full px-4 py-3 bg-[var(--background)] border border-[var(--border)] rounded-lg focus:outline-none focus:border-[var(--accent)] text-[var(--foreground)]"
                required={!quickAddedBuilder}
              >
                <option value="">Select a builder...</option>
                {builders?.map((builder) => (
                  <option key={builder._id} value={builder._id}>
                    {builder.companyName}
                  </option>
                ))}
                {/* Show quick-added builder if not yet in the list */}
                {quickAddedBuilder && !builders?.some(b => b._id === quickAddedBuilder.id) && (
                  <option value={quickAddedBuilder.id}>
                    {quickAddedBuilder.name}
                  </option>
                )}
              </select>
              <button
                type="button"
                onClick={() => setShowQuickAddBuilder(!showQuickAddBuilder)}
                className="w-full px-4 py-3 bg-[var(--accent)] text-[var(--background)] rounded-lg hover:opacity-90 transition-colors font-medium"
              >
                + Add New Builder
              </button>
            </div>

            {/* Quick Add Builder Form */}
            {showQuickAddBuilder && (
              <div className="mt-3 p-4 bg-[var(--accent)]/5 border border-[var(--accent)]/30 rounded-lg space-y-3">
                <p className="text-sm font-medium text-[var(--accent)]">Quick Add Builder</p>
                <p className="text-xs text-[var(--foreground-muted)]">
                  Add basic details now, you can update the rest later in Builders.
                </p>
                <input
                  type="text"
                  value={builderFormData.companyName}
                  onChange={(e) => setBuilderFormData({ ...builderFormData, companyName: e.target.value })}
                  className="w-full px-3 py-2 bg-[var(--card)] border border-[var(--border)] rounded-lg focus:outline-none focus:border-[var(--accent)] text-[var(--foreground)] text-sm"
                  placeholder="Company name *"
                  autoFocus
                />
                <div className="grid grid-cols-2 gap-3">
                  <input
                    type="text"
                    value={builderFormData.abn}
                    onChange={(e) => setBuilderFormData({ ...builderFormData, abn: e.target.value })}
                    className="w-full px-3 py-2 bg-[var(--card)] border border-[var(--border)] rounded-lg focus:outline-none focus:border-[var(--accent)] text-[var(--foreground)] text-sm"
                    placeholder="ABN (optional)"
                  />
                  <input
                    type="number"
                    value={builderFormData.paymentTerms}
                    onChange={(e) => setBuilderFormData({ ...builderFormData, paymentTerms: e.target.value })}
                    className="w-full px-3 py-2 bg-[var(--card)] border border-[var(--border)] rounded-lg focus:outline-none focus:border-[var(--accent)] text-[var(--foreground)] text-sm"
                    placeholder="Payment terms (days)"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleQuickAddBuilder}
                    disabled={!builderFormData.companyName || isCreatingBuilder}
                    className="flex-1 px-3 py-2 bg-[var(--accent)] text-[var(--background)] rounded-lg text-sm font-medium disabled:opacity-50"
                  >
                    {isCreatingBuilder ? "Adding..." : "Add Builder"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowQuickAddBuilder(false);
                      setBuilderFormData({ companyName: "", abn: "", paymentTerms: "30" });
                    }}
                    className="px-3 py-2 border border-[var(--border)] rounded-lg text-sm hover:border-[var(--foreground-muted)]"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-2 text-[var(--foreground-muted)]">
              Job Name
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-4 py-3 bg-[var(--background)] border border-[var(--border)] rounded-lg focus:outline-none focus:border-[var(--accent)] text-[var(--foreground)]"
              placeholder="Kitchen Renovation - 123 Main St"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2 text-[var(--foreground-muted)]">
              Site Address
            </label>
            <input
              type="text"
              value={formData.siteAddress}
              onChange={(e) => setFormData({ ...formData, siteAddress: e.target.value })}
              className="w-full px-4 py-3 bg-[var(--background)] border border-[var(--border)] rounded-lg focus:outline-none focus:border-[var(--accent)] text-[var(--foreground)]"
              placeholder="123 Main Street, Sydney NSW 2000"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2 text-[var(--foreground-muted)]">
              Job Type
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setFormData({ ...formData, jobType: "contract" })}
                className={`p-4 rounded-lg border transition-colors ${
                  formData.jobType === "contract"
                    ? "border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)]"
                    : "border-[var(--border)] hover:border-[var(--foreground-muted)]"
                }`}
              >
                <p className="font-medium">Contract</p>
                <p className="text-xs opacity-70">Fixed price job</p>
              </button>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, jobType: "labourHire" })}
                className={`p-4 rounded-lg border transition-colors ${
                  formData.jobType === "labourHire"
                    ? "border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)]"
                    : "border-[var(--border)] hover:border-[var(--foreground-muted)]"
                }`}
              >
                <p className="font-medium">Labour Hire</p>
                <p className="text-xs opacity-70">Hourly billing</p>
              </button>
            </div>
          </div>

          {formData.jobType === "contract" && (
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2 text-[var(--foreground-muted)]">
                  Quoted Price ($)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.quotedPrice}
                  onChange={(e) => setFormData({ ...formData, quotedPrice: e.target.value })}
                  className="w-full px-4 py-3 bg-[var(--background)] border border-[var(--border)] rounded-lg focus:outline-none focus:border-[var(--accent)] text-[var(--foreground)]"
                  placeholder="15000"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2 text-[var(--foreground-muted)]">
                  Est. Hours
                </label>
                <input
                  type="number"
                  value={formData.estimatedHours}
                  onChange={(e) => setFormData({ ...formData, estimatedHours: e.target.value })}
                  className="w-full px-4 py-3 bg-[var(--background)] border border-[var(--border)] rounded-lg focus:outline-none focus:border-[var(--accent)] text-[var(--foreground)]"
                  placeholder="120"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2 text-[var(--foreground-muted)]">
                  Materials ($)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.materialsBudget}
                  onChange={(e) => setFormData({ ...formData, materialsBudget: e.target.value })}
                  className="w-full px-4 py-3 bg-[var(--background)] border border-[var(--border)] rounded-lg focus:outline-none focus:border-[var(--accent)] text-[var(--foreground)]"
                  placeholder="5000"
                />
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2 text-[var(--foreground-muted)]">
                Start Date
              </label>
              <input
                type="date"
                value={formData.startDate}
                onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                className="w-full px-4 py-3 bg-[var(--background)] border border-[var(--border)] rounded-lg focus:outline-none focus:border-[var(--accent)] text-[var(--foreground)]"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2 text-[var(--foreground-muted)]">
                Expected End Date
              </label>
              <input
                type="date"
                value={formData.expectedEndDate}
                onChange={(e) => setFormData({ ...formData, expectedEndDate: e.target.value })}
                className="w-full px-4 py-3 bg-[var(--background)] border border-[var(--border)] rounded-lg focus:outline-none focus:border-[var(--accent)] text-[var(--foreground)]"
              />
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
            {isLoading ? "Creating..." : "Create Job"}
          </button>
        </form>
      </div>
    </div>
  );
}

const statusColors: Record<string, string> = {
  pending: "bg-gray-500/10 text-gray-400",
  active: "bg-green-500/10 text-green-400",
  onHold: "bg-yellow-500/10 text-yellow-400",
  completed: "bg-blue-500/10 text-blue-400",
  invoiced: "bg-purple-500/10 text-purple-400",
};

const statusLabels: Record<string, string> = {
  pending: "Pending",
  active: "Active",
  onHold: "On Hold",
  completed: "Completed",
  invoiced: "Invoiced",
};

export default function JobsPage() {
  const { user } = useAuth();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [statusFilter, setStatusFilter] = useState<"pending" | "active" | "onHold" | "completed" | "invoiced" | null>(null);

  const jobs = useQuery(
    api.jobs.list,
    user
      ? {
          userId: user._id,
          status: statusFilter ?? undefined,
        }
      : "skip"
  );

  const filteredJobs = statusFilter
    ? jobs?.filter((j) => j.status === statusFilter)
    : jobs;

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-semibold mb-2" style={{ fontFamily: "var(--font-display)" }}>
            Jobs
          </h1>
          <p className="text-[var(--foreground-muted)]">
            Manage your jobs and projects
          </p>
        </div>
        <button onClick={() => setShowCreateModal(true)} className="btn-primary">
          Create Job
        </button>
      </div>

      {/* Status Filters */}
      <div className="flex gap-2 mb-6 flex-wrap">
        <button
          onClick={() => setStatusFilter(null)}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            statusFilter === null
              ? "bg-[var(--accent)] text-[var(--background)]"
              : "bg-[var(--card)] border border-[var(--border)] hover:border-[var(--accent)]"
          }`}
        >
          All
        </button>
        {(Object.entries(statusLabels) as [typeof statusFilter, string][]).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setStatusFilter(key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              statusFilter === key
                ? "bg-[var(--accent)] text-[var(--background)]"
                : "bg-[var(--card)] border border-[var(--border)] hover:border-[var(--accent)]"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {!filteredJobs || filteredJobs.length === 0 ? (
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
              d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
            />
          </svg>
          <p className="text-[var(--foreground-muted)] mb-4">
            {statusFilter ? `No ${statusLabels[statusFilter].toLowerCase()} jobs` : "No jobs yet"}
          </p>
          <button onClick={() => setShowCreateModal(true)} className="btn-primary">
            Create Job
          </button>
        </div>
      ) : (
        <div className="grid gap-4">
          {filteredJobs.map((job) => (
            <Link
              href={`/jobs/${job._id}`}
              key={job._id}
              className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-6 block hover:border-[var(--accent)] transition-colors"
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold mb-1">{job.name}</h3>
                  <p className="text-sm text-[var(--foreground-muted)]">
                    {job.builder?.companyName}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`text-xs px-2 py-1 rounded-full ${
                      job.jobType === "contract"
                        ? "bg-blue-500/10 text-blue-400"
                        : "bg-purple-500/10 text-purple-400"
                    }`}
                  >
                    {job.jobType === "contract" ? "Contract" : "Labour Hire"}
                  </span>
                  <span className={`text-xs px-2 py-1 rounded-full ${statusColors[job.status]}`}>
                    {statusLabels[job.status]}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 text-sm text-[var(--foreground-muted)] mb-4">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                  />
                </svg>
                {job.siteAddress}
              </div>

              <div className="grid grid-cols-4 gap-4 pt-4 border-t border-[var(--border)]">
                <div>
                  <p className="text-xs text-[var(--foreground-muted)] mb-1">Hours</p>
                  <p className="font-medium">{job.stats.totalHours.toFixed(1)}</p>
                </div>
                <div>
                  <p className="text-xs text-[var(--foreground-muted)] mb-1">Labour Cost</p>
                  <p className="font-medium">${job.stats.labourCost.toFixed(0)}</p>
                </div>
                <div>
                  <p className="text-xs text-[var(--foreground-muted)] mb-1">Workers</p>
                  <p className="font-medium">{job.allocatedWorkers.length}</p>
                </div>
                <div>
                  <p className="text-xs text-[var(--foreground-muted)] mb-1">Timesheets</p>
                  <p className="font-medium">
                    {job.stats.pendingTimesheets > 0 && (
                      <span className="text-yellow-400 mr-1">{job.stats.pendingTimesheets} pending</span>
                    )}
                    {job.stats.timesheetCount}
                  </p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      <CreateJobModal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)} />
    </div>
  );
}
