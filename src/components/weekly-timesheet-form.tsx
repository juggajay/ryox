'use client';

import { useState, useMemo } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { useAuth } from '@/lib/auth-context';
import { SignaturePad } from './signature-pad';
import { Id } from '../../convex/_generated/dataModel';

interface DayEntry {
  dayOfWeek: string;
  date: Date;
  startTime: string;
  endTime: string;
  breakMinutes: number;
  isWorked: boolean;
}

const DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

// Get Monday of the current week
function getMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

// Format date as "Mon 13"
function formatShortDate(date: Date): string {
  const day = date.getDate();
  return `${DAYS_OF_WEEK[getDayIndex(date)].slice(0, 3)} ${day}`;
}

// Get day index (0 = Monday, 6 = Sunday)
function getDayIndex(date: Date): number {
  const day = date.getDay();
  return day === 0 ? 6 : day - 1;
}

// Calculate hours from times
function calculateHours(startTime: string, endTime: string, breakMinutes: number): number {
  if (!startTime || !endTime) return 0;
  const [startH, startM] = startTime.split(':').map(Number);
  const [endH, endM] = endTime.split(':').map(Number);
  const startMinutes = startH * 60 + startM;
  const endMinutes = endH * 60 + endM;
  const totalMinutes = endMinutes - startMinutes - breakMinutes;
  return Math.max(0, Math.round((totalMinutes / 60) * 100) / 100);
}

interface WeeklyTimesheetFormProps {
  onSuccess?: () => void;
  initialData?: {
    entries: Array<{
      dayOfWeek: string;
      date: string;
      startTime: string;
      endTime: string;
      breakMinutes: number;
    }>;
    signatoryName?: string;
    signatoryCompany?: string;
    siteName?: string;
  };
  photoStorageId?: string;
}

