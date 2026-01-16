'use client';

import { useQuery } from 'convex/react';
import { api } from '../../../../../convex/_generated/api';
import { useAuth } from '@/lib/auth-context';
import { useParams } from 'next/navigation';
import { format } from 'date-fns';
import { Id } from '../../../../../convex/_generated/dataModel';
import Link from 'next/link';

const statusColors: Record<string, string> = {
  active: 'bg-green-500/20 text-green-400',
  inactive: 'bg-gray-500/20 text-gray-400',
};

const tradeLabels: Record<string, string> = {
  apprentice: 'Apprentice',
  qualified: 'Qualified Carpenter',
  leadingHand: 'Leading Hand',
  foreman: 'Foreman',
};

export default function WorkerDetailPageClient() {
  const { user } = useAuth();
  const params = useParams();
  const workerId = params.id as string;

  const worker = useQuery(api.workers.get,
    user && workerId ? { userId: user._id, workerId: workerId as Id<"workers"> } : 'skip'
  );

  const timesheets = useQuery(api.timesheets.list,
    user && workerId ? { userId: user._id, workerId: workerId as Id<"workers">, limit: 10 } : 'skip'
  );

  const jobs = useQuery(api.jobs.list,
    user ? { userId: user._id } : 'skip'
  );

  // Filter jobs where this worker is allocated
  const allocatedJobs = jobs?.filter(job =>
    job.allocatedWorkers?.some((w: any) => w?._id === workerId)
  ) || [];

  if (!worker) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="h-10 bg-[var(--card)] rounded w-48" />
        <div className="h-64 bg-[var(--card)] rounded-lg" />
      </div>
    );
  }

  const getCertStatus = (expiryDate: number) => {
    const daysUntil = Math.ceil((expiryDate - Date.now()) / (24 * 60 * 60 * 1000));
    if (daysUntil < 0) return { status: 'expired', color: 'bg-red-500/20 text-red-400', label: 'Expired' };
    if (daysUntil <= 14) return { status: 'expiring', color: 'bg-orange-500/20 text-orange-400', label: `${daysUntil}d left` };
    if (daysUntil <= 30) return { status: 'warning', color: 'bg-yellow-500/20 text-yellow-400', label: `${daysUntil}d left` };
    return { status: 'valid', color: 'bg-green-500/20 text-green-400', label: 'Valid' };
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <Link href="/workers" className="text-sm text-[var(--foreground-muted)] hover:text-[var(--foreground)]">
            ← Back to Workers
          </Link>
          <h1 className="text-3xl font-bold mt-2">{worker.name}</h1>
          <p className="text-[var(--foreground-muted)]">{tradeLabels[worker.tradeClassification]}</p>
        </div>
        <span className={`px-3 py-1 rounded-full text-sm font-medium ${statusColors[worker.status]}`}>
          {worker.status.charAt(0).toUpperCase() + worker.status.slice(1)}
        </span>
      </div>

      {/* Key Info Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-[var(--card)] p-4 rounded-lg border border-[var(--border)]">
          <p className="text-sm text-[var(--foreground-muted)]">Employment</p>
          <p className="text-lg font-medium capitalize">{worker.employmentType}</p>
        </div>
        <div className="bg-[var(--card)] p-4 rounded-lg border border-[var(--border)]">
          <p className="text-sm text-[var(--foreground-muted)]">Pay Rate</p>
          <p className="text-lg font-medium">${worker.payRate}/hr</p>
        </div>
        <div className="bg-[var(--card)] p-4 rounded-lg border border-[var(--border)]">
          <p className="text-sm text-[var(--foreground-muted)]">Charge-out Rate</p>
          <p className="text-lg font-medium text-[var(--accent)]">${worker.chargeOutRate}/hr</p>
        </div>
        <div className="bg-[var(--card)] p-4 rounded-lg border border-[var(--border)]">
          <p className="text-sm text-[var(--foreground-muted)]">Start Date</p>
          <p className="text-lg font-medium">{format(new Date(worker.startDate), 'dd MMM yyyy')}</p>
        </div>
      </div>

      {/* Contact Info */}
      <div className="bg-[var(--card)] p-6 rounded-lg border border-[var(--border)]">
        <h2 className="text-xl font-semibold mb-4">Contact Information</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-[var(--foreground-muted)]">Email</p>
            <p className="font-medium">{worker.email}</p>
          </div>
          <div>
            <p className="text-sm text-[var(--foreground-muted)]">Phone</p>
            <p className="font-medium">{worker.phone}</p>
          </div>
          {worker.emergencyContact && (
            <div className="md:col-span-2">
              <p className="text-sm text-[var(--foreground-muted)]">Emergency Contact</p>
              <p className="font-medium">
                {worker.emergencyContact.name} ({worker.emergencyContact.relationship}) - {worker.emergencyContact.phone}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Certifications */}
      <div className="bg-[var(--card)] p-6 rounded-lg border border-[var(--border)]">
        <h2 className="text-xl font-semibold mb-4">Certifications ({worker.certifications?.length || 0})</h2>
        {worker.certifications && worker.certifications.length > 0 ? (
          <div className="space-y-3">
            {worker.certifications.map((cert: any) => {
              const certStatus = getCertStatus(cert.expiryDate);
              return (
                <div key={cert._id} className="flex justify-between items-center p-3 bg-[var(--secondary)] rounded-lg">
                  <div>
                    <p className="font-medium">{cert.name}</p>
                    <p className="text-sm text-[var(--foreground-muted)]">
                      Expires: {format(new Date(cert.expiryDate), 'dd MMM yyyy')}
                    </p>
                  </div>
                  <span className={`px-2 py-1 rounded text-xs font-medium ${certStatus.color}`}>
                    {certStatus.label}
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-[var(--foreground-muted)]">No certifications recorded</p>
        )}
      </div>

      {/* Current Jobs */}
      <div className="bg-[var(--card)] p-6 rounded-lg border border-[var(--border)]">
        <h2 className="text-xl font-semibold mb-4">Allocated Jobs ({allocatedJobs.length})</h2>
        {allocatedJobs.length > 0 ? (
          <div className="space-y-3">
            {allocatedJobs.map((job: any) => (
              <Link
                key={job._id}
                href={`/jobs/${job._id}`}
                className="flex justify-between items-center p-3 bg-[var(--secondary)] rounded-lg hover:bg-[var(--secondary)]/80 transition-colors"
              >
                <div>
                  <p className="font-medium">{job.name}</p>
                  <p className="text-sm text-[var(--foreground-muted)]">{job.siteAddress}</p>
                </div>
                <span className={`px-2 py-1 rounded text-xs font-medium ${
                  job.status === 'active' ? 'bg-green-500/20 text-green-400' :
                  job.status === 'pending' ? 'bg-yellow-500/20 text-yellow-400' :
                  'bg-gray-500/20 text-gray-400'
                }`}>
                  {job.status}
                </span>
              </Link>
            ))}
          </div>
        ) : (
          <p className="text-[var(--foreground-muted)]">No jobs allocated</p>
        )}
      </div>

      {/* Recent Timesheets */}
      <div className="bg-[var(--card)] p-6 rounded-lg border border-[var(--border)]">
        <h2 className="text-xl font-semibold mb-4">Recent Timesheets</h2>
        {timesheets && timesheets.length > 0 ? (
          <div className="space-y-2">
            {timesheets.map((ts: any) => (
              <div key={ts._id} className="flex justify-between items-center p-3 bg-[var(--secondary)] rounded-lg">
                <div>
                  <p className="font-medium">{ts.job?.name || 'Unknown Job'}</p>
                  <p className="text-sm text-[var(--foreground-muted)]">
                    {format(new Date(ts.date), 'dd MMM yyyy')} • {ts.startTime} - {ts.endTime}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-[var(--accent)]">{ts.totalHours}h</p>
                  <span className={`text-xs px-2 py-0.5 rounded ${
                    ts.status === 'approved' ? 'bg-green-500/20 text-green-400' :
                    ts.status === 'submitted' ? 'bg-yellow-500/20 text-yellow-400' :
                    ts.status === 'invoiced' ? 'bg-blue-500/20 text-blue-400' :
                    'bg-red-500/20 text-red-400'
                  }`}>
                    {ts.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-[var(--foreground-muted)]">No timesheets submitted</p>
        )}
      </div>
    </div>
  );
}
