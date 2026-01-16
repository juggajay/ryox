'use client';

import { useQuery } from 'convex/react';
import { api } from '../../../../../convex/_generated/api';
import { useAuth } from '@/lib/auth-context';
import { useParams } from 'next/navigation';
import { format } from 'date-fns';
import { Id } from '../../../../../convex/_generated/dataModel';
import Link from 'next/link';

// Required for static export - dynamic routes loaded at runtime
export function generateStaticParams() {
  return [];
}

const statusColors: Record<string, string> = {
  active: 'bg-green-500/20 text-green-400',
  inactive: 'bg-gray-500/20 text-gray-400',
};

const jobStatusColors: Record<string, string> = {
  pending: 'bg-yellow-500/20 text-yellow-400',
  active: 'bg-green-500/20 text-green-400',
  onHold: 'bg-orange-500/20 text-orange-400',
  completed: 'bg-blue-500/20 text-blue-400',
  invoiced: 'bg-purple-500/20 text-purple-400',
};

export default function BuilderDetailPage() {
  const { user } = useAuth();
  const params = useParams();
  const builderId = params.id as string;

  const builder = useQuery(api.builders.get,
    user && builderId ? { userId: user._id, builderId: builderId as Id<"builders"> } : 'skip'
  );

  const invoices = useQuery(api.invoices.list,
    user && builderId ? { userId: user._id, builderId: builderId as Id<"builders"> } : 'skip'
  );

  if (!builder) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="h-10 bg-[var(--card)] rounded w-48" />
        <div className="h-64 bg-[var(--card)] rounded-lg" />
      </div>
    );
  }

  const primaryContact = builder.contacts?.find((c: any) => c.isPrimary);
  const activeJobs = builder.jobs?.filter((j: any) => j.status === 'active' || j.status === 'pending') || [];
  const completedJobs = builder.jobs?.filter((j: any) => j.status === 'completed' || j.status === 'invoiced') || [];

  const totalRevenue = invoices?.filter((i: any) => i.status === 'paid').reduce((sum: number, i: any) => sum + i.amount, 0) || 0;
  const outstandingAmount = invoices?.filter((i: any) => i.status === 'sent').reduce((sum: number, i: any) => sum + i.amount, 0) || 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <Link href="/builders" className="text-sm text-[var(--foreground-muted)] hover:text-[var(--foreground)]">
            ← Back to Builders
          </Link>
          <h1 className="text-3xl font-bold mt-2">{builder.companyName}</h1>
          <p className="text-[var(--foreground-muted)]">ABN: {builder.abn}</p>
        </div>
        <span className={`px-3 py-1 rounded-full text-sm font-medium ${statusColors[builder.status]}`}>
          {builder.status.charAt(0).toUpperCase() + builder.status.slice(1)}
        </span>
      </div>

      {/* Key Info Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-[var(--card)] p-4 rounded-lg border border-[var(--border)]">
          <p className="text-sm text-[var(--foreground-muted)]">Payment Terms</p>
          <p className="text-lg font-medium">{builder.paymentTerms} days</p>
        </div>
        <div className="bg-[var(--card)] p-4 rounded-lg border border-[var(--border)]">
          <p className="text-sm text-[var(--foreground-muted)]">Active Jobs</p>
          <p className="text-lg font-medium text-green-400">{activeJobs.length}</p>
        </div>
        <div className="bg-[var(--card)] p-4 rounded-lg border border-[var(--border)]">
          <p className="text-sm text-[var(--foreground-muted)]">Total Revenue</p>
          <p className="text-lg font-medium text-[var(--accent)]">${totalRevenue.toLocaleString()}</p>
        </div>
        <div className="bg-[var(--card)] p-4 rounded-lg border border-[var(--border)]">
          <p className="text-sm text-[var(--foreground-muted)]">Outstanding</p>
          <p className="text-lg font-medium text-blue-400">${outstandingAmount.toLocaleString()}</p>
        </div>
      </div>

      {/* Primary Contact */}
      {primaryContact && (
        <div className="bg-[var(--card)] p-6 rounded-lg border border-[var(--border)]">
          <h2 className="text-xl font-semibold mb-4">Primary Contact</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <p className="text-sm text-[var(--foreground-muted)]">Name</p>
              <p className="font-medium">{primaryContact.name}</p>
              <p className="text-sm text-[var(--foreground-muted)]">{primaryContact.role}</p>
            </div>
            <div>
              <p className="text-sm text-[var(--foreground-muted)]">Email</p>
              <p className="font-medium">{primaryContact.email}</p>
            </div>
            <div>
              <p className="text-sm text-[var(--foreground-muted)]">Phone</p>
              <p className="font-medium">{primaryContact.phone}</p>
            </div>
          </div>
        </div>
      )}

      {/* All Contacts */}
      <div className="bg-[var(--card)] p-6 rounded-lg border border-[var(--border)]">
        <h2 className="text-xl font-semibold mb-4">Contacts ({builder.contacts?.length || 0})</h2>
        {builder.contacts && builder.contacts.length > 0 ? (
          <div className="space-y-3">
            {builder.contacts.map((contact: any) => (
              <div key={contact._id} className="flex justify-between items-center p-3 bg-[var(--secondary)] rounded-lg">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{contact.name}</p>
                    {contact.isPrimary && (
                      <span className="px-2 py-0.5 rounded text-xs bg-[var(--accent)]/20 text-[var(--accent)]">
                        Primary
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-[var(--foreground-muted)]">{contact.role}</p>
                </div>
                <div className="text-right text-sm">
                  <p>{contact.email}</p>
                  <p className="text-[var(--foreground-muted)]">{contact.phone}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-[var(--foreground-muted)]">No contacts added</p>
        )}
      </div>

      {/* Active Jobs */}
      <div className="bg-[var(--card)] p-6 rounded-lg border border-[var(--border)]">
        <h2 className="text-xl font-semibold mb-4">Active Jobs ({activeJobs.length})</h2>
        {activeJobs.length > 0 ? (
          <div className="space-y-3">
            {activeJobs.map((job: any) => (
              <Link
                key={job._id}
                href={`/jobs/${job._id}`}
                className="flex justify-between items-center p-3 bg-[var(--secondary)] rounded-lg hover:bg-[var(--secondary)]/80 transition-colors"
              >
                <div>
                  <p className="font-medium">{job.name}</p>
                  <p className="text-sm text-[var(--foreground-muted)]">{job.siteAddress}</p>
                </div>
                <div className="text-right">
                  <span className={`px-2 py-1 rounded text-xs font-medium ${jobStatusColors[job.status]}`}>
                    {job.status}
                  </span>
                  <p className="text-sm text-[var(--foreground-muted)] mt-1">
                    {job.jobType === 'contract' ? 'Contract' : 'Labour Hire'}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <p className="text-[var(--foreground-muted)]">No active jobs</p>
        )}
      </div>

      {/* Completed Jobs */}
      <div className="bg-[var(--card)] p-6 rounded-lg border border-[var(--border)]">
        <h2 className="text-xl font-semibold mb-4">Completed Jobs ({completedJobs.length})</h2>
        {completedJobs.length > 0 ? (
          <div className="space-y-3">
            {completedJobs.slice(0, 5).map((job: any) => (
              <Link
                key={job._id}
                href={`/jobs/${job._id}`}
                className="flex justify-between items-center p-3 bg-[var(--secondary)] rounded-lg hover:bg-[var(--secondary)]/80 transition-colors"
              >
                <div>
                  <p className="font-medium">{job.name}</p>
                  <p className="text-sm text-[var(--foreground-muted)]">{job.siteAddress}</p>
                </div>
                <div className="text-right">
                  <span className={`px-2 py-1 rounded text-xs font-medium ${jobStatusColors[job.status]}`}>
                    {job.status}
                  </span>
                  {job.quotedPrice && (
                    <p className="text-sm text-[var(--accent)] mt-1">
                      ${job.quotedPrice.toLocaleString()}
                    </p>
                  )}
                </div>
              </Link>
            ))}
            {completedJobs.length > 5 && (
              <p className="text-center text-sm text-[var(--foreground-muted)]">
                +{completedJobs.length - 5} more completed jobs
              </p>
            )}
          </div>
        ) : (
          <p className="text-[var(--foreground-muted)]">No completed jobs</p>
        )}
      </div>

      {/* Recent Invoices */}
      <div className="bg-[var(--card)] p-6 rounded-lg border border-[var(--border)]">
        <h2 className="text-xl font-semibold mb-4">Recent Invoices</h2>
        {invoices && invoices.length > 0 ? (
          <div className="space-y-2">
            {invoices.slice(0, 5).map((invoice: any) => (
              <div key={invoice._id} className="flex justify-between items-center p-3 bg-[var(--secondary)] rounded-lg">
                <div>
                  <p className="font-medium">{invoice.invoiceNumber}</p>
                  <p className="text-sm text-[var(--foreground-muted)]">{invoice.job?.name}</p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-[var(--accent)]">${invoice.amount.toLocaleString()}</p>
                  <span className={`text-xs px-2 py-0.5 rounded ${
                    invoice.status === 'paid' ? 'bg-green-500/20 text-green-400' :
                    invoice.status === 'sent' ? 'bg-blue-500/20 text-blue-400' :
                    invoice.status === 'overdue' ? 'bg-red-500/20 text-red-400' :
                    'bg-gray-500/20 text-gray-400'
                  }`}>
                    {invoice.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-[var(--foreground-muted)]">No invoices yet</p>
        )}
      </div>

      {/* Notes */}
      {builder.notes && (
        <div className="bg-[var(--card)] p-6 rounded-lg border border-[var(--border)]">
          <h2 className="text-xl font-semibold mb-4">Notes</h2>
          <p className="text-[var(--foreground-muted)] whitespace-pre-wrap">{builder.notes}</p>
        </div>
      )}
    </div>
  );
}
