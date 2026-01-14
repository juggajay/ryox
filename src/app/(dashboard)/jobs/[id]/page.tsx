'use client';

import { useQuery } from 'convex/react';
import { api } from '../../../../../convex/_generated/api';
import { useAuth } from '@/lib/auth-context';
import { useParams } from 'next/navigation';
import { format } from 'date-fns';
import { Id } from '../../../../../convex/_generated/dataModel';
import Link from 'next/link';

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-500/20 text-yellow-400',
  active: 'bg-green-500/20 text-green-400',
  onHold: 'bg-orange-500/20 text-orange-400',
  completed: 'bg-blue-500/20 text-blue-400',
  invoiced: 'bg-purple-500/20 text-purple-400',
};

export default function JobDetailPage() {
  const { user } = useAuth();
  const params = useParams();
  const jobId = params.id as string;

  const job = useQuery(api.jobs.get,
    user && jobId ? { userId: user._id, jobId: jobId as Id<"jobs"> } : 'skip'
  );

  if (!job) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="h-10 bg-[var(--card)] rounded w-48" />
        <div className="h-64 bg-[var(--card)] rounded-lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <Link href="/jobs" className="text-sm text-[var(--foreground-muted)] hover:text-[var(--foreground)]">
            ← Back to Jobs
          </Link>
          <h1 className="text-3xl font-bold mt-2">{job.name}</h1>
          <p className="text-[var(--foreground-muted)]">{job.siteAddress}</p>
        </div>
        <span className={`px-3 py-1 rounded-full text-sm font-medium ${statusColors[job.status]}`}>
          {job.status.charAt(0).toUpperCase() + job.status.slice(1)}
        </span>
      </div>

      {/* Key Info Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-[var(--card)] p-4 rounded-lg border border-[var(--border)]">
          <p className="text-sm text-[var(--foreground-muted)]">Job Type</p>
          <p className="text-lg font-medium capitalize">{job.jobType}</p>
        </div>
        <div className="bg-[var(--card)] p-4 rounded-lg border border-[var(--border)]">
          <p className="text-sm text-[var(--foreground-muted)]">Builder</p>
          <p className="text-lg font-medium">{job.builder?.companyName || 'N/A'}</p>
        </div>
        <div className="bg-[var(--card)] p-4 rounded-lg border border-[var(--border)]">
          <p className="text-sm text-[var(--foreground-muted)]">Start Date</p>
          <p className="text-lg font-medium">{format(new Date(job.startDate), 'dd MMM yyyy')}</p>
        </div>
        {job.quotedPrice && (
          <div className="bg-[var(--card)] p-4 rounded-lg border border-[var(--border)]">
            <p className="text-sm text-[var(--foreground-muted)]">Quoted Price</p>
            <p className="text-lg font-medium text-[var(--accent)]">${job.quotedPrice.toLocaleString()}</p>
          </div>
        )}
      </div>

      {/* Financial Summary */}
      {job.financials && (
        <div className="bg-[var(--card)] p-6 rounded-lg border border-[var(--border)]">
          <h2 className="text-xl font-semibold mb-4">Financial Summary</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-[var(--foreground-muted)]">Total Hours</p>
              <p className="text-2xl font-bold">{job.financials.totalHours}h</p>
            </div>
            <div>
              <p className="text-sm text-[var(--foreground-muted)]">Labour Cost</p>
              <p className="text-2xl font-bold">${job.financials.labourCost.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-sm text-[var(--foreground-muted)]">Total Expenses</p>
              <p className="text-2xl font-bold">${job.financials.totalExpenses.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-sm text-[var(--foreground-muted)]">Gross Profit</p>
              <p className={`text-2xl font-bold ${job.financials.grossProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                ${job.financials.grossProfit.toLocaleString()}
              </p>
              <p className="text-xs text-[var(--foreground-muted)]">
                {job.financials.grossMargin.toFixed(1)}% margin
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Allocated Workers */}
      <div className="bg-[var(--card)] p-6 rounded-lg border border-[var(--border)]">
        <h2 className="text-xl font-semibold mb-4">Allocated Workers ({job.allocatedWorkers?.length || 0})</h2>
        {job.allocatedWorkers && job.allocatedWorkers.length > 0 ? (
          <div className="space-y-3">
            {job.allocatedWorkers.map((worker: any) => worker && (
              <div key={worker._id} className="flex justify-between items-center p-3 bg-[var(--secondary)] rounded-lg">
                <div>
                  <p className="font-medium">{worker.name}</p>
                  <p className="text-sm text-[var(--foreground-muted)] capitalize">{worker.tradeClassification}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm">${worker.chargeOutRate}/hr</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-[var(--foreground-muted)]">No workers allocated</p>
        )}
      </div>

      {/* Timesheets */}
      <div className="bg-[var(--card)] p-6 rounded-lg border border-[var(--border)]">
        <h2 className="text-xl font-semibold mb-4">Recent Timesheets ({job.timesheets?.length || 0})</h2>
        {job.timesheets && job.timesheets.length > 0 ? (
          <div className="space-y-2">
            {job.timesheets.slice(0, 5).map((ts: any) => (
              <div key={ts._id} className="flex justify-between items-center p-3 bg-[var(--secondary)] rounded-lg">
                <div>
                  <p className="font-medium">{format(new Date(ts.date), 'dd MMM yyyy')}</p>
                  <p className="text-sm text-[var(--foreground-muted)]">{ts.startTime} - {ts.endTime}</p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-[var(--accent)]">{ts.totalHours}h</p>
                  <p className="text-xs text-[var(--foreground-muted)] capitalize">{ts.status}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-[var(--foreground-muted)]">No timesheets submitted</p>
        )}
      </div>

      {/* Expenses */}
      <div className="bg-[var(--card)] p-6 rounded-lg border border-[var(--border)]">
        <h2 className="text-xl font-semibold mb-4">Expenses ({job.expenses?.length || 0})</h2>
        {job.expenses && job.expenses.length > 0 ? (
          <div className="space-y-2">
            {job.expenses.map((exp: any) => (
              <div key={exp._id} className="flex justify-between items-center p-3 bg-[var(--secondary)] rounded-lg">
                <div>
                  <p className="font-medium">{exp.description}</p>
                  <p className="text-sm text-[var(--foreground-muted)] capitalize">{exp.category}</p>
                </div>
                <p className="text-lg font-bold">${exp.amount.toLocaleString()}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-[var(--foreground-muted)]">No expenses recorded</p>
        )}
      </div>
    </div>
  );
}
