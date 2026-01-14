'use client';

import { useQuery, useMutation } from 'convex/react';
import { api } from '../../../../convex/_generated/api';
import { useAuth } from '@/lib/auth-context';
import { useState } from 'react';
import { format } from 'date-fns';
import { Id } from '../../../../convex/_generated/dataModel';

type Category = 'materials' | 'equipment' | 'transport' | 'other';

const categoryLabels: Record<Category, string> = {
  materials: 'Materials',
  equipment: 'Equipment',
  transport: 'Transport',
  other: 'Other',
};

const categoryColors: Record<Category, string> = {
  materials: 'bg-blue-500/20 text-blue-400',
  equipment: 'bg-purple-500/20 text-purple-400',
  transport: 'bg-green-500/20 text-green-400',
  other: 'bg-gray-500/20 text-gray-400',
};

export default function ExpensesPage() {
  const { user } = useAuth();
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    jobId: '',
    description: '',
    amount: '',
    category: 'materials' as Category,
    date: new Date().toISOString().split('T')[0],
  });

  // Queries
  const expenses = useQuery(api.expenses.list,
    user ? { userId: user._id, category: selectedCategory || undefined } : 'skip'
  );

  const summary = useQuery(api.expenses.getSummary,
    user ? { userId: user._id } : 'skip'
  );

  const jobs = useQuery(api.jobs.list,
    user ? { userId: user._id } : 'skip'
  );

  // Mutations
  const addExpense = useMutation(api.expenses.add);
  const removeExpense = useMutation(api.expenses.remove);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !formData.jobId || !formData.description || !formData.amount) return;

    setIsSubmitting(true);
    try {
      await addExpense({
        userId: user._id,
        jobId: formData.jobId as Id<"jobs">,
        description: formData.description,
        amount: parseFloat(formData.amount),
        category: formData.category,
        date: new Date(formData.date).getTime(),
      });

      setFormData({
        jobId: '',
        description: '',
        amount: '',
        category: 'materials',
        date: new Date().toISOString().split('T')[0],
      });
      setShowAddForm(false);
    } catch (err) {
      console.error('Failed to add expense:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (expenseId: Id<"expenses">) => {
    if (!user || !confirm('Are you sure you want to delete this expense?')) return;
    await removeExpense({ userId: user._id, expenseId });
  };

  if (user?.role !== 'owner') {
    return (
      <div className="text-center py-12">
        <h1 className="text-2xl font-bold">Access Denied</h1>
        <p className="text-[var(--foreground-muted)] mt-2">Only owners can view expenses</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold">Expenses</h1>
          <p className="text-[var(--foreground-muted)]">Track job expenses and receipts</p>
        </div>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="px-4 py-2 bg-[var(--accent)] text-[var(--background)] rounded-lg font-medium hover:bg-[var(--accent)]/90"
        >
          {showAddForm ? 'Cancel' : '+ Add Expense'}
        </button>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-[var(--card)] p-4 rounded-lg border border-[var(--border)]">
            <p className="text-sm text-[var(--foreground-muted)]">Total Expenses</p>
            <p className="text-2xl font-bold text-[var(--accent)]">
              ${summary.total.toLocaleString()}
            </p>
          </div>
          <div className="bg-[var(--card)] p-4 rounded-lg border border-[var(--border)]">
            <p className="text-sm text-[var(--foreground-muted)]">This Month</p>
            <p className="text-2xl font-bold">
              ${summary.thisMonth.toLocaleString()}
            </p>
          </div>
          <div className="bg-[var(--card)] p-4 rounded-lg border border-[var(--border)]">
            <p className="text-sm text-[var(--foreground-muted)]">Materials</p>
            <p className="text-2xl font-bold text-blue-400">
              ${summary.byCategory.materials.toLocaleString()}
            </p>
          </div>
          <div className="bg-[var(--card)] p-4 rounded-lg border border-[var(--border)]">
            <p className="text-sm text-[var(--foreground-muted)]">Equipment</p>
            <p className="text-2xl font-bold text-purple-400">
              ${summary.byCategory.equipment.toLocaleString()}
            </p>
          </div>
        </div>
      )}

      {/* Add Form */}
      {showAddForm && (
        <form onSubmit={handleSubmit} className="bg-[var(--card)] p-6 rounded-lg border border-[var(--border)] space-y-4">
          <h3 className="font-semibold text-lg">Add New Expense</h3>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[var(--foreground-muted)] mb-1">
                Job *
              </label>
              <select
                value={formData.jobId}
                onChange={(e) => setFormData({ ...formData, jobId: e.target.value })}
                required
                className="w-full px-3 py-2 bg-[var(--secondary)] border border-[var(--border)] rounded-lg"
              >
                <option value="">Select job...</option>
                {jobs?.map((job) => (
                  <option key={job._id} value={job._id}>
                    {job.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-[var(--foreground-muted)] mb-1">
                Category *
              </label>
              <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value as Category })}
                required
                className="w-full px-3 py-2 bg-[var(--secondary)] border border-[var(--border)] rounded-lg"
              >
                {(Object.entries(categoryLabels) as [Category, string][]).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--foreground-muted)] mb-1">
              Description *
            </label>
            <input
              type="text"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              required
              placeholder="e.g., Timber for framing"
              className="w-full px-3 py-2 bg-[var(--secondary)] border border-[var(--border)] rounded-lg"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[var(--foreground-muted)] mb-1">
                Amount ($) *
              </label>
              <input
                type="number"
                step="0.01"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                required
                placeholder="0.00"
                className="w-full px-3 py-2 bg-[var(--secondary)] border border-[var(--border)] rounded-lg"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[var(--foreground-muted)] mb-1">
                Date *
              </label>
              <input
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                required
                className="w-full px-3 py-2 bg-[var(--secondary)] border border-[var(--border)] rounded-lg"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-2 bg-[var(--accent)] text-[var(--background)] rounded-lg font-medium hover:bg-[var(--accent)]/90 disabled:opacity-50"
          >
            {isSubmitting ? 'Adding...' : 'Add Expense'}
          </button>
        </form>
      )}

      {/* Category Filter */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => setSelectedCategory(null)}
          className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
            selectedCategory === null
              ? 'bg-[var(--accent)] text-[var(--background)]'
              : 'bg-[var(--secondary)] text-[var(--foreground-muted)] hover:text-[var(--foreground)]'
          }`}
        >
          All
        </button>
        {(Object.entries(categoryLabels) as [Category, string][]).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setSelectedCategory(key)}
            className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
              selectedCategory === key
                ? 'bg-[var(--accent)] text-[var(--background)]'
                : 'bg-[var(--secondary)] text-[var(--foreground-muted)] hover:text-[var(--foreground)]'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Expenses List */}
      <div className="space-y-3">
        {!expenses ? (
          <div className="animate-pulse space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 bg-[var(--card)] rounded-lg" />
            ))}
          </div>
        ) : expenses.length === 0 ? (
          <div className="text-center py-12 bg-[var(--card)] rounded-lg border border-[var(--border)]">
            <p className="text-lg font-medium">No expenses found</p>
            <p className="text-sm text-[var(--foreground-muted)] mt-1">
              Add your first expense to start tracking
            </p>
          </div>
        ) : (
          expenses.map((expense) => (
            <div
              key={expense._id}
              className="bg-[var(--card)] p-4 rounded-lg border border-[var(--border)] flex items-center justify-between"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-medium">{expense.description}</h3>
                  <span className={`px-2 py-0.5 rounded text-xs ${categoryColors[expense.category as Category]}`}>
                    {categoryLabels[expense.category as Category]}
                  </span>
                </div>
                <p className="text-sm text-[var(--foreground-muted)]">
                  {expense.job?.name} • {format(new Date(expense.date), 'dd MMM yyyy')}
                </p>
                <p className="text-xs text-[var(--foreground-muted)]">
                  Added by {expense.creatorName}
                </p>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-xl font-bold text-[var(--accent)]">
                  ${expense.amount.toLocaleString()}
                </span>
                <button
                  onClick={() => handleDelete(expense._id)}
                  className="text-red-400 hover:text-red-300 text-sm"
                >
                  Delete
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
