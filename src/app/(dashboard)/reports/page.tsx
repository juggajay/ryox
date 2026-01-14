'use client';

import { useQuery } from 'convex/react';
import { api } from '../../../../convex/_generated/api';
import { useAuth } from '@/lib/auth-context';
import { useState } from 'react';

type Period = 'week' | 'month' | 'quarter' | 'year';

const periodLabels: Record<Period, string> = {
  week: 'Last 7 Days',
  month: 'Last 30 Days',
  quarter: 'Last 90 Days',
  year: 'Last Year',
};

export default function ReportsPage() {
  const { user } = useAuth();
  const [period, setPeriod] = useState<Period>('month');
  const [activeTab, setActiveTab] = useState<'profitability' | 'utilization' | 'invoices'>('profitability');

  const profitability = useQuery(api.reports.getProfitability,
    user ? { userId: user._id, period } : 'skip'
  );

  const utilization = useQuery(api.reports.getUtilization,
    user ? { userId: user._id, period } : 'skip'
  );

  const trends = useQuery(api.reports.getTimesheetTrends,
    user ? { userId: user._id, period } : 'skip'
  );

  const invoiceAging = useQuery(api.reports.getInvoiceAging,
    user ? { userId: user._id } : 'skip'
  );

  if (user?.role !== 'owner') {
    return (
      <div className="text-center py-12">
        <h1 className="text-2xl font-bold">Access Denied</h1>
        <p className="text-[var(--foreground-muted)] mt-2">Only owners can view reports</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold">Reports & Analytics</h1>
          <p className="text-[var(--foreground-muted)]">Business performance insights</p>
        </div>
        <select
          value={period}
          onChange={(e) => setPeriod(e.target.value as Period)}
          className="px-3 py-2 bg-[var(--secondary)] border border-[var(--border)] rounded-lg"
        >
          {(Object.entries(periodLabels) as [Period, string][]).map(([key, label]) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </select>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-[var(--border)] pb-2">
        <button
          onClick={() => setActiveTab('profitability')}
          className={`px-4 py-2 rounded-t font-medium transition-colors ${
            activeTab === 'profitability'
              ? 'bg-[var(--accent)] text-[var(--background)]'
              : 'text-[var(--foreground-muted)] hover:text-[var(--foreground)]'
          }`}
        >
          Profitability
        </button>
        <button
          onClick={() => setActiveTab('utilization')}
          className={`px-4 py-2 rounded-t font-medium transition-colors ${
            activeTab === 'utilization'
              ? 'bg-[var(--accent)] text-[var(--background)]'
              : 'text-[var(--foreground-muted)] hover:text-[var(--foreground)]'
          }`}
        >
          Utilization
        </button>
        <button
          onClick={() => setActiveTab('invoices')}
          className={`px-4 py-2 rounded-t font-medium transition-colors ${
            activeTab === 'invoices'
              ? 'bg-[var(--accent)] text-[var(--background)]'
              : 'text-[var(--foreground-muted)] hover:text-[var(--foreground)]'
          }`}
        >
          Invoice Aging
        </button>
      </div>

      {/* Profitability Tab */}
      {activeTab === 'profitability' && (
        <div className="space-y-6">
          {!profitability ? (
            <div className="animate-pulse space-y-4">
              <div className="grid grid-cols-4 gap-4">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-24 bg-[var(--card)] rounded-lg" />
                ))}
              </div>
            </div>
          ) : (
            <>
              {/* Summary Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-[var(--card)] p-4 rounded-lg border border-[var(--border)]">
                  <p className="text-sm text-[var(--foreground-muted)]">Total Revenue</p>
                  <p className="text-2xl font-bold text-[var(--accent)]">
                    ${profitability.summary.totalRevenue.toLocaleString()}
                  </p>
                </div>
                <div className="bg-[var(--card)] p-4 rounded-lg border border-[var(--border)]">
                  <p className="text-sm text-[var(--foreground-muted)]">Labour Cost</p>
                  <p className="text-2xl font-bold">
                    ${profitability.summary.totalLabourCost.toLocaleString()}
                  </p>
                </div>
                <div className="bg-[var(--card)] p-4 rounded-lg border border-[var(--border)]">
                  <p className="text-sm text-[var(--foreground-muted)]">Gross Profit</p>
                  <p className={`text-2xl font-bold ${profitability.summary.grossProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    ${profitability.summary.grossProfit.toLocaleString()}
                  </p>
                  <p className="text-xs text-[var(--foreground-muted)]">
                    {profitability.summary.grossMargin.toFixed(1)}% margin
                  </p>
                </div>
                <div className="bg-[var(--card)] p-4 rounded-lg border border-[var(--border)]">
                  <p className="text-sm text-[var(--foreground-muted)]">Net Profit</p>
                  <p className={`text-2xl font-bold ${profitability.summary.netProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    ${profitability.summary.netProfit.toLocaleString()}
                  </p>
                  <p className="text-xs text-[var(--foreground-muted)]">
                    {profitability.summary.netMargin.toFixed(1)}% margin
                  </p>
                </div>
              </div>

              {/* Additional Metrics */}
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-[var(--card)] p-4 rounded-lg border border-[var(--border)]">
                  <p className="text-sm text-[var(--foreground-muted)]">Total Hours</p>
                  <p className="text-xl font-bold">{profitability.summary.totalHours.toFixed(1)}h</p>
                </div>
                <div className="bg-[var(--card)] p-4 rounded-lg border border-[var(--border)]">
                  <p className="text-sm text-[var(--foreground-muted)]">Expenses</p>
                  <p className="text-xl font-bold">${profitability.summary.totalExpenses.toLocaleString()}</p>
                </div>
                <div className="bg-[var(--card)] p-4 rounded-lg border border-[var(--border)]">
                  <p className="text-sm text-[var(--foreground-muted)]">Overhead Allocated</p>
                  <p className="text-xl font-bold">${profitability.summary.allocatedOverhead.toLocaleString()}</p>
                </div>
              </div>

              {/* Hours Trend Chart (Simple Bar) */}
              {trends && trends.length > 0 && (
                <div className="bg-[var(--card)] p-6 rounded-lg border border-[var(--border)]">
                  <h2 className="text-xl font-semibold mb-4">Hours Trend</h2>
                  <div className="flex items-end gap-2 h-40">
                    {trends.map((week) => {
                      const maxHours = Math.max(...trends.map((t) => t.hours));
                      const height = maxHours > 0 ? (week.hours / maxHours) * 100 : 0;
                      return (
                        <div key={week.week} className="flex-1 flex flex-col items-center">
                          <div
                            className="w-full bg-[var(--accent)] rounded-t"
                            style={{ height: `${height}%` }}
                            title={`${week.hours}h`}
                          />
                          <p className="text-xs text-[var(--foreground-muted)] mt-2 truncate w-full text-center">
                            {week.weekLabel}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Job Profitability Table */}
              <div className="bg-[var(--card)] p-6 rounded-lg border border-[var(--border)]">
                <h2 className="text-xl font-semibold mb-4">Job Profitability</h2>
                {profitability.jobProfitability.length === 0 ? (
                  <p className="text-[var(--foreground-muted)]">No job data available</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-[var(--border)]">
                          <th className="text-left py-2">Job</th>
                          <th className="text-left py-2">Type</th>
                          <th className="text-right py-2">Hours</th>
                          <th className="text-right py-2">Revenue</th>
                          <th className="text-right py-2">Costs</th>
                          <th className="text-right py-2">Profit</th>
                          <th className="text-right py-2">Margin</th>
                        </tr>
                      </thead>
                      <tbody>
                        {profitability.jobProfitability.map((job) => (
                          <tr key={job._id} className="border-b border-[var(--border)]/50">
                            <td className="py-2">{job.name}</td>
                            <td className="py-2 capitalize">{job.jobType}</td>
                            <td className="py-2 text-right">{job.hours.toFixed(1)}</td>
                            <td className="py-2 text-right">${job.revenue.toLocaleString()}</td>
                            <td className="py-2 text-right">${(job.labourCost + job.expenses).toLocaleString()}</td>
                            <td className={`py-2 text-right ${job.profit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                              ${job.profit.toLocaleString()}
                            </td>
                            <td className={`py-2 text-right ${job.margin >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                              {job.margin.toFixed(1)}%
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* Utilization Tab */}
      {activeTab === 'utilization' && (
        <div className="space-y-6">
          {!utilization ? (
            <div className="animate-pulse space-y-4">
              <div className="grid grid-cols-4 gap-4">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-24 bg-[var(--card)] rounded-lg" />
                ))}
              </div>
            </div>
          ) : (
            <>
              {/* Team Summary */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-[var(--card)] p-4 rounded-lg border border-[var(--border)]">
                  <p className="text-sm text-[var(--foreground-muted)]">Team Utilization</p>
                  <p className="text-2xl font-bold text-[var(--accent)]">
                    {utilization.team.utilizationRate}%
                  </p>
                </div>
                <div className="bg-[var(--card)] p-4 rounded-lg border border-[var(--border)]">
                  <p className="text-sm text-[var(--foreground-muted)]">Total Hours</p>
                  <p className="text-2xl font-bold">
                    {utilization.team.totalHours.toFixed(1)}h
                  </p>
                  <p className="text-xs text-[var(--foreground-muted)]">
                    of {utilization.team.availableHours}h available
                  </p>
                </div>
                <div className="bg-[var(--card)] p-4 rounded-lg border border-[var(--border)]">
                  <p className="text-sm text-[var(--foreground-muted)]">Revenue Generated</p>
                  <p className="text-2xl font-bold text-green-400">
                    ${utilization.team.revenue.toLocaleString()}
                  </p>
                </div>
                <div className="bg-[var(--card)] p-4 rounded-lg border border-[var(--border)]">
                  <p className="text-sm text-[var(--foreground-muted)]">Labour Margin</p>
                  <p className="text-2xl font-bold text-[var(--accent)]">
                    ${utilization.team.margin.toLocaleString()}
                  </p>
                </div>
              </div>

              {/* Worker Utilization */}
              <div className="bg-[var(--card)] p-6 rounded-lg border border-[var(--border)]">
                <h2 className="text-xl font-semibold mb-4">Worker Utilization</h2>
                {utilization.workers.length === 0 ? (
                  <p className="text-[var(--foreground-muted)]">No worker data available</p>
                ) : (
                  <div className="space-y-4">
                    {utilization.workers.map((worker) => (
                      <div key={worker._id} className="p-4 bg-[var(--secondary)] rounded-lg">
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <p className="font-medium">{worker.name}</p>
                            <p className="text-sm text-[var(--foreground-muted)] capitalize">
                              {worker.tradeClassification}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-lg font-bold">{worker.utilizationRate}%</p>
                            <p className="text-xs text-[var(--foreground-muted)]">
                              {worker.totalHours.toFixed(1)}h / {worker.availableHours}h
                            </p>
                          </div>
                        </div>
                        {/* Utilization Bar */}
                        <div className="w-full h-2 bg-[var(--background)] rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              worker.utilizationRate >= 80 ? 'bg-green-500' :
                              worker.utilizationRate >= 60 ? 'bg-yellow-500' :
                              'bg-red-500'
                            }`}
                            style={{ width: `${Math.min(worker.utilizationRate, 100)}%` }}
                          />
                        </div>
                        <div className="flex justify-between mt-2 text-sm">
                          <span className="text-[var(--foreground-muted)]">
                            {worker.timesheetCount} timesheets
                          </span>
                          <span className="text-green-400">
                            ${worker.margin.toLocaleString()} margin
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* Invoice Aging Tab */}
      {activeTab === 'invoices' && (
        <div className="space-y-6">
          {!invoiceAging ? (
            <div className="animate-pulse space-y-4">
              <div className="grid grid-cols-5 gap-4">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="h-24 bg-[var(--card)] rounded-lg" />
                ))}
              </div>
            </div>
          ) : (
            <>
              {/* Aging Buckets */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div className="bg-[var(--card)] p-4 rounded-lg border border-[var(--border)]">
                  <p className="text-sm text-[var(--foreground-muted)]">Current (0-30)</p>
                  <p className="text-2xl font-bold text-green-400">
                    ${invoiceAging.aging.current.amount.toLocaleString()}
                  </p>
                  <p className="text-xs text-[var(--foreground-muted)]">
                    {invoiceAging.aging.current.count} invoices
                  </p>
                </div>
                <div className="bg-[var(--card)] p-4 rounded-lg border border-[var(--border)]">
                  <p className="text-sm text-[var(--foreground-muted)]">31-60 Days</p>
                  <p className="text-2xl font-bold text-yellow-400">
                    ${invoiceAging.aging.days30.amount.toLocaleString()}
                  </p>
                  <p className="text-xs text-[var(--foreground-muted)]">
                    {invoiceAging.aging.days30.count} invoices
                  </p>
                </div>
                <div className="bg-[var(--card)] p-4 rounded-lg border border-[var(--border)]">
                  <p className="text-sm text-[var(--foreground-muted)]">61-90 Days</p>
                  <p className="text-2xl font-bold text-orange-400">
                    ${invoiceAging.aging.days60.amount.toLocaleString()}
                  </p>
                  <p className="text-xs text-[var(--foreground-muted)]">
                    {invoiceAging.aging.days60.count} invoices
                  </p>
                </div>
                <div className="bg-[var(--card)] p-4 rounded-lg border border-[var(--border)]">
                  <p className="text-sm text-[var(--foreground-muted)]">90+ Days</p>
                  <p className="text-2xl font-bold text-red-400">
                    ${invoiceAging.aging.over90.amount.toLocaleString()}
                  </p>
                  <p className="text-xs text-[var(--foreground-muted)]">
                    {invoiceAging.aging.over90.count} invoices
                  </p>
                </div>
                <div className="bg-[var(--card)] p-4 rounded-lg border border-[var(--border)]">
                  <p className="text-sm text-[var(--foreground-muted)]">Total Outstanding</p>
                  <p className="text-2xl font-bold text-[var(--accent)]">
                    ${(
                      invoiceAging.aging.current.amount +
                      invoiceAging.aging.days30.amount +
                      invoiceAging.aging.days60.amount +
                      invoiceAging.aging.over90.amount
                    ).toLocaleString()}
                  </p>
                </div>
              </div>

              {/* Overdue by Builder */}
              <div className="bg-[var(--card)] p-6 rounded-lg border border-[var(--border)]">
                <h2 className="text-xl font-semibold mb-4">Overdue by Builder</h2>
                {invoiceAging.overdueByBuilder.length === 0 ? (
                  <p className="text-[var(--foreground-muted)]">No overdue invoices</p>
                ) : (
                  <div className="space-y-3">
                    {invoiceAging.overdueByBuilder.map((builder, i) => (
                      <div key={i} className="flex justify-between items-center p-3 bg-[var(--secondary)] rounded-lg">
                        <div>
                          <p className="font-medium">{builder.name}</p>
                          <p className="text-sm text-[var(--foreground-muted)]">
                            {builder.count} overdue invoice{builder.count !== 1 ? 's' : ''}
                          </p>
                        </div>
                        <p className="text-lg font-bold text-red-400">
                          ${builder.amount.toLocaleString()}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
