'use client';

import { useQuery, useMutation, useAction } from 'convex/react';
import { api } from '../../../../convex/_generated/api';
import { useAuth } from '@/lib/auth-context';
import { useState } from 'react';
import { format } from 'date-fns';
import { Id } from '../../../../convex/_generated/dataModel';
import Link from 'next/link';

type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'overdue';

const statusLabels: Record<InvoiceStatus, string> = {
  draft: 'Draft',
  sent: 'Sent',
  paid: 'Paid',
  overdue: 'Overdue',
};

const statusColors: Record<InvoiceStatus, string> = {
  draft: 'bg-gray-500/20 text-gray-400',
  sent: 'bg-blue-500/20 text-blue-400',
  paid: 'bg-green-500/20 text-green-400',
  overdue: 'bg-red-500/20 text-red-400',
};

export default function InvoicesPage() {
  const { user } = useAuth();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedJobId, setSelectedJobId] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<InvoiceStatus | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [exportingInvoiceId, setExportingInvoiceId] = useState<string | null>(null);
  const [xeroError, setXeroError] = useState<string | null>(null);

  // Queries
  const invoices = useQuery(api.invoices.list,
    user ? { userId: user._id, status: statusFilter || undefined } : 'skip'
  );

  // Xero integration
  const xeroStatus = useQuery(api.xero.getConnectionStatus,
    user ? { userId: user._id } : 'skip'
  );
  const exportToXero = useAction(api.xero.exportInvoice);

  const summary = useQuery(api.invoices.getSummary,
    user ? { userId: user._id } : 'skip'
  );

  const jobs = useQuery(api.jobs.list,
    user ? { userId: user._id } : 'skip'
  );

  // Get jobs with approved timesheets that can be invoiced
  const invoiceableJobs = jobs?.filter(job =>
    job.stats.pendingTimesheets === 0 &&
    job.status !== 'invoiced' &&
    (job.stats.timesheetCount > 0 || job.jobType === 'contract')
  ) || [];

  // Mutations
  const createInvoice = useMutation(api.invoices.create);
  const updateStatus = useMutation(api.invoices.updateStatus);
  const removeInvoice = useMutation(api.invoices.remove);

  const handleCreateInvoice = async () => {
    if (!user || !selectedJobId) return;

    setIsCreating(true);
    try {
      await createInvoice({
        userId: user._id,
        jobId: selectedJobId as Id<"jobs">,
      });
      setShowCreateModal(false);
      setSelectedJobId('');
    } catch (err) {
      console.error('Failed to create invoice:', err);
      alert(err instanceof Error ? err.message : 'Failed to create invoice');
    } finally {
      setIsCreating(false);
    }
  };

  const handleStatusChange = async (invoiceId: Id<"invoices">, newStatus: InvoiceStatus) => {
    if (!user) return;
    await updateStatus({ userId: user._id, invoiceId, status: newStatus });
  };

  const handleDelete = async (invoiceId: Id<"invoices">) => {
    if (!user || !confirm('Are you sure you want to delete this draft invoice?')) return;
    await removeInvoice({ userId: user._id, invoiceId });
  };

  const handleExportToXero = async (invoiceId: Id<"invoices">) => {
    if (!user) return;
    setExportingInvoiceId(invoiceId);
    setXeroError(null);
    try {
      await exportToXero({ userId: user._id, invoiceId });
    } catch (err) {
      console.error('Failed to export to Xero:', err);
      setXeroError(err instanceof Error ? err.message : 'Failed to export to Xero');
    } finally {
      setExportingInvoiceId(null);
    }
  };

  if (user?.role !== 'owner') {
    return (
      <div className="text-center py-12">
        <h1 className="text-2xl font-bold">Access Denied</h1>
        <p className="text-[var(--foreground-muted)] mt-2">Only owners can view invoices</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold">Invoices</h1>
          <p className="text-[var(--foreground-muted)]">Generate and track invoices</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2 bg-[var(--accent)] text-[var(--background)] rounded-lg font-medium hover:bg-[var(--accent)]/90"
        >
          + Create Invoice
        </button>
      </div>

      {/* Xero Error Message */}
      {xeroError && (
        <div className="p-4 rounded-lg border bg-red-500/10 border-red-500/30 text-red-400">
          <div className="flex items-center justify-between">
            <p>{xeroError}</p>
            <button
              onClick={() => setXeroError(null)}
              className="text-current hover:opacity-70"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Xero Integration Prompt */}
      {xeroStatus && !xeroStatus.connected && (
        <div className="p-4 rounded-lg border border-[var(--border)] bg-[var(--card)] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#13B5EA] rounded-lg flex items-center justify-center">
              <svg viewBox="0 0 24 24" className="w-6 h-6 text-white" fill="currentColor">
                <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 14.54l-2.543-2.542 2.543-2.543a.75.75 0 00-1.061-1.06l-2.543 2.542-2.542-2.543a.75.75 0 00-1.061 1.061l2.543 2.543-2.543 2.542a.75.75 0 001.06 1.061l2.543-2.543 2.543 2.543a.75.75 0 101.06-1.061z"/>
              </svg>
            </div>
            <div>
              <p className="font-medium">Connect to Xero</p>
              <p className="text-sm text-[var(--foreground-muted)]">Export invoices directly to your accounting software</p>
            </div>
          </div>
          <Link
            href="/settings?tab=integrations"
            className="px-4 py-2 bg-[#13B5EA] text-white rounded-lg font-medium hover:bg-[#0ea5d9]"
          >
            Connect
          </Link>
        </div>
      )}

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-[var(--card)] p-4 rounded-lg border border-[var(--border)]">
            <p className="text-sm text-[var(--foreground-muted)]">Outstanding</p>
            <p className="text-2xl font-bold text-blue-400">
              ${summary.totalOutstanding.toLocaleString()}
            </p>
            <p className="text-xs text-[var(--foreground-muted)]">{summary.sentCount} invoices</p>
          </div>
          <div className="bg-[var(--card)] p-4 rounded-lg border border-[var(--border)]">
            <p className="text-sm text-[var(--foreground-muted)]">Overdue</p>
            <p className="text-2xl font-bold text-red-400">
              ${summary.totalOverdue.toLocaleString()}
            </p>
            <p className="text-xs text-[var(--foreground-muted)]">{summary.overdueCount} invoices</p>
          </div>
          <div className="bg-[var(--card)] p-4 rounded-lg border border-[var(--border)]">
            <p className="text-sm text-[var(--foreground-muted)]">Paid (Total)</p>
            <p className="text-2xl font-bold text-green-400">
              ${summary.totalPaid.toLocaleString()}
            </p>
            <p className="text-xs text-[var(--foreground-muted)]">{summary.paidCount} invoices</p>
          </div>
          <div className="bg-[var(--card)] p-4 rounded-lg border border-[var(--border)]">
            <p className="text-sm text-[var(--foreground-muted)]">Drafts</p>
            <p className="text-2xl font-bold">{summary.draftCount}</p>
            <p className="text-xs text-[var(--foreground-muted)]">awaiting send</p>
          </div>
        </div>
      )}

      {/* Status Filter */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => setStatusFilter(null)}
          className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
            statusFilter === null
              ? 'bg-[var(--accent)] text-[var(--background)]'
              : 'bg-[var(--secondary)] text-[var(--foreground-muted)] hover:text-[var(--foreground)]'
          }`}
        >
          All
        </button>
        {(Object.entries(statusLabels) as [InvoiceStatus, string][]).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setStatusFilter(key)}
            className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
              statusFilter === key
                ? 'bg-[var(--accent)] text-[var(--background)]'
                : 'bg-[var(--secondary)] text-[var(--foreground-muted)] hover:text-[var(--foreground)]'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Invoices List */}
      <div className="space-y-3">
        {!invoices ? (
          <div className="animate-pulse space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 bg-[var(--card)] rounded-lg" />
            ))}
          </div>
        ) : invoices.length === 0 ? (
          <div className="text-center py-12 bg-[var(--card)] rounded-lg border border-[var(--border)]">
            <p className="text-lg font-medium">No invoices found</p>
            <p className="text-sm text-[var(--foreground-muted)] mt-1">
              Create an invoice from a job with approved timesheets
            </p>
          </div>
        ) : (
          invoices.map((invoice) => (
            <div
              key={invoice._id}
              className="bg-[var(--card)] p-4 rounded-lg border border-[var(--border)]"
            >
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-lg">{invoice.invoiceNumber}</h3>
                    <span className={`px-2 py-0.5 rounded text-xs ${statusColors[invoice.status as InvoiceStatus]}`}>
                      {statusLabels[invoice.status as InvoiceStatus]}
                    </span>
                    {invoice.status === 'sent' && invoice.dueDate < Date.now() && (
                      <span className="px-2 py-0.5 rounded text-xs bg-red-500/20 text-red-400">
                        OVERDUE
                      </span>
                    )}
                    {invoice.xeroInvoiceNumber && (
                      <span className="px-2 py-0.5 rounded text-xs bg-[#13B5EA]/20 text-[#13B5EA] flex items-center gap-1">
                        <svg viewBox="0 0 24 24" className="w-3 h-3" fill="currentColor">
                          <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 14.54l-2.543-2.542 2.543-2.543a.75.75 0 00-1.061-1.06l-2.543 2.542-2.542-2.543a.75.75 0 00-1.061 1.061l2.543 2.543-2.543 2.542a.75.75 0 001.06 1.061l2.543-2.543 2.543 2.543a.75.75 0 101.06-1.061z"/>
                        </svg>
                        {invoice.xeroInvoiceNumber}
                      </span>
                    )}
                  </div>
                  <p className="text-sm">{invoice.builder?.companyName}</p>
                  <p className="text-sm text-[var(--foreground-muted)]">{invoice.job?.name}</p>
                  <p className="text-xs text-[var(--foreground-muted)]">
                    Due: {format(new Date(invoice.dueDate), 'dd MMM yyyy')}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <span className="text-2xl font-bold text-[var(--accent)]">
                    ${invoice.amount.toLocaleString()}
                  </span>
                  <div className="flex gap-2 flex-wrap justify-end">
                    {invoice.status === 'draft' && (
                      <>
                        <button
                          onClick={() => handleStatusChange(invoice._id, 'sent')}
                          className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm"
                        >
                          Mark Sent
                        </button>
                        <button
                          onClick={() => handleDelete(invoice._id)}
                          className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-sm"
                        >
                          Delete
                        </button>
                      </>
                    )}
                    {invoice.status === 'sent' && (
                      <button
                        onClick={() => handleStatusChange(invoice._id, 'paid')}
                        className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white rounded text-sm"
                      >
                        Mark Paid
                      </button>
                    )}
                    {/* Xero Export Button */}
                    {xeroStatus?.connected &&
                     invoice.status !== 'draft' &&
                     !invoice.xeroInvoiceId && (
                      <button
                        onClick={() => handleExportToXero(invoice._id)}
                        disabled={exportingInvoiceId === invoice._id}
                        className="px-3 py-1 bg-[#13B5EA] hover:bg-[#0ea5d9] text-white rounded text-sm flex items-center gap-1.5 disabled:opacity-50"
                      >
                        {exportingInvoiceId === invoice._id ? (
                          <>
                            <svg className="animate-spin h-3.5 w-3.5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Exporting...
                          </>
                        ) : (
                          <>
                            <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="currentColor">
                              <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 14.54l-2.543-2.542 2.543-2.543a.75.75 0 00-1.061-1.06l-2.543 2.542-2.542-2.543a.75.75 0 00-1.061 1.061l2.543 2.543-2.543 2.542a.75.75 0 001.06 1.061l2.543-2.543 2.543 2.543a.75.75 0 101.06-1.061z"/>
                            </svg>
                            Export to Xero
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Create Invoice Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-[var(--card)] p-6 rounded-lg border border-[var(--border)] w-full max-w-md">
            <h2 className="text-xl font-semibold mb-4">Create Invoice</h2>

            <div className="mb-4">
              <label className="block text-sm font-medium text-[var(--foreground-muted)] mb-1">
                Select Job
              </label>
              <select
                value={selectedJobId}
                onChange={(e) => setSelectedJobId(e.target.value)}
                className="w-full px-3 py-2 bg-[var(--secondary)] border border-[var(--border)] rounded-lg"
              >
                <option value="">Select a job...</option>
                {invoiceableJobs.map((job) => (
                  <option key={job._id} value={job._id}>
                    {job.name} - {job.builder?.companyName}
                  </option>
                ))}
              </select>
              {invoiceableJobs.length === 0 && (
                <p className="text-xs text-[var(--foreground-muted)] mt-1">
                  No jobs available. Jobs need approved timesheets to invoice.
                </p>
              )}
            </div>

            <div className="flex gap-2 justify-end">
              <button
                onClick={() => { setShowCreateModal(false); setSelectedJobId(''); }}
                className="px-4 py-2 bg-[var(--secondary)] hover:bg-[var(--secondary)]/80 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateInvoice}
                disabled={!selectedJobId || isCreating}
                className="px-4 py-2 bg-[var(--accent)] text-[var(--background)] rounded-lg font-medium hover:bg-[var(--accent)]/90 disabled:opacity-50"
              >
                {isCreating ? 'Creating...' : 'Create Invoice'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
