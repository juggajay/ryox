'use client';

import { useQuery, useMutation } from 'convex/react';
import { api } from '../../../../convex/_generated/api';
import { useAuth } from '@/lib/auth-context';
import { TimesheetForm } from '@/components/timesheet-form';
import { TimesheetPhotoUpload } from '@/components/timesheet-photo-upload';
import { SignaturePad } from '@/components/signature-pad';
import { useState } from 'react';
import { format } from 'date-fns';
import { Id } from '../../../../convex/_generated/dataModel';

interface ExtractedData {
  date: string | null;
  startTime: string | null;
  endTime: string | null;
  breakMinutes: number | null;
  signatoryName: string | null;
  signatoryCompany: string | null;
  notes: string | null;
}

export default function TimesheetsPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'submit' | 'photo' | 'history' | 'pending'>('submit');
  const [queryNote, setQueryNote] = useState('');
  const [queryingId, setQueryingId] = useState<string | null>(null);

  // Photo extraction state
  const [extractedData, setExtractedData] = useState<ExtractedData | null>(null);
  const [photoStorageId, setPhotoStorageId] = useState<string | null>(null);
  const [isSubmittingPhoto, setIsSubmittingPhoto] = useState(false);
  const [photoFormData, setPhotoFormData] = useState({
    jobId: '',
    date: '',
    startTime: '',
    endTime: '',
    breakMinutes: 30,
    notes: '',
    signatoryName: '',
    signatoryCompany: '',
  });
  const [signatureDataUrl, setSignatureDataUrl] = useState<string | null>(null);

  const timesheets = useQuery(api.timesheets.list,
    user ? { userId: user._id } : 'skip'
  );

  const jobs = useQuery(api.jobs.getWorkerJobs,
    user ? { userId: user._id } : 'skip'
  );

  const approveTimesheet = useMutation(api.timesheets.approve);
  const queryTimesheetMutation = useMutation(api.timesheets.queryTimesheet);
  const submitTimesheet = useMutation(api.timesheets.submit);
  const generateUploadUrl = useMutation(api.timesheets.generateUploadUrl);

  const isOwner = user?.role === 'owner';

  const pendingTimesheets = timesheets?.filter(t => t.status === 'submitted') || [];

  // Handle extracted data from photo
  const handleExtracted = (data: ExtractedData, storageId: string) => {
    setExtractedData(data);
    setPhotoStorageId(storageId);
    setPhotoFormData({
      jobId: '',
      date: data.date || new Date().toISOString().split('T')[0],
      startTime: data.startTime || '07:00',
      endTime: data.endTime || '15:30',
      breakMinutes: data.breakMinutes || 30,
      notes: data.notes || '',
      signatoryName: data.signatoryName || '',
      signatoryCompany: data.signatoryCompany || '',
    });
  };

  // Submit photo timesheet
  const handlePhotoSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !photoFormData.jobId || !photoStorageId) return;

    setIsSubmittingPhoto(true);
    try {
      let signatureUrl: string | undefined;

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
        jobId: photoFormData.jobId as Id<"jobs">,
        date: new Date(photoFormData.date).getTime(),
        startTime: photoFormData.startTime,
        endTime: photoFormData.endTime,
        breakMinutes: photoFormData.breakMinutes,
        notes: photoFormData.notes || undefined,
        signatureUrl,
        photoUrl: photoStorageId,
        signatoryName: photoFormData.signatoryName || undefined,
        signatoryCompany: photoFormData.signatoryCompany || undefined,
      });

      // Reset state
      setExtractedData(null);
      setPhotoStorageId(null);
      setPhotoFormData({
        jobId: '',
        date: '',
        startTime: '',
        endTime: '',
        breakMinutes: 30,
        notes: '',
        signatoryName: '',
        signatoryCompany: '',
      });
      setSignatureDataUrl(null);
      setActiveTab('history');
    } catch (err) {
      console.error('Failed to submit timesheet:', err);
    } finally {
      setIsSubmittingPhoto(false);
    }
  };

  const calculatePhotoHours = () => {
    const [startH, startM] = photoFormData.startTime.split(':').map(Number);
    const [endH, endM] = photoFormData.endTime.split(':').map(Number);
    const startMinutes = startH * 60 + startM;
    const endMinutes = endH * 60 + endM;
    const totalMinutes = endMinutes - startMinutes - photoFormData.breakMinutes;
    return Math.max(0, totalMinutes / 60).toFixed(2);
  };

  const handleApprove = async (timesheetId: string) => {
    if (!user) return;
    await approveTimesheet({ userId: user._id, timesheetId: timesheetId as Id<"timesheets"> });
  };

  const handleQuery = async (timesheetId: string) => {
    if (!queryNote.trim() || !user) return;
    await queryTimesheetMutation({
      userId: user._id,
      timesheetId: timesheetId as Id<"timesheets">,
      queryNote: queryNote.trim()
    });
    setQueryNote('');
    setQueryingId(null);
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      submitted: 'bg-yellow-500/20 text-yellow-400',
      approved: 'bg-green-500/20 text-green-400',
      queried: 'bg-red-500/20 text-red-400',
      invoiced: 'bg-blue-500/20 text-blue-400',
    };
    return (
      <span className={`px-2 py-1 rounded text-xs font-medium ${styles[status] || 'bg-gray-500/20'}`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  // Determine effective tab (prevent showing wrong tabs for role)
  const effectiveTab = (() => {
    if (isOwner && (activeTab === 'submit' || activeTab === 'photo')) {
      return 'pending';
    }
    if (!isOwner && activeTab === 'pending') {
      return 'submit';
    }
    return activeTab;
  })();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Timesheets</h1>
        <p className="text-[var(--foreground-muted)]">
          {isOwner ? 'Manage and approve worker timesheets' : 'Submit and track your timesheets'}
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-[var(--border)] pb-2">
        {!isOwner && (
          <>
            <button
              onClick={() => setActiveTab('submit')}
              className={`px-4 py-2 rounded-t font-medium transition-colors ${
                effectiveTab === 'submit'
                  ? 'bg-[var(--accent)] text-[var(--background)]'
                  : 'text-[var(--foreground-muted)] hover:text-[var(--foreground)]'
              }`}
            >
              Digital Entry
            </button>
            <button
              onClick={() => setActiveTab('photo')}
              className={`px-4 py-2 rounded-t font-medium transition-colors ${
                effectiveTab === 'photo'
                  ? 'bg-[var(--accent)] text-[var(--background)]'
                  : 'text-[var(--foreground-muted)] hover:text-[var(--foreground)]'
              }`}
            >
              📷 Photo Upload
            </button>
          </>
        )}
        {isOwner && (
          <button
            onClick={() => setActiveTab('pending')}
            className={`px-4 py-2 rounded-t font-medium transition-colors ${
              effectiveTab === 'pending'
                ? 'bg-[var(--accent)] text-[var(--background)]'
                : 'text-[var(--foreground-muted)] hover:text-[var(--foreground)]'
            }`}
          >
            Pending Approval ({pendingTimesheets.length})
          </button>
        )}
        <button
          onClick={() => setActiveTab('history')}
          className={`px-4 py-2 rounded-t font-medium transition-colors ${
            effectiveTab === 'history'
              ? 'bg-[var(--accent)] text-[var(--background)]'
              : 'text-[var(--foreground-muted)] hover:text-[var(--foreground)]'
          }`}
        >
          History
        </button>
      </div>

      {/* Submit Form (Worker only) */}
      {effectiveTab === 'submit' && !isOwner && (
        <TimesheetForm onSuccess={() => setActiveTab('history')} />
      )}

      {/* Photo Upload (Worker only) */}
      {effectiveTab === 'photo' && !isOwner && (
        <div className="space-y-6">
          {!extractedData ? (
            <div className="bg-[var(--card)] p-6 rounded-lg border border-[var(--border)]">
              <h2 className="text-xl font-semibold mb-4">Upload Timesheet Photo</h2>
              <p className="text-sm text-[var(--foreground-muted)] mb-4">
                Take or upload a photo of your signed paper timesheet. AI will extract the details automatically.
              </p>
              <TimesheetPhotoUpload onExtracted={handleExtracted} />
            </div>
          ) : (
            <form onSubmit={handlePhotoSubmit} className="bg-[var(--card)] p-6 rounded-lg border border-[var(--border)] space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold">Review Extracted Data</h2>
                <button
                  type="button"
                  onClick={() => { setExtractedData(null); setPhotoStorageId(null); }}
                  className="text-sm text-[var(--foreground-muted)] hover:text-[var(--foreground)]"
                >
                  ← Upload different photo
                </button>
              </div>

              <div className="p-3 bg-green-500/10 border border-green-500/50 rounded text-green-400 text-sm">
                AI extracted the following data. Please review and correct if needed.
              </div>

              {/* Job Selection */}
              <div>
                <label className="block text-sm font-medium text-[var(--foreground-muted)] mb-1">
                  Job *
                </label>
                <select
                  value={photoFormData.jobId}
                  onChange={(e) => setPhotoFormData({ ...photoFormData, jobId: e.target.value })}
                  required
                  className="w-full px-3 py-2 bg-[var(--secondary)] border border-[var(--border)] rounded-lg"
                >
                  <option value="">Select a job...</option>
                  {jobs?.map((job) => job && (
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
                  value={photoFormData.date}
                  onChange={(e) => setPhotoFormData({ ...photoFormData, date: e.target.value })}
                  required
                  className="w-full px-3 py-2 bg-[var(--secondary)] border border-[var(--border)] rounded-lg"
                />
              </div>

              {/* Times */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-[var(--foreground-muted)] mb-1">
                    Start Time *
                  </label>
                  <input
                    type="time"
                    value={photoFormData.startTime}
                    onChange={(e) => setPhotoFormData({ ...photoFormData, startTime: e.target.value })}
                    required
                    className="w-full px-3 py-2 bg-[var(--secondary)] border border-[var(--border)] rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--foreground-muted)] mb-1">
                    End Time *
                  </label>
                  <input
                    type="time"
                    value={photoFormData.endTime}
                    onChange={(e) => setPhotoFormData({ ...photoFormData, endTime: e.target.value })}
                    required
                    className="w-full px-3 py-2 bg-[var(--secondary)] border border-[var(--border)] rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--foreground-muted)] mb-1">
                    Break (mins)
                  </label>
                  <input
                    type="number"
                    value={photoFormData.breakMinutes}
                    onChange={(e) => setPhotoFormData({ ...photoFormData, breakMinutes: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 bg-[var(--secondary)] border border-[var(--border)] rounded-lg"
                  />
                </div>
              </div>

              {/* Total Hours */}
              <div className="p-4 bg-[var(--accent)]/10 rounded-lg">
                <span className="text-[var(--foreground-muted)]">Total Hours: </span>
                <span className="text-2xl font-bold text-[var(--accent)]">{calculatePhotoHours()}</span>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-[var(--foreground-muted)] mb-1">
                  Notes
                </label>
                <textarea
                  value={photoFormData.notes}
                  onChange={(e) => setPhotoFormData({ ...photoFormData, notes: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 bg-[var(--secondary)] border border-[var(--border)] rounded-lg resize-none"
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
                    value={photoFormData.signatoryName}
                    onChange={(e) => setPhotoFormData({ ...photoFormData, signatoryName: e.target.value })}
                    className="w-full px-3 py-2 bg-[var(--secondary)] border border-[var(--border)] rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--foreground-muted)] mb-1">
                    Company
                  </label>
                  <input
                    type="text"
                    value={photoFormData.signatoryCompany}
                    onChange={(e) => setPhotoFormData({ ...photoFormData, signatoryCompany: e.target.value })}
                    className="w-full px-3 py-2 bg-[var(--secondary)] border border-[var(--border)] rounded-lg"
                  />
                </div>
              </div>

              {/* Digital Signature (optional for photo uploads) */}
              <div className="pt-4 border-t border-[var(--border)]">
                <p className="text-sm text-[var(--foreground-muted)] mb-2">
                  Optional: Add digital signature for extra verification
                </p>
                <SignaturePad onSave={setSignatureDataUrl} />
                {signatureDataUrl && (
                  <p className="text-sm text-green-400 mt-2">✓ Digital signature added</p>
                )}
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={isSubmittingPhoto || !photoFormData.jobId}
                className="w-full py-3 bg-[var(--accent)] text-[var(--background)] font-medium rounded-lg hover:bg-[var(--accent)]/90 disabled:opacity-50"
              >
                {isSubmittingPhoto ? 'Submitting...' : 'Confirm & Submit Timesheet'}
              </button>
            </form>
          )}
        </div>
      )}

      {/* Pending Approval (Owner only) */}
      {effectiveTab === 'pending' && isOwner && (
        <div className="space-y-4">
          {pendingTimesheets.length === 0 ? (
            <div className="text-center py-12 text-[var(--foreground-muted)] bg-[var(--card)] rounded-lg border border-[var(--border)]">
              <p className="text-lg">No timesheets pending approval</p>
              <p className="text-sm mt-1">All timesheets have been processed</p>
            </div>
          ) : (
            pendingTimesheets.map((ts) => (
              <div key={ts._id} className="bg-[var(--card)] p-4 rounded-lg border border-[var(--border)]">
                <div className="flex justify-between items-start">
                  <div className="space-y-1">
                    <h3 className="font-semibold text-lg">{ts.worker?.name}</h3>
                    <p className="text-sm text-[var(--foreground-muted)]">{ts.job?.name}</p>
                    <p className="text-sm">
                      {format(new Date(ts.date), 'EEEE, dd MMM yyyy')} • {ts.startTime} - {ts.endTime}
                    </p>
                    <p className="text-2xl font-bold text-[var(--accent)]">{ts.totalHours} hours</p>
                    {ts.notes && (
                      <p className="text-sm text-[var(--foreground-muted)] mt-2 p-2 bg-[var(--secondary)] rounded">
                        {ts.notes}
                      </p>
                    )}
                    {ts.signatoryName && (
                      <p className="text-xs text-[var(--foreground-muted)]">
                        Signed by: {ts.signatoryName} {ts.signatoryCompany && `(${ts.signatoryCompany})`}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col gap-2">
                    <button
                      onClick={() => handleApprove(ts._id)}
                      className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded font-medium transition-colors"
                    >
                      Approve
                    </button>
                    {queryingId === ts._id ? (
                      <div className="space-y-2">
                        <textarea
                          value={queryNote}
                          onChange={(e) => setQueryNote(e.target.value)}
                          placeholder="Enter query note..."
                          className="w-48 px-2 py-1 text-sm bg-[var(--secondary)] border border-[var(--border)] rounded resize-none"
                          rows={2}
                        />
                        <div className="flex gap-1">
                          <button
                            onClick={() => handleQuery(ts._id)}
                            disabled={!queryNote.trim()}
                            className="flex-1 px-2 py-1 bg-yellow-600 hover:bg-yellow-700 text-white rounded text-sm disabled:opacity-50"
                          >
                            Send
                          </button>
                          <button
                            onClick={() => { setQueryingId(null); setQueryNote(''); }}
                            className="px-2 py-1 bg-[var(--secondary)] hover:bg-[var(--secondary)]/80 rounded text-sm"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => setQueryingId(ts._id)}
                        className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded font-medium transition-colors"
                      >
                        Query
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* History */}
      {effectiveTab === 'history' && (
        <div className="space-y-4">
          {!timesheets ? (
            <div className="animate-pulse space-y-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-24 bg-[var(--card)] rounded-lg" />
              ))}
            </div>
          ) : timesheets.length === 0 ? (
            <div className="text-center py-12 text-[var(--foreground-muted)] bg-[var(--card)] rounded-lg border border-[var(--border)]">
              <p className="text-lg">No timesheets found</p>
              <p className="text-sm mt-1">
                {isOwner ? 'No timesheets have been submitted yet' : 'Submit your first timesheet to get started'}
              </p>
            </div>
          ) : (
            timesheets.map((ts) => (
              <div key={ts._id} className="bg-[var(--card)] p-4 rounded-lg border border-[var(--border)]">
                <div className="flex justify-between items-start">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold">{ts.job?.name}</h3>
                      {getStatusBadge(ts.status)}
                    </div>
                    {isOwner && <p className="text-sm text-[var(--foreground-muted)]">{ts.worker?.name}</p>}
                    <p className="text-sm text-[var(--foreground-muted)]">
                      {format(new Date(ts.date), 'EEEE, dd MMM yyyy')} • {ts.startTime} - {ts.endTime}
                    </p>
                    {ts.status === 'queried' && ts.queryNote && (
                      <p className="text-sm text-red-400 mt-2 p-2 bg-red-500/10 rounded">
                        Query: {ts.queryNote}
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-[var(--accent)]">{ts.totalHours}h</p>
                    <p className="text-xs text-[var(--foreground-muted)]">
                      {format(new Date(ts.submittedAt), 'dd/MM/yy HH:mm')}
                    </p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
