'use client';

import { useState } from 'react';
import { useQuery, useMutation } from 'convex/react';
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
  const workers = useQuery(api.workers.list, user ? { userId: user._id } : 'skip');

  const allocateWorker = useMutation(api.jobs.allocateWorker);
  const removeAllocation = useMutation(api.jobs.removeAllocation);
  const createQuickWorker = useMutation(api.workers.createQuick);
  const updateJob = useMutation(api.jobs.update);

  // Worker allocation state
  const [showAddWorker, setShowAddWorker] = useState(false);
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [selectedWorkerId, setSelectedWorkerId] = useState('');
  const [allocationData, setAllocationData] = useState({
    payRate: '',
    chargeOutRate: '',
  });
  const [quickWorkerData, setQuickWorkerData] = useState({
    name: '',
    phone: '',
    payRate: '',
    chargeOutRate: '',
  });
  const [isAllocating, setIsAllocating] = useState(false);
  const [allocationError, setAllocationError] = useState('');
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  const handleStatusChange = async (newStatus: string) => {
    if (!user || !job) return;
    setIsUpdatingStatus(true);
    try {
      await updateJob({
        userId: user._id,
        jobId: jobId as Id<"jobs">,
        status: newStatus as "pending" | "active" | "onHold" | "completed" | "invoiced",
      });
    } catch (err) {
      console.error('Failed to update status:', err);
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  // Get workers not already allocated to this job
  const availableWorkers = workers?.filter(
    (w) => !job?.allocatedWorkers?.some((aw: any) => aw?._id === w._id)
  );

  const handleAllocateWorker = async () => {
    if (!user || !selectedWorkerId) return;
    setIsAllocating(true);
    setAllocationError('');
    try {
      const selectedWorker = workers?.find((w) => w._id === selectedWorkerId);
      await allocateWorker({
        userId: user._id,
        jobId: jobId as Id<"jobs">,
        workerId: selectedWorkerId as Id<"workers">,
        startDate: Date.now(),
        allocationType: 'fullTime',
        payRate: parseFloat(allocationData.payRate) || selectedWorker?.payRate || 0,
        chargeOutRate: parseFloat(allocationData.chargeOutRate) || selectedWorker?.chargeOutRate || 0,
      });
      setShowAddWorker(false);
      setSelectedWorkerId('');
      setAllocationData({ payRate: '', chargeOutRate: '' });
    } catch (err) {
      setAllocationError(err instanceof Error ? err.message : 'Failed to allocate worker');
    } finally {
      setIsAllocating(false);
    }
  };

  const handleQuickAddAndAllocate = async () => {
    if (!user) return;
    setIsAllocating(true);
    setAllocationError('');
    try {
      const payRate = parseFloat(quickWorkerData.payRate);
      const chargeOutRate = parseFloat(quickWorkerData.chargeOutRate);

      // Create the temp worker
      const newWorkerId = await createQuickWorker({
        userId: user._id,
        name: quickWorkerData.name,
        phone: quickWorkerData.phone || 'N/A',
        payRate,
        chargeOutRate,
      });

      // Allocate to this job
      await allocateWorker({
        userId: user._id,
        jobId: jobId as Id<"jobs">,
        workerId: newWorkerId,
        startDate: Date.now(),
        allocationType: 'fullTime',
        payRate,
        chargeOutRate,
      });

      setShowQuickAdd(false);
      setShowAddWorker(false);
      setQuickWorkerData({ name: '', phone: '', payRate: '', chargeOutRate: '' });
    } catch (err) {
      setAllocationError(err instanceof Error ? err.message : 'Failed to add worker');
    } finally {
      setIsAllocating(false);
    }
  };

  const handleRemoveWorker = async (worker: any) => {
    if (!user || !worker?.allocation?._id) return;
    try {
      await removeAllocation({
        userId: user._id,
        allocationId: worker.allocation._id,
      });
    } catch (err) {
      console.error('Failed to remove worker:', err);
    }
  };

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
        <select
          value={job.status}
          onChange={(e) => handleStatusChange(e.target.value)}
          disabled={isUpdatingStatus}
          className={`px-3 py-2 rounded-lg text-sm font-medium border-0 cursor-pointer ${statusColors[job.status]} ${isUpdatingStatus ? 'opacity-50' : ''}`}
        >
          <option value="pending">Pending</option>
          <option value="active">Active</option>
          <option value="onHold">On Hold</option>
          <option value="completed">Completed</option>
          <option value="invoiced">Invoiced</option>
        </select>
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
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">Allocated Workers ({job.allocatedWorkers?.length || 0})</h2>
          <button
            onClick={() => setShowAddWorker(!showAddWorker)}
            className="px-3 py-1.5 bg-[var(--accent)] text-[var(--background)] rounded-lg text-sm font-medium hover:opacity-90"
          >
            + Add Worker
          </button>
        </div>

        {/* Add Worker Form */}
        {showAddWorker && (
          <div className="mb-4 p-4 bg-[var(--background)] border border-[var(--border)] rounded-lg space-y-3">
            {!showQuickAdd ? (
              <>
                <div className="flex gap-2">
                  <select
                    value={selectedWorkerId}
                    onChange={(e) => {
                      setSelectedWorkerId(e.target.value);
                      const worker = workers?.find((w) => w._id === e.target.value);
                      if (worker) {
                        setAllocationData({
                          payRate: (worker.payRate ?? 0).toString(),
                          chargeOutRate: (worker.chargeOutRate ?? 0).toString(),
                        });
                      }
                    }}
                    className="flex-1 px-3 py-2 bg-[var(--card)] border border-[var(--border)] rounded-lg text-sm"
                  >
                    <option value="">Select a worker...</option>
                    {availableWorkers?.map((worker) => (
                      <option key={worker._id} value={worker._id}>
                        {worker.name} - {worker.tradeClassification}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => setShowQuickAdd(true)}
                    className="px-3 py-2 border border-[var(--border)] rounded-lg text-sm hover:border-[var(--accent)] whitespace-nowrap"
                  >
                    + New
                  </button>
                </div>

                {selectedWorkerId && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-[var(--foreground-muted)]">Pay Rate ($/hr)</label>
                      <input
                        type="number"
                        value={allocationData.payRate}
                        onChange={(e) => setAllocationData({ ...allocationData, payRate: e.target.value })}
                        className="w-full px-3 py-2 bg-[var(--card)] border border-[var(--border)] rounded-lg text-sm"
                        placeholder="55"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-[var(--foreground-muted)]">Charge-out Rate ($/hr)</label>
                      <input
                        type="number"
                        value={allocationData.chargeOutRate}
                        onChange={(e) => setAllocationData({ ...allocationData, chargeOutRate: e.target.value })}
                        className="w-full px-3 py-2 bg-[var(--card)] border border-[var(--border)] rounded-lg text-sm"
                        placeholder="85"
                      />
                    </div>
                  </div>
                )}

                {allocationError && (
                  <p className="text-red-400 text-sm">{allocationError}</p>
                )}

                <div className="flex gap-2">
                  <button
                    onClick={handleAllocateWorker}
                    disabled={!selectedWorkerId || isAllocating}
                    className="flex-1 px-3 py-2 bg-[var(--accent)] text-[var(--background)] rounded-lg text-sm font-medium disabled:opacity-50"
                  >
                    {isAllocating ? 'Adding...' : 'Add to Job'}
                  </button>
                  <button
                    onClick={() => {
                      setShowAddWorker(false);
                      setSelectedWorkerId('');
                      setAllocationData({ payRate: '', chargeOutRate: '' });
                    }}
                    className="px-3 py-2 border border-[var(--border)] rounded-lg text-sm hover:border-[var(--foreground-muted)]"
                  >
                    Cancel
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="text-sm font-medium text-[var(--accent)]">Quick Add Temp Worker</p>
                <input
                  type="text"
                  value={quickWorkerData.name}
                  onChange={(e) => setQuickWorkerData({ ...quickWorkerData, name: e.target.value })}
                  className="w-full px-3 py-2 bg-[var(--card)] border border-[var(--border)] rounded-lg text-sm"
                  placeholder="Worker name *"
                />
                <input
                  type="text"
                  value={quickWorkerData.phone}
                  onChange={(e) => setQuickWorkerData({ ...quickWorkerData, phone: e.target.value })}
                  className="w-full px-3 py-2 bg-[var(--card)] border border-[var(--border)] rounded-lg text-sm"
                  placeholder="Phone (optional)"
                />
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-[var(--foreground-muted)]">Pay Rate ($/hr) *</label>
                    <input
                      type="number"
                      value={quickWorkerData.payRate}
                      onChange={(e) => setQuickWorkerData({ ...quickWorkerData, payRate: e.target.value })}
                      className="w-full px-3 py-2 bg-[var(--card)] border border-[var(--border)] rounded-lg text-sm"
                      placeholder="55"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-[var(--foreground-muted)]">Charge-out Rate ($/hr) *</label>
                    <input
                      type="number"
                      value={quickWorkerData.chargeOutRate}
                      onChange={(e) => setQuickWorkerData({ ...quickWorkerData, chargeOutRate: e.target.value })}
                      className="w-full px-3 py-2 bg-[var(--card)] border border-[var(--border)] rounded-lg text-sm"
                      placeholder="85"
                    />
                  </div>
                </div>

                {allocationError && (
                  <p className="text-red-400 text-sm">{allocationError}</p>
                )}

                <div className="flex gap-2">
                  <button
                    onClick={handleQuickAddAndAllocate}
                    disabled={!quickWorkerData.name || !quickWorkerData.payRate || !quickWorkerData.chargeOutRate || isAllocating}
                    className="flex-1 px-3 py-2 bg-[var(--accent)] text-[var(--background)] rounded-lg text-sm font-medium disabled:opacity-50"
                  >
                    {isAllocating ? 'Adding...' : 'Add Worker to Job'}
                  </button>
                  <button
                    onClick={() => {
                      setShowQuickAdd(false);
                      setQuickWorkerData({ name: '', phone: '', payRate: '', chargeOutRate: '' });
                    }}
                    className="px-3 py-2 border border-[var(--border)] rounded-lg text-sm hover:border-[var(--foreground-muted)]"
                  >
                    Back
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* Worker List */}
        {job.allocatedWorkers && job.allocatedWorkers.length > 0 ? (
          <div className="space-y-3">
            {job.allocatedWorkers.map((worker: any) => worker && (
              <div key={worker._id} className="flex justify-between items-center p-3 bg-[var(--secondary)] rounded-lg">
                <div>
                  <p className="font-medium">{worker.name}</p>
                  <p className="text-sm text-[var(--foreground-muted)] capitalize">{worker.tradeClassification}</p>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-sm">${worker.chargeOutRate}/hr</p>
                  </div>
                  <button
                    onClick={() => handleRemoveWorker(worker)}
                    className="text-[var(--foreground-muted)] hover:text-red-400 transition-colors"
                    title="Remove from job"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
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
