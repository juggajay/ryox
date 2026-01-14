'use client';

import { useQuery, useMutation } from 'convex/react';
import { api } from '../../../../convex/_generated/api';
import { useAuth } from '@/lib/auth-context';
import { useState } from 'react';
import { format } from 'date-fns';
import { Id } from '../../../../convex/_generated/dataModel';

type OverheadCategory = 'vehicles' | 'insurance' | 'communications' | 'premises' | 'equipment' | 'admin' | 'other';
type Frequency = 'weekly' | 'fortnightly' | 'monthly' | 'quarterly' | 'annually';

const categoryLabels: Record<OverheadCategory, string> = {
  vehicles: 'Vehicles',
  insurance: 'Insurance',
  communications: 'Communications',
  premises: 'Premises',
  equipment: 'Equipment',
  admin: 'Admin',
  other: 'Other',
};

const frequencyLabels: Record<Frequency, string> = {
  weekly: 'Weekly',
  fortnightly: 'Fortnightly',
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  annually: 'Annually',
};

export default function SettingsPage() {
  const { user } = useAuth();
  const [activeSection, setActiveSection] = useState<'overheads' | 'organization'>('overheads');
  const [showAddOverhead, setShowAddOverhead] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [overheadForm, setOverheadForm] = useState({
    name: '',
    category: 'other' as OverheadCategory,
    amount: '',
    frequency: 'monthly' as Frequency,
  });

  // Queries
  const overheads = useQuery(api.overheads.list,
    user ? { userId: user._id } : 'skip'
  );

  const overheadSummary = useQuery(api.overheads.getSummary,
    user ? { userId: user._id } : 'skip'
  );

  const organization = useQuery(api.organizations.get,
    user ? { userId: user._id } : 'skip'
  );

  // Mutations
  const addOverhead = useMutation(api.overheads.add);
  const removeOverhead = useMutation(api.overheads.remove);

  const handleAddOverhead = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !overheadForm.name || !overheadForm.amount) return;

    setIsSubmitting(true);
    try {
      await addOverhead({
        userId: user._id,
        name: overheadForm.name,
        category: overheadForm.category,
        amount: parseFloat(overheadForm.amount),
        frequency: overheadForm.frequency,
        effectiveFrom: Date.now(),
      });

      setOverheadForm({
        name: '',
        category: 'other',
        amount: '',
        frequency: 'monthly',
      });
      setShowAddOverhead(false);
    } catch (err) {
      console.error('Failed to add overhead:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteOverhead = async (overheadId: Id<"overheads">) => {
    if (!user || !confirm('Are you sure you want to delete this overhead?')) return;
    await removeOverhead({ userId: user._id, overheadId });
  };

  if (user?.role !== 'owner') {
    return (
      <div className="text-center py-12">
        <h1 className="text-2xl font-bold">Access Denied</h1>
        <p className="text-[var(--foreground-muted)] mt-2">Only owners can access settings</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-[var(--foreground-muted)]">Manage your organization settings</p>
      </div>

      {/* Section Tabs */}
      <div className="flex gap-2 border-b border-[var(--border)] pb-2">
        <button
          onClick={() => setActiveSection('overheads')}
          className={`px-4 py-2 rounded-t font-medium transition-colors ${
            activeSection === 'overheads'
              ? 'bg-[var(--accent)] text-[var(--background)]'
              : 'text-[var(--foreground-muted)] hover:text-[var(--foreground)]'
          }`}
        >
          Overheads
        </button>
        <button
          onClick={() => setActiveSection('organization')}
          className={`px-4 py-2 rounded-t font-medium transition-colors ${
            activeSection === 'organization'
              ? 'bg-[var(--accent)] text-[var(--background)]'
              : 'text-[var(--foreground-muted)] hover:text-[var(--foreground)]'
          }`}
        >
          Organization
        </button>
      </div>

      {/* Overheads Section */}
      {activeSection === 'overheads' && (
        <div className="space-y-6">
          {/* Summary Cards */}
          {overheadSummary && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-[var(--card)] p-4 rounded-lg border border-[var(--border)]">
                <p className="text-sm text-[var(--foreground-muted)]">Weekly Total</p>
                <p className="text-2xl font-bold text-[var(--accent)]">
                  ${overheadSummary.totalWeekly.toLocaleString()}
                </p>
              </div>
              <div className="bg-[var(--card)] p-4 rounded-lg border border-[var(--border)]">
                <p className="text-sm text-[var(--foreground-muted)]">Monthly Total</p>
                <p className="text-2xl font-bold">
                  ${overheadSummary.totalMonthly.toLocaleString()}
                </p>
              </div>
              <div className="bg-[var(--card)] p-4 rounded-lg border border-[var(--border)]">
                <p className="text-sm text-[var(--foreground-muted)]">Annual Total</p>
                <p className="text-2xl font-bold">
                  ${overheadSummary.totalAnnual.toLocaleString()}
                </p>
              </div>
              <div className="bg-[var(--card)] p-4 rounded-lg border border-[var(--border)]">
                <p className="text-sm text-[var(--foreground-muted)]">Per Hour</p>
                <p className="text-2xl font-bold text-green-400">
                  ${overheadSummary.overheadPerHour.toFixed(2)}
                </p>
                <p className="text-xs text-[var(--foreground-muted)]">
                  Based on {overheadSummary.weeklyBillableHours} hrs/week
                </p>
              </div>
            </div>
          )}

          {/* Add Button */}
          <div className="flex justify-end">
            <button
              onClick={() => setShowAddOverhead(!showAddOverhead)}
              className="px-4 py-2 bg-[var(--accent)] text-[var(--background)] rounded-lg font-medium hover:bg-[var(--accent)]/90"
            >
              {showAddOverhead ? 'Cancel' : '+ Add Overhead'}
            </button>
          </div>

          {/* Add Form */}
          {showAddOverhead && (
            <form onSubmit={handleAddOverhead} className="bg-[var(--card)] p-6 rounded-lg border border-[var(--border)] space-y-4">
              <h3 className="font-semibold text-lg">Add New Overhead</h3>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-[var(--foreground-muted)] mb-1">
                    Name *
                  </label>
                  <input
                    type="text"
                    value={overheadForm.name}
                    onChange={(e) => setOverheadForm({ ...overheadForm, name: e.target.value })}
                    required
                    placeholder="e.g., Vehicle Lease"
                    className="w-full px-3 py-2 bg-[var(--secondary)] border border-[var(--border)] rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-[var(--foreground-muted)] mb-1">
                    Category *
                  </label>
                  <select
                    value={overheadForm.category}
                    onChange={(e) => setOverheadForm({ ...overheadForm, category: e.target.value as OverheadCategory })}
                    className="w-full px-3 py-2 bg-[var(--secondary)] border border-[var(--border)] rounded-lg"
                  >
                    {(Object.entries(categoryLabels) as [OverheadCategory, string][]).map(([key, label]) => (
                      <option key={key} value={key}>{label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-[var(--foreground-muted)] mb-1">
                    Amount ($) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={overheadForm.amount}
                    onChange={(e) => setOverheadForm({ ...overheadForm, amount: e.target.value })}
                    required
                    placeholder="0.00"
                    className="w-full px-3 py-2 bg-[var(--secondary)] border border-[var(--border)] rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-[var(--foreground-muted)] mb-1">
                    Frequency *
                  </label>
                  <select
                    value={overheadForm.frequency}
                    onChange={(e) => setOverheadForm({ ...overheadForm, frequency: e.target.value as Frequency })}
                    className="w-full px-3 py-2 bg-[var(--secondary)] border border-[var(--border)] rounded-lg"
                  >
                    {(Object.entries(frequencyLabels) as [Frequency, string][]).map(([key, label]) => (
                      <option key={key} value={key}>{label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-2 bg-[var(--accent)] text-[var(--background)] rounded-lg font-medium hover:bg-[var(--accent)]/90 disabled:opacity-50"
              >
                {isSubmitting ? 'Adding...' : 'Add Overhead'}
              </button>
            </form>
          )}

          {/* Overheads List */}
          <div className="space-y-3">
            {!overheads ? (
              <div className="animate-pulse space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-20 bg-[var(--card)] rounded-lg" />
                ))}
              </div>
            ) : overheads.length === 0 ? (
              <div className="text-center py-12 bg-[var(--card)] rounded-lg border border-[var(--border)]">
                <p className="text-lg font-medium">No overheads configured</p>
                <p className="text-sm text-[var(--foreground-muted)] mt-1">
                  Add your business overheads to track profitability
                </p>
              </div>
            ) : (
              overheads.map((overhead) => (
                <div
                  key={overhead._id}
                  className="bg-[var(--card)] p-4 rounded-lg border border-[var(--border)] flex items-center justify-between"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium">{overhead.name}</h3>
                      <span className="px-2 py-0.5 rounded text-xs bg-[var(--secondary)] text-[var(--foreground-muted)]">
                        {categoryLabels[overhead.category as OverheadCategory]}
                      </span>
                    </div>
                    <p className="text-sm text-[var(--foreground-muted)]">
                      ${overhead.amount.toLocaleString()} / {frequencyLabels[overhead.frequency as Frequency]}
                    </p>
                    <p className="text-xs text-green-400">
                      Weekly: ${overhead.weeklyAmount.toFixed(2)}
                    </p>
                  </div>
                  <button
                    onClick={() => handleDeleteOverhead(overhead._id)}
                    className="text-red-400 hover:text-red-300 text-sm"
                  >
                    Delete
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Organization Section */}
      {activeSection === 'organization' && (
        <div className="bg-[var(--card)] p-6 rounded-lg border border-[var(--border)] space-y-6">
          <h3 className="font-semibold text-lg">Organization Details</h3>

          {organization ? (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[var(--foreground-muted)] mb-1">
                  Business Name
                </label>
                <p className="text-lg font-medium">{organization.name}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--foreground-muted)] mb-1">
                  ABN
                </label>
                <p className="text-lg">{organization.abn}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--foreground-muted)] mb-1">
                  Created
                </label>
                <p className="text-sm text-[var(--foreground-muted)]">
                  {format(new Date(organization.createdAt), 'dd MMM yyyy')}
                </p>
              </div>
            </div>
          ) : (
            <div className="animate-pulse space-y-4">
              <div className="h-8 bg-[var(--secondary)] rounded w-48" />
              <div className="h-6 bg-[var(--secondary)] rounded w-32" />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
