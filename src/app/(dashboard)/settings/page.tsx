'use client';

import { useQuery, useMutation, useAction } from 'convex/react';
import { api } from '../../../../convex/_generated/api';
import { useAuth } from '@/lib/auth-context';
import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { useSearchParams } from 'next/navigation';
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
  const searchParams = useSearchParams();
  const [activeSection, setActiveSection] = useState<'overheads' | 'organization' | 'owners' | 'integrations'>('overheads');
  const [showAddOverhead, setShowAddOverhead] = useState(false);
  const [showAddOwner, setShowAddOwner] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [xeroConnecting, setXeroConnecting] = useState(false);
  const [xeroMessage, setXeroMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [overheadForm, setOverheadForm] = useState({
    name: '',
    category: 'other' as OverheadCategory,
    amount: '',
    frequency: 'monthly' as Frequency,
  });

  const [ownerForm, setOwnerForm] = useState({
    name: '',
    email: '',
    password: '',
  });

  // Handle URL params from Xero OAuth callback
  useEffect(() => {
    const tab = searchParams.get('tab');
    const success = searchParams.get('success');
    const error = searchParams.get('error');

    if (tab === 'integrations') {
      setActiveSection('integrations');
    }

    if (success === 'connected') {
      setXeroMessage({ type: 'success', text: 'Successfully connected to Xero!' });
      setActiveSection('integrations');
    } else if (error) {
      setXeroMessage({ type: 'error', text: error });
      setActiveSection('integrations');
    }
  }, [searchParams]);

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

  const owners = useQuery(api.auth.listOwners,
    user ? { userId: user._id } : 'skip'
  );

  // Xero integration queries
  const xeroStatus = useQuery(api.xero.getConnectionStatus,
    user ? { userId: user._id } : 'skip'
  );

  // Mutations
  const addOverhead = useMutation(api.overheads.add);
  const removeOverhead = useMutation(api.overheads.remove);
  const addOwner = useMutation(api.auth.addOwner);

  // Xero mutations
  const initiateXeroOAuth = useMutation(api.xero.initiateOAuth);
  const disconnectXero = useMutation(api.xero.disconnect);

  const handleConnectXero = async () => {
    if (!user) return;
    setXeroConnecting(true);
    setXeroMessage(null);
    try {
      const result = await initiateXeroOAuth({ userId: user._id });
      window.location.href = result.authUrl;
    } catch (err) {
      console.error('Failed to initiate Xero OAuth:', err);
      setXeroMessage({ type: 'error', text: 'Failed to connect to Xero. Please try again.' });
      setXeroConnecting(false);
    }
  };

  const handleDisconnectXero = async () => {
    if (!user || !confirm('Are you sure you want to disconnect from Xero? This will remove the integration.')) return;
    try {
      await disconnectXero({ userId: user._id });
      setXeroMessage({ type: 'success', text: 'Successfully disconnected from Xero.' });
    } catch (err) {
      console.error('Failed to disconnect Xero:', err);
      setXeroMessage({ type: 'error', text: 'Failed to disconnect from Xero.' });
    }
  };

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

  const handleAddOwner = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !ownerForm.name || !ownerForm.email || !ownerForm.password) return;

    setIsSubmitting(true);
    try {
      await addOwner({
        userId: user._id,
        name: ownerForm.name,
        email: ownerForm.email,
        password: ownerForm.password,
      });

      setOwnerForm({ name: '', email: '', password: '' });
      setShowAddOwner(false);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to add owner';
      alert(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
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
        <button
          onClick={() => setActiveSection('owners')}
          className={`px-4 py-2 rounded-t font-medium transition-colors ${
            activeSection === 'owners'
              ? 'bg-[var(--accent)] text-[var(--background)]'
              : 'text-[var(--foreground-muted)] hover:text-[var(--foreground)]'
          }`}
        >
          Owners
        </button>
        <button
          onClick={() => setActiveSection('integrations')}
          className={`px-4 py-2 rounded-t font-medium transition-colors ${
            activeSection === 'integrations'
              ? 'bg-[var(--accent)] text-[var(--background)]'
              : 'text-[var(--foreground-muted)] hover:text-[var(--foreground)]'
          }`}
        >
          Integrations
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

      {/* Owners Section */}
      {activeSection === 'owners' && (
        <div className="space-y-6">
          {/* Add Button */}
          <div className="flex justify-between items-center">
            <p className="text-[var(--foreground-muted)]">
              Add other owners to help manage your business
            </p>
            <button
              onClick={() => setShowAddOwner(!showAddOwner)}
              className="px-4 py-2 bg-[var(--accent)] text-[var(--background)] rounded-lg font-medium hover:bg-[var(--accent)]/90"
            >
              {showAddOwner ? 'Cancel' : '+ Add Owner'}
            </button>
          </div>

          {/* Add Owner Form */}
          {showAddOwner && (
            <form onSubmit={handleAddOwner} className="bg-[var(--card)] p-6 rounded-lg border border-[var(--border)] space-y-4">
              <h3 className="font-semibold text-lg">Add New Owner</h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-[var(--foreground-muted)] mb-1">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    value={ownerForm.name}
                    onChange={(e) => setOwnerForm({ ...ownerForm, name: e.target.value })}
                    required
                    placeholder="John Smith"
                    className="w-full px-3 py-2 bg-[var(--secondary)] border border-[var(--border)] rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-[var(--foreground-muted)] mb-1">
                    Email *
                  </label>
                  <input
                    type="email"
                    value={ownerForm.email}
                    onChange={(e) => setOwnerForm({ ...ownerForm, email: e.target.value })}
                    required
                    placeholder="john@example.com"
                    className="w-full px-3 py-2 bg-[var(--secondary)] border border-[var(--border)] rounded-lg"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--foreground-muted)] mb-1">
                  Temporary Password *
                </label>
                <input
                  type="text"
                  value={ownerForm.password}
                  onChange={(e) => setOwnerForm({ ...ownerForm, password: e.target.value })}
                  required
                  placeholder="Create a temporary password"
                  className="w-full px-3 py-2 bg-[var(--secondary)] border border-[var(--border)] rounded-lg"
                />
                <p className="text-xs text-[var(--foreground-muted)] mt-1">
                  Share this password with the new owner. They can change it after signing in.
                </p>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-2 bg-[var(--accent)] text-[var(--background)] rounded-lg font-medium hover:bg-[var(--accent)]/90 disabled:opacity-50"
              >
                {isSubmitting ? 'Adding...' : 'Add Owner'}
              </button>
            </form>
          )}

          {/* Owners List */}
          <div className="space-y-3">
            {!owners ? (
              <div className="animate-pulse space-y-3">
                {[1, 2].map((i) => (
                  <div key={i} className="h-20 bg-[var(--card)] rounded-lg" />
                ))}
              </div>
            ) : owners.length === 0 ? (
              <div className="text-center py-12 bg-[var(--card)] rounded-lg border border-[var(--border)]">
                <p className="text-lg font-medium">No owners found</p>
              </div>
            ) : (
              owners.map((owner) => (
                <div
                  key={owner._id}
                  className="bg-[var(--card)] p-4 rounded-lg border border-[var(--border)] flex items-center justify-between"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-[var(--accent)] flex items-center justify-center text-[var(--background)] font-bold text-lg">
                      {owner.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h3 className="font-medium flex items-center gap-2">
                        {owner.name}
                        {owner._id === user?._id && (
                          <span className="text-xs px-2 py-0.5 bg-[var(--secondary)] rounded text-[var(--foreground-muted)]">
                            You
                          </span>
                        )}
                      </h3>
                      <p className="text-sm text-[var(--foreground-muted)]">{owner.email}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-[var(--foreground-muted)]">
                      {owner.lastLoginAt
                        ? `Last login: ${format(new Date(owner.lastLoginAt), 'dd MMM yyyy')}`
                        : 'Never logged in'}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Integrations Section */}
      {activeSection === 'integrations' && (
        <div className="space-y-6">
          {/* Status Message */}
          {xeroMessage && (
            <div className={`p-4 rounded-lg border ${
              xeroMessage.type === 'success'
                ? 'bg-green-500/10 border-green-500/30 text-green-400'
                : 'bg-red-500/10 border-red-500/30 text-red-400'
            }`}>
              <div className="flex items-center justify-between">
                <p>{xeroMessage.text}</p>
                <button
                  onClick={() => setXeroMessage(null)}
                  className="text-current hover:opacity-70"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          )}

          {/* Xero Integration Card */}
          <div className="bg-[var(--card)] p-6 rounded-lg border border-[var(--border)]">
            <div className="flex items-start gap-4">
              {/* Xero Logo */}
              <div className="w-16 h-16 bg-[#13B5EA] rounded-xl flex items-center justify-center flex-shrink-0">
                <svg viewBox="0 0 24 24" className="w-10 h-10 text-white" fill="currentColor">
                  <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 14.54l-2.543-2.542 2.543-2.543a.75.75 0 00-1.061-1.06l-2.543 2.542-2.542-2.543a.75.75 0 00-1.061 1.061l2.543 2.543-2.543 2.542a.75.75 0 001.06 1.061l2.543-2.543 2.543 2.543a.75.75 0 101.06-1.061z"/>
                </svg>
              </div>

              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xl font-semibold">Xero</h3>
                    <p className="text-[var(--foreground-muted)] text-sm">
                      Connect to export invoices to your Xero account
                    </p>
                  </div>

                  {/* Connection Status Badge */}
                  {xeroStatus?.connected ? (
                    <span className="px-3 py-1 rounded-full bg-green-500/20 text-green-400 text-sm font-medium">
                      Connected
                    </span>
                  ) : (
                    <span className="px-3 py-1 rounded-full bg-[var(--secondary)] text-[var(--foreground-muted)] text-sm font-medium">
                      Not Connected
                    </span>
                  )}
                </div>

                {/* Connected State */}
                {xeroStatus?.connected ? (
                  <div className="mt-4 space-y-4">
                    <div className="bg-[var(--secondary)] rounded-lg p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-[var(--foreground-muted)]">Organization</span>
                        <span className="font-medium">{xeroStatus.tenantName}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-[var(--foreground-muted)]">Connected</span>
                        <span className="text-sm">
                          {xeroStatus.connectedAt
                            ? format(new Date(xeroStatus.connectedAt), 'dd MMM yyyy, HH:mm')
                            : 'Unknown'}
                        </span>
                      </div>
                      {xeroStatus.tokenExpired && (
                        <div className="flex items-center gap-2 text-amber-400 text-sm">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                          </svg>
                          <span>Token expired - reconnect required</span>
                        </div>
                      )}
                    </div>

                    <div className="flex gap-3">
                      {xeroStatus.tokenExpired ? (
                        <button
                          onClick={handleConnectXero}
                          disabled={xeroConnecting}
                          className="flex-1 py-2 bg-[var(--accent)] text-[var(--background)] rounded-lg font-medium hover:bg-[var(--accent)]/90 disabled:opacity-50"
                        >
                          {xeroConnecting ? 'Reconnecting...' : 'Reconnect to Xero'}
                        </button>
                      ) : null}
                      <button
                        onClick={handleDisconnectXero}
                        className="px-4 py-2 border border-red-500/50 text-red-400 rounded-lg font-medium hover:bg-red-500/10"
                      >
                        Disconnect
                      </button>
                    </div>
                  </div>
                ) : (
                  /* Not Connected State */
                  <div className="mt-4">
                    <button
                      onClick={handleConnectXero}
                      disabled={xeroConnecting}
                      className="w-full py-3 bg-[#13B5EA] text-white rounded-lg font-medium hover:bg-[#0ea5d9] disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {xeroConnecting ? (
                        <>
                          <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Connecting...
                        </>
                      ) : (
                        <>
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                          </svg>
                          Connect to Xero
                        </>
                      )}
                    </button>
                    <p className="text-xs text-[var(--foreground-muted)] mt-2 text-center">
                      You&apos;ll be redirected to Xero to authorize the connection
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Integration Features Info */}
          <div className="bg-[var(--card)] p-6 rounded-lg border border-[var(--border)]">
            <h4 className="font-semibold mb-4">What you can do with Xero integration</h4>
            <ul className="space-y-3">
              <li className="flex items-start gap-3">
                <svg className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-sm">Export invoices to Xero as draft invoices</span>
              </li>
              <li className="flex items-start gap-3">
                <svg className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-sm">Automatically sync builder contacts to Xero</span>
              </li>
              <li className="flex items-start gap-3">
                <svg className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-sm">Keep your accounting records in sync</span>
              </li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
