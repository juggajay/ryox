"use client";

import { useQuery } from "convex/react";
import { useAuth } from "@/lib/auth-context";
import { api } from "../../../../convex/_generated/api";
import Link from "next/link";

function StatCard({
  title,
  value,
  subtitle,
  icon,
  trend,
}: {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  trend?: { value: number; positive: boolean };
}) {
  return (
    <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-6">
      <div className="flex items-start justify-between mb-4">
        <div className="w-10 h-10 rounded-lg bg-[var(--accent)]/10 flex items-center justify-center text-[var(--accent)]">
          {icon}
        </div>
        {trend && (
          <span
            className={`text-xs font-medium px-2 py-1 rounded-full ${
              trend.positive
                ? "bg-green-500/10 text-green-400"
                : "bg-red-500/10 text-red-400"
            }`}
          >
            {trend.positive ? "+" : ""}
            {trend.value}%
          </span>
        )}
      </div>
      <p className="text-2xl font-semibold mb-1">{value}</p>
      <p className="text-sm text-[var(--foreground-muted)]">{title}</p>
      {subtitle && (
        <p className="text-xs text-[var(--foreground-muted)] mt-1">
          {subtitle}
        </p>
      )}
    </div>
  );
}

function OwnerDashboard() {
  const { user } = useAuth();

  const jobs = useQuery(api.jobs.list, user ? { userId: user._id } : "skip");
  const workers = useQuery(
    api.workers.list,
    user ? { userId: user._id } : "skip"
  );
  const builders = useQuery(
    api.builders.list,
    user ? { userId: user._id } : "skip"
  );
  const expiringCerts = useQuery(
    api.workers.getExpiringCertifications,
    user ? { userId: user._id, daysAhead: 30 } : "skip"
  );

  const activeJobs = jobs?.filter((j) => j.status === "active") || [];
  const pendingTimesheets =
    jobs?.reduce((sum, j) => sum + (j.stats.pendingTimesheets || 0), 0) || 0;
  const activeWorkers = workers?.filter((w) => w.status === "active") || [];

  return (
    <div>
      <div className="mb-8">
        <h1
          className="text-3xl font-semibold mb-2"
          style={{ fontFamily: "var(--font-display)" }}
        >
          Dashboard
        </h1>
        <p className="text-[var(--foreground-muted)]">
          Overview of your carpentry business
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard
          title="Active Jobs"
          value={activeJobs.length}
          icon={
            <svg
              className="w-5 h-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5"
              />
            </svg>
          }
        />
        <StatCard
          title="Active Workers"
          value={activeWorkers.length}
          icon={
            <svg
              className="w-5 h-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
          }
        />
        <StatCard
          title="Pending Timesheets"
          value={pendingTimesheets}
          subtitle="Awaiting approval"
          icon={
            <svg
              className="w-5 h-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          }
        />
        <StatCard
          title="Builders"
          value={builders?.length || 0}
          icon={
            <svg
              className="w-5 h-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5"
              />
            </svg>
          }
        />
      </div>

      {/* Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Active Jobs */}
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold">Active Jobs</h2>
            <Link
              href="/jobs"
              className="text-sm text-[var(--accent)] hover:underline"
            >
              View all
            </Link>
          </div>
          {activeJobs.length === 0 ? (
            <div className="text-center py-8 text-[var(--foreground-muted)]">
              <p className="mb-4">No active jobs</p>
              <Link href="/jobs" className="btn-primary inline-block text-sm">
                Create Job
              </Link>
            </div>
          ) : (
            <ul className="space-y-3">
              {activeJobs.slice(0, 5).map((job) => (
                <li
                  key={job._id}
                  className="flex items-center justify-between p-3 bg-[var(--background)] rounded-lg"
                >
                  <div>
                    <p className="font-medium">{job.name}</p>
                    <p className="text-sm text-[var(--foreground-muted)]">
                      {job.builder?.companyName}
                    </p>
                  </div>
                  <span
                    className={`text-xs px-2 py-1 rounded-full ${
                      job.jobType === "contract"
                        ? "bg-blue-500/10 text-blue-400"
                        : "bg-purple-500/10 text-purple-400"
                    }`}
                  >
                    {job.jobType === "contract" ? "Contract" : "Labour Hire"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Expiring Certifications */}
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold">Expiring Certifications</h2>
            <Link
              href="/workers"
              className="text-sm text-[var(--accent)] hover:underline"
            >
              View workers
            </Link>
          </div>
          {!expiringCerts || expiringCerts.length === 0 ? (
            <div className="text-center py-8 text-[var(--foreground-muted)]">
              <svg
                className="w-12 h-12 mx-auto mb-3 opacity-50"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <p>No certifications expiring in the next 30 days</p>
            </div>
          ) : (
            <ul className="space-y-3">
              {expiringCerts.slice(0, 5).map((item, idx) => (
                <li
                  key={idx}
                  className="flex items-center justify-between p-3 bg-[var(--background)] rounded-lg"
                >
                  <div>
                    <p className="font-medium">{item.worker.name}</p>
                    <p className="text-sm text-[var(--foreground-muted)]">
                      {item.certification.name}
                    </p>
                  </div>
                  <span
                    className={`text-xs px-2 py-1 rounded-full ${
                      item.daysUntilExpiry <= 7
                        ? "bg-red-500/10 text-red-400"
                        : item.daysUntilExpiry <= 14
                          ? "bg-yellow-500/10 text-yellow-400"
                          : "bg-orange-500/10 text-orange-400"
                    }`}
                  >
                    {item.daysUntilExpiry <= 0
                      ? "Expired"
                      : `${item.daysUntilExpiry} days`}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function WorkerDashboard() {
  const { user } = useAuth();
  const jobs = useQuery(
    api.jobs.getWorkerJobs,
    user ? { userId: user._id } : "skip"
  );

  const activeJobs = jobs?.filter((j) => j.status === "active") || [];

  return (
    <div>
      <div className="mb-8">
        <h1
          className="text-3xl font-semibold mb-2"
          style={{ fontFamily: "var(--font-display)" }}
        >
          My Jobs
        </h1>
        <p className="text-[var(--foreground-muted)]">
          Your assigned jobs and work schedule
        </p>
      </div>

      {activeJobs.length === 0 ? (
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-12 text-center">
          <svg
            className="w-16 h-16 mx-auto mb-4 text-[var(--foreground-muted)] opacity-50"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5"
            />
          </svg>
          <p className="text-[var(--foreground-muted)]">
            No jobs assigned to you yet
          </p>
        </div>
      ) : (
        <div className="grid gap-4">
          {activeJobs.map((job) => (
            <div
              key={job._id}
              className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-6"
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold mb-1">{job.name}</h3>
                  <p className="text-[var(--foreground-muted)]">
                    {job.builder?.companyName}
                  </p>
                </div>
                <span
                  className={`text-xs px-2 py-1 rounded-full ${
                    job.jobType === "contract"
                      ? "bg-blue-500/10 text-blue-400"
                      : "bg-purple-500/10 text-purple-400"
                  }`}
                >
                  {job.jobType === "contract" ? "Contract" : "Labour Hire"}
                </span>
              </div>
              <div className="flex items-center gap-2 text-sm text-[var(--foreground-muted)]">
                <svg
                  className="w-4 h-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                </svg>
                {job.siteAddress}
              </div>
              <div className="mt-4 pt-4 border-t border-[var(--border)] flex gap-3">
                <Link href="/timesheets" className="btn-primary text-sm">
                  Submit Timesheet
                </Link>
                <Link href={`/jobs/${job._id}`} className="btn-secondary text-sm">
                  View Details
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();

  if (!user) return null;

  return user.role === "owner" ? <OwnerDashboard /> : <WorkerDashboard />;
}
