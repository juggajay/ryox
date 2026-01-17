'use client';

import { useState } from 'react';
import { useQuery, useMutation } from 'convex/react';
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

type Worker = {
  _id: Id<"workers">;
  name: string;
  phone: string;
  email: string;
  employmentType: "employee" | "subcontractor";
  tradeClassification: "apprentice" | "qualified" | "leadingHand" | "foreman";
  payRate: number;
  chargeOutRate: number;
  status: "active" | "inactive";
  emergencyContact?: {
    name: string;
    phone: string;
    relationship: string;
  };
};

function EditWorkerModal({
  isOpen,
  onClose,
  worker,
  userId,
}: {
  isOpen: boolean;
  onClose: () => void;
  worker: Worker;
  userId: Id<"users">;
}) {
  const updateWorker = useMutation(api.workers.update);

  const [formData, setFormData] = useState({
    name: worker.name,
    phone: worker.phone,
    email: worker.email,
    employmentType: worker.employmentType,
    tradeClassification: worker.tradeClassification,
    payRate: worker.payRate.toString(),
    chargeOutRate: worker.chargeOutRate.toString(),
    status: worker.status,
    emergencyContactName: worker.emergencyContact?.name || '',
    emergencyContactPhone: worker.emergencyContact?.phone || '',
    emergencyContactRelationship: worker.emergencyContact?.relationship || '',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      await updateWorker({
        userId,
        workerId: worker._id,
        name: formData.name,
        phone: formData.phone,
        email: formData.email,
        employmentType: formData.employmentType,
        tradeClassification: formData.tradeClassification,
        payRate: parseFloat(formData.payRate),
        chargeOutRate: parseFloat(formData.chargeOutRate),
        status: formData.status,
        emergencyContact: formData.emergencyContactName
          ? {
              name: formData.emergencyContactName,
              phone: formData.emergencyContactPhone,
              relationship: formData.emergencyContactRelationship,
            }
          : undefined,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update worker');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative bg-[var(--card)] border border-[var(--border)] rounded-xl w-full max-w-lg mx-4 p-6 max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-[var(--foreground-muted)] hover:text-[var(--foreground)]"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <h2 className="text-xl font-semibold mb-6" style={{ fontFamily: 'var(--font-display)' }}>
          Edit Worker
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2 text-[var(--foreground-muted)]">
              Name
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-4 py-3 bg-[var(--background)] border border-[var(--border)] rounded-lg focus:outline-none focus:border-[var(--accent)] text-[var(--foreground)]"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2 text-[var(--foreground-muted)]">
                Phone
              </label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full px-4 py-3 bg-[var(--background)] border border-[var(--border)] rounded-lg focus:outline-none focus:border-[var(--accent)] text-[var(--foreground)]"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2 text-[var(--foreground-muted)]">
                Email
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-4 py-3 bg-[var(--background)] border border-[var(--border)] rounded-lg focus:outline-none focus:border-[var(--accent)] text-[var(--foreground)]"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2 text-[var(--foreground-muted)]">
                Employment Type
              </label>
              <select
                value={formData.employmentType}
                onChange={(e) => setFormData({ ...formData, employmentType: e.target.value as "employee" | "subcontractor" })}
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
                onChange={(e) => setFormData({ ...formData, tradeClassification: e.target.value as "apprentice" | "qualified" | "leadingHand" | "foreman" })}
                className="w-full px-4 py-3 bg-[var(--background)] border border-[var(--border)] rounded-lg focus:outline-none focus:border-[var(--accent)] text-[var(--foreground)]"
              >
                <option value="apprentice">Apprentice</option>
                <option value="qualified">Qualified Carpenter</option>
                <option value="leadingHand">Leading Hand</option>
                <option value="foreman">Foreman</option>
              </select>
            </div>
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
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2 text-[var(--foreground-muted)]">
                Charge-out Rate ($/hr)
              </label>
              <input
                type="number"
                step="0.01"
                value={formData.chargeOutRate}
                onChange={(e) => setFormData({ ...formData, chargeOutRate: e.target.value })}
                className="w-full px-4 py-3 bg-[var(--background)] border border-[var(--border)] rounded-lg focus:outline-none focus:border-[var(--accent)] text-[var(--foreground)]"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2 text-[var(--foreground-muted)]">
              Status
            </label>
            <select
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value as "active" | "inactive" })}
              className="w-full px-4 py-3 bg-[var(--background)] border border-[var(--border)] rounded-lg focus:outline-none focus:border-[var(--accent)] text-[var(--foreground)]"
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>

          <div className="pt-2">
            <div className="text-xs uppercase tracking-wider text-[var(--foreground-muted)] mb-3 flex items-center gap-2">
              <div className="h-px flex-1 bg-[var(--border)]" />
              <span>Emergency Contact</span>
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
                value={formData.emergencyContactName}
                onChange={(e) => setFormData({ ...formData, emergencyContactName: e.target.value })}
                className="w-full px-4 py-3 bg-[var(--background)] border border-[var(--border)] rounded-lg focus:outline-none focus:border-[var(--accent)] text-[var(--foreground)]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2 text-[var(--foreground-muted)]">
                Relationship
              </label>
              <input
                type="text"
                value={formData.emergencyContactRelationship}
                onChange={(e) => setFormData({ ...formData, emergencyContactRelationship: e.target.value })}
                className="w-full px-4 py-3 bg-[var(--background)] border border-[var(--border)] rounded-lg focus:outline-none focus:border-[var(--accent)] text-[var(--foreground)]"
                placeholder="e.g. Spouse, Parent"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2 text-[var(--foreground-muted)]">
              Contact Phone
            </label>
            <input
              type="tel"
              value={formData.emergencyContactPhone}
              onChange={(e) => setFormData({ ...formData, emergencyContactPhone: e.target.value })}
              className="w-full px-4 py-3 bg-[var(--background)] border border-[var(--border)] rounded-lg focus:outline-none focus:border-[var(--accent)] text-[var(--foreground)]"
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
            {isLoading ? 'Saving...' : 'Save Changes'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function WorkerDetailPageClient() {
  const { user } = useAuth();
  const params = useParams();
  const workerId = params.id as string;
  const [showEditModal, setShowEditModal] = useState(false);

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
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowEditModal(true)}
            className="px-4 py-2 bg-[var(--accent)] text-[var(--background)] rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
          >
            Edit
          </button>
          <span className={`px-3 py-1 rounded-full text-sm font-medium ${statusColors[worker.status]}`}>
            {worker.status.charAt(0).toUpperCase() + worker.status.slice(1)}
          </span>
        </div>
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

      {user && worker && (
        <EditWorkerModal
          isOpen={showEditModal}
          onClose={() => setShowEditModal(false)}
          worker={worker as Worker}
          userId={user._id}
        />
      )}
    </div>
  );
}