export function WeeklyTimesheetForm({ onSuccess, initialData, photoStorageId }: WeeklyTimesheetFormProps) {
  const { user } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [signatureDataUrl, setSignatureDataUrl] = useState<string | null>(null);
  const [weekStart, setWeekStart] = useState(() => getMonday(new Date()));
  const [jobId, setJobId] = useState('');
  const [signatoryName, setSignatoryName] = useState(initialData?.signatoryName || '');
  const [signatoryCompany, setSignatoryCompany] = useState(initialData?.signatoryCompany || '');
  const [notes, setNotes] = useState('');

  // Initialize entries for the week
  const [entries, setEntries] = useState<DayEntry[]>(() => {
    const weekEntries: DayEntry[] = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(weekStart);
      date.setDate(date.getDate() + i);

      // Check if we have initial data for this day
      const dayName = DAYS_OF_WEEK[i];
      const initialEntry = initialData?.entries?.find(e =>
        e.dayOfWeek?.toLowerCase() === dayName.toLowerCase()
      );

      weekEntries.push({
        dayOfWeek: dayName,
        date,
        startTime: initialEntry?.startTime || '',
        endTime: initialEntry?.endTime || '',
        breakMinutes: initialEntry?.breakMinutes ?? 30,
        isWorked: !!initialEntry?.startTime,
      });
    }
    return weekEntries;
  });

  // Update entries when week changes
  const updateWeek = (newWeekStart: Date) => {
    setWeekStart(newWeekStart);
    setEntries(prev => prev.map((entry, i) => {
      const date = new Date(newWeekStart);
      date.setDate(date.getDate() + i);
      return { ...entry, date };
    }));
  };

  // Get worker's allocated jobs
  const jobs = useQuery(api.jobs.getWorkerJobs,
    user ? { userId: user._id } : 'skip'
  );

  const submitWeeklyTimesheet = useMutation(api.timesheets.submitWeeklyTimesheet);
  const generateUploadUrl = useMutation(api.timesheets.generateUploadUrl);

  // Calculate total hours
  const totalHours = useMemo(() => {
    return entries.reduce((sum, entry) => {
      if (!entry.isWorked || !entry.startTime || !entry.endTime) return sum;
      return sum + calculateHours(entry.startTime, entry.endTime, entry.breakMinutes);
    }, 0);
  }, [entries]);

  // Get worked entries count
  const workedDaysCount = entries.filter(e => e.isWorked && e.startTime && e.endTime).length;

  const handleEntryChange = (index: number, field: keyof DayEntry, value: string | number | boolean) => {
    setEntries(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };

      // If setting start or end time, mark as worked
      if ((field === 'startTime' || field === 'endTime') && value) {
        updated[index].isWorked = true;
      }

      return updated;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !jobId) return;

    const workedEntries = entries.filter(e => e.isWorked && e.startTime && e.endTime);
    if (workedEntries.length === 0) {
      setError('Please enter times for at least one day');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      let signatureUrl: string | undefined;

      // Upload signature if provided
      if (signatureDataUrl) {
        const uploadUrl = await generateUploadUrl();
        const response = await fetch(signatureDataUrl);
        const blob = await response.blob();

        const uploadResponse = await fetch(uploadUrl, {
          method: 'POST',
          headers: { 'Content-Type': blob.type },
          body: blob,
        });

        const { storageId } = await uploadResponse.json();
        signatureUrl = storageId;
      }

      await submitWeeklyTimesheet({
        userId: user._id,
        jobId: jobId as Id<"jobs">,
        weekStartDate: weekStart.getTime(),
        entries: workedEntries.map(e => ({
          date: e.date.getTime(),
          startTime: e.startTime,
          endTime: e.endTime,
          breakMinutes: e.breakMinutes,
        })),
        photoUrl: photoStorageId,
        signatureUrl,
        signatoryName: signatoryName || undefined,
        signatoryCompany: signatoryCompany || undefined,
        notes: notes || undefined,
      });

      // Reset form
      setJobId('');
      setSignatoryName('');
      setSignatoryCompany('');
      setNotes('');
      setSignatureDataUrl(null);
      setEntries(prev => prev.map(e => ({
        ...e,
        startTime: '',
        endTime: '',
        breakMinutes: 30,
        isWorked: false,
      })));

      onSuccess?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit timesheet');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Format week range for display
  const weekEndDate = new Date(weekStart);
  weekEndDate.setDate(weekEndDate.getDate() + 6);
  const weekRangeText = `${weekStart.toLocaleDateString('en-AU', { month: 'short', day: 'numeric' })} - ${weekEndDate.toLocaleDateString('en-AU', { month: 'short', day: 'numeric', year: 'numeric' })}`;

  if (!jobs) {
    return <div className="animate-pulse bg-[var(--card)] rounded-lg h-96" />;
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 bg-[var(--card)] p-4 sm:p-6 rounded-lg border border-[var(--border)]">
      <h2 className="text-xl font-semibold">Weekly Timesheet</h2>

      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/50 rounded text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Week Selector */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => {
            const prev = new Date(weekStart);
            prev.setDate(prev.getDate() - 7);
            updateWeek(prev);
          }}
          className="p-2 hover:bg-[var(--secondary)] rounded-lg transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
        </button>
        <div className="text-center">
          <div className="text-sm text-[var(--foreground-muted)]">Week of</div>
          <div className="font-medium">{weekRangeText}</div>
        </div>
        <button
          type="button"
          onClick={() => {
            const next = new Date(weekStart);
            next.setDate(next.getDate() + 7);
            updateWeek(next);
          }}
          className="p-2 hover:bg-[var(--secondary)] rounded-lg transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
          </svg>
        </button>
      </div>

      {/* Job Selection */}
      <div>
        <label className="block text-sm font-medium text-[var(--foreground-muted)] mb-1">
          Job *
        </label>
        <select
          value={jobId}
          onChange={(e) => setJobId(e.target.value)}
          required
          className="w-full px-3 py-2 bg-[var(--secondary)] border border-[var(--border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
        >
          <option value="">Select a job...</option>
          {jobs.map((job) => job && (
            <option key={job._id} value={job._id}>
              {job.name} - {job.siteAddress}
            </option>
          ))}
        </select>
      </div>

      {/* Weekly Entry Grid */}
      <div className="overflow-x-auto -mx-4 sm:mx-0">
        <table className="w-full min-w-[500px]">
          <thead>
            <tr className="text-sm text-[var(--foreground-muted)] border-b border-[var(--border)]">
              <th className="text-left py-2 px-2 sm:px-3 font-medium">Day</th>
              <th className="text-left py-2 px-2 sm:px-3 font-medium">Start</th>
              <th className="text-left py-2 px-2 sm:px-3 font-medium">End</th>
              <th className="text-left py-2 px-2 sm:px-3 font-medium">Break</th>
              <th className="text-right py-2 px-2 sm:px-3 font-medium">Hours</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry, index) => {
              const hours = entry.isWorked && entry.startTime && entry.endTime
                ? calculateHours(entry.startTime, entry.endTime, entry.breakMinutes)
                : 0;

              return (
                <tr key={entry.dayOfWeek} className="border-b border-[var(--border)]/50">
                  <td className="py-2 px-2 sm:px-3">
                    <div className="text-sm font-medium">{formatShortDate(entry.date)}</div>
                  </td>
                  <td className="py-2 px-2 sm:px-3">
                    <input
                      type="time"
                      value={entry.startTime}
                      onChange={(e) => handleEntryChange(index, 'startTime', e.target.value)}
                      className="w-full px-2 py-1 text-sm bg-[var(--secondary)] border border-[var(--border)] rounded focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
                    />
                  </td>
                  <td className="py-2 px-2 sm:px-3">
                    <input
                      type="time"
                      value={entry.endTime}
                      onChange={(e) => handleEntryChange(index, 'endTime', e.target.value)}
                      className="w-full px-2 py-1 text-sm bg-[var(--secondary)] border border-[var(--border)] rounded focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
                    />
                  </td>
                  <td className="py-2 px-2 sm:px-3">
                    <input
                      type="number"
                      value={entry.breakMinutes}
                      onChange={(e) => handleEntryChange(index, 'breakMinutes', parseInt(e.target.value) || 0)}
                      min="0"
                      className="w-16 px-2 py-1 text-sm bg-[var(--secondary)] border border-[var(--border)] rounded focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
                    />
                  </td>
                  <td className="py-2 px-2 sm:px-3 text-right">
                    <span className={`text-sm font-medium ${hours > 0 ? 'text-[var(--accent)]' : 'text-[var(--foreground-muted)]'}`}>
                      {hours > 0 ? hours.toFixed(1) : '-'}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Total Hours Display */}
      <div className="p-4 bg-[var(--accent)]/10 rounded-lg flex justify-between items-center">
        <div>
          <span className="text-[var(--foreground-muted)]">Total Hours: </span>
          <span className="text-2xl font-bold text-[var(--accent)]">{totalHours.toFixed(1)}</span>
        </div>
        <div className="text-sm text-[var(--foreground-muted)]">
          {workedDaysCount} day{workedDaysCount !== 1 ? 's' : ''} worked
        </div>
      </div>

      {/* Notes */}
      <div>
        <label className="block text-sm font-medium text-[var(--foreground-muted)] mb-1">
          Notes
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          placeholder="Work performed, materials used, etc."
          className="w-full px-3 py-2 bg-[var(--secondary)] border border-[var(--border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--accent)] resize-none"
        />
      </div>

      {/* Signatory Info */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-[var(--foreground-muted)] mb-1">
            Site Manager Name
          </label>
          <input
            type="text"
            value={signatoryName}
            onChange={(e) => setSignatoryName(e.target.value)}
            placeholder="PJ Coyle"
            className="w-full px-3 py-2 bg-[var(--secondary)] border border-[var(--border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-[var(--foreground-muted)] mb-1">
            Company
          </label>
          <input
            type="text"
            value={signatoryCompany}
            onChange={(e) => setSignatoryCompany(e.target.value)}
            placeholder="PJ Constructions"
            className="w-full px-3 py-2 bg-[var(--secondary)] border border-[var(--border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
          />
        </div>
      </div>

      {/* Signature Pad */}
      <SignaturePad onSave={setSignatureDataUrl} />
      {signatureDataUrl && (
        <p className="text-sm text-green-400">Signature captured</p>
      )}

      {/* Submit Button */}
      <button
        type="submit"
        disabled={isSubmitting || !jobId || workedDaysCount === 0}
        className="w-full py-3 bg-[var(--accent)] text-[var(--background)] font-medium rounded-lg hover:bg-[var(--accent)]/90 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isSubmitting ? 'Submitting...' : `Submit Week (${totalHours.toFixed(1)} hrs)`}
      </button>
    </form>
  );
}
