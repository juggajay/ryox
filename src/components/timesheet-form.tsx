'use client';

import { useState } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { useAuth } from '@/lib/auth-context';
import { SignaturePad } from './signature-pad';
import { Id } from '../../convex/_generated/dataModel';

export function TimesheetForm({ onSuccess }: { onSuccess?: () => void }) {
  const { user } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [signatureDataUrl, setSignatureDataUrl] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    jobId: '' as string,
    date: new Date().toISOString().split('T')[0],
    startTime: '07:00',
    endTime: '15:30',
    breakMinutes: 30,
    notes: '',
    signatoryName: '',
    signatoryCompany: '',
  });

  // Get worker's allocated jobs
  const jobs = useQuery(api.jobs.getWorkerJobs,
    user ? { userId: user._id } : 'skip'
  );

  const submitTimesheet = useMutation(api.timesheets.submit);
  const generateUploadUrl = useMutation(api.timesheets.generateUploadUrl);

  const calculateHours = () => {
    const [startH, startM] = formData.startTime.split(':').map(Number);
    const [endH, endM] = formData.endTime.split(':').map(Number);
    const startMinutes = startH * 60 + startM;
    const endMinutes = endH * 60 + endM;
    const totalMinutes = endMinutes - startMinutes - formData.breakMinutes;
    return Math.max(0, totalMinutes / 60).toFixed(2);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !formData.jobId) return;

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

      await submitTimesheet({
        userId: user._id,
        jobId: formData.jobId as Id<"jobs">,
        date: new Date(formData.date).getTime(),
        startTime: formData.startTime,
        endTime: formData.endTime,
        breakMinutes: formData.breakMinutes,
        notes: formData.notes || undefined,
        signatureUrl,
        signatoryName: formData.signatoryName || undefined,
        signatoryCompany: formData.signatoryCompany || undefined,
      });

      // Reset form
      setFormData({
        jobId: '',
        date: new Date().toISOString().split('T')[0],
        startTime: '07:00',
        endTime: '15:30',
        breakMinutes: 30,
        notes: '',
        signatoryName: '',
        signatoryCompany: '',
      });
      setSignatureDataUrl(null);

      onSuccess?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit timesheet');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!jobs) {
    return <div className="animate-pulse bg-[var(--card)] rounded-lg h-96" />;
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 bg-[var(--card)] p-6 rounded-lg border border-[var(--border)]">
      <h2 className="text-xl font-semibold">Submit Timesheet</h2>

      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/50 rounded text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Job Selection */}
      <div>
        <label className="block text-sm font-medium text-[var(--foreground-muted)] mb-1">
          Job *
        </label>
        <select
          value={formData.jobId}
          onChange={(e) => setFormData({ ...formData, jobId: e.target.value })}
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

      {/* Date */}
      <div>
        <label className="block text-sm font-medium text-[var(--foreground-muted)] mb-1">
          Date *
        </label>
        <input
          type="date"
          value={formData.date}
          onChange={(e) => setFormData({ ...formData, date: e.target.value })}
          required
          className="w-full px-3 py-2 bg-[var(--secondary)] border border-[var(--border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
        />
      </div>

      {/* Time inputs */}
      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-[var(--foreground-muted)] mb-1">
            Start Time *
          </label>
          <input
            type="time"
            value={formData.startTime}
            onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
            required
            className="w-full px-3 py-2 bg-[var(--secondary)] border border-[var(--border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-[var(--foreground-muted)] mb-1">
            End Time *
          </label>
          <input
            type="time"
            value={formData.endTime}
            onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
            required
            className="w-full px-3 py-2 bg-[var(--secondary)] border border-[var(--border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-[var(--foreground-muted)] mb-1">
            Break (mins)
          </label>
          <input
            type="number"
            value={formData.breakMinutes}
            onChange={(e) => setFormData({ ...formData, breakMinutes: parseInt(e.target.value) || 0 })}
            min="0"
            className="w-full px-3 py-2 bg-[var(--secondary)] border border-[var(--border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
          />
        </div>
      </div>

      {/* Total Hours Display */}
      <div className="p-4 bg-[var(--accent)]/10 rounded-lg">
        <span className="text-[var(--foreground-muted)]">Total Hours: </span>
        <span className="text-2xl font-bold text-[var(--accent)]">{calculateHours()}</span>
      </div>

      {/* Notes */}
      <div>
        <label className="block text-sm font-medium text-[var(--foreground-muted)] mb-1">
          Notes
        </label>
        <textarea
          value={formData.notes}
          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          rows={3}
          placeholder="Work performed, materials used, etc."
          className="w-full px-3 py-2 bg-[var(--secondary)] border border-[var(--border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--accent)] resize-none"
        />
      </div>

      {/* Signatory Info */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-[var(--foreground-muted)] mb-1">
            Signatory Name
          </label>
          <input
            type="text"
            value={formData.signatoryName}
            onChange={(e) => setFormData({ ...formData, signatoryName: e.target.value })}
            placeholder="John Smith"
            className="w-full px-3 py-2 bg-[var(--secondary)] border border-[var(--border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-[var(--foreground-muted)] mb-1">
            Company
          </label>
          <input
            type="text"
            value={formData.signatoryCompany}
            onChange={(e) => setFormData({ ...formData, signatoryCompany: e.target.value })}
            placeholder="ABC Builders"
            className="w-full px-3 py-2 bg-[var(--secondary)] border border-[var(--border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
          />
        </div>
      </div>

      {/* Signature Pad */}
      <SignaturePad onSave={setSignatureDataUrl} />
      {signatureDataUrl && (
        <p className="text-sm text-green-400">✓ Signature captured</p>
      )}

      {/* Submit Button */}
      <button
        type="submit"
        disabled={isSubmitting || !formData.jobId}
        className="w-full py-3 bg-[var(--accent)] text-[var(--background)] font-medium rounded-lg hover:bg-[var(--accent)]/90 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isSubmitting ? 'Submitting...' : 'Submit Timesheet'}
      </button>
    </form>
  );
}
