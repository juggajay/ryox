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
    <div className="space-y-4 md:space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">Timesheets</h1>
        <p className="text-sm md:text-base text-[var(--foreground-muted)]">
          {isOwner ? 'Manage and approve worker timesheets' : 'Submit and track your timesheets'}
        </p>
      </div>

      {/* Mobile-friendly tabs */}
      <div className="flex gap-1 md:gap-2 overflow-x-auto pb-2 -mx-4 px-4 md:mx-0 md:px-0 border-b border-[var(--border)]">
        {!isOwner && (
          <>
            <button
              onClick={() => setActiveTab('submit')}
              className={`
                flex items-center gap-2 px-4 py-2.5 rounded-t-lg
                font-medium text-sm whitespace-nowrap
                transition-colors flex-shrink-0
                ${effectiveTab === 'submit'
                  ? 'bg-[var(--accent)] text-[var(--background)]'
                  : 'text-[var(--foreground-muted)] hover:text-[var(--foreground)] active:bg-[var(--card)]'
                }
              `}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              <span className="hidden md:inline">Digital Entry</span>
              <span className="md:hidden">Submit</span>
            </button>
            <button
              onClick={() => setActiveTab('photo')}
              className={`
                flex items-center gap-2 px-4 py-2.5 rounded-t-lg
                font-medium text-sm whitespace-nowrap
                transition-colors flex-shrink-0
                ${effectiveTab === 'photo'
                  ? 'bg-[var(--accent)] text-[var(--background)]'
                  : 'text-[var(--foreground-muted)] hover:text-[var(--foreground)] active:bg-[var(--card)]'
                }
              `}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Photo
            </button>
          </>
        )}
        {isOwner && (
          <button
            onClick={() => setActiveTab('pending')}
            className={`
              flex items-center gap-2 px-4 py-2.5 rounded-t-lg
              font-medium text-sm whitespace-nowrap
              transition-colors flex-shrink-0
              ${effectiveTab === 'pending'
                ? 'bg-[var(--accent)] text-[var(--background)]'
                : 'text-[var(--foreground-muted)] hover:text-[var(--foreground)] active:bg-[var(--card)]'
              }
            `}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            Pending
            {pendingTimesheets.length > 0 && (
              <span className="ml-1 px-1.5 py-0.5 rounded-full text-xs bg-[var(--background)] text-[var(--accent)]">
                {pendingTimesheets.length}
              </span>
            )}
          </button>
        )}
        <button
          onClick={() => setActiveTab('history')}
          className={`
            flex items-center gap-2 px-4 py-2.5 rounded-t-lg
            font-medium text-sm whitespace-nowrap
            transition-colors flex-shrink-0
            ${effectiveTab === 'history'
              ? 'bg-[var(--accent)] text-[var(--background)]'
              : 'text-[var(--foreground-muted)] hover:text-[var(--foreground)] active:bg-[var(--card)]'
            }
          `}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          History
        </button>
      </div>

      {/* Submit Form (Worker only) */}
      {effectiveTab === 'submit' && !isOwner && (
        <TimesheetForm onSuccess={() => setActiveTab('history')} />
      )}

      {/* Photo Upload (Worker only) */}
      {effectiveTab === 'photo' && !isOwner && (
        <div className="space-y-4 md:space-y-6">
          {!extractedData ? (
            <div className="bg-[var(--card)] p-4 md:p-6 rounded-xl border border-[var(--border)]">
              <h2 className="text-lg md:text-xl font-semibold mb-2 md:mb-4">Upload Timesheet Photo</h2>
              <p className="text-sm text-[var(--foreground-muted)] mb-4">
                Take or upload a photo of your signed paper timesheet. AI will extract the details automatically.
              </p>
              <TimesheetPhotoUpload onExtracted={handleExtracted} />
            </div>
          ) : (
            <form onSubmit={handlePhotoSubmit} className="bg-[var(--card)] p-4 md:p-6 rounded-xl border border-[var(--border)] space-y-4 md:space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-lg md:text-xl font-semibold">Review Extracted Data</h2>
                <button
                  type="button"
                  onClick={() => { setExtractedData(null); setPhotoStorageId(null); }}
                  className="text-sm text-[var(--foreground-muted)] hover:text-[var(--foreground)] active:scale-95"
                >
                  ← Back
                </button>
              </div>

              <div className="p-3 bg-green-500/10 border border-green-500/50 rounded-lg text-green-400 text-sm">
                AI extracted the following data. Please review and correct if needed.
              </div>

              {/* Job Selection */}
              <div>
                <label className="block text-sm font-medium text-[var(--foreground-muted)] mb-2">
                  Job *
                </label>
                <select
                  value={photoFormData.jobId}
                  onChange={(e) => setPhotoFormData({ ...photoFormData, jobId: e.target.value })}
                  required
                  className="w-full px-4 py-3 bg-[var(--background)] border border-[var(--border)] rounded-xl text-base"
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
                <label className="block text-sm font-medium text-[var(--foreground-muted)] mb-2">
                  Date *
                </label>
                <input
                  type="date"
                  value={photoFormData.date}
                  onChange={(e) => setPhotoFormData({ ...photoFormData, date: e.target.value })}
                  required
                  className="w-full px-4 py-3 bg-[var(--background)] border border-[var(--border)] rounded-xl text-base"
                />
              </div>

              {/* Times - Stack on mobile */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
                <div>
                  <label className="block text-sm font-medium text-[var(--foreground-muted)] mb-2">
                    Start Time *
                  </label>
                  <input
                    type="time"
                    value={photoFormData.startTime}
                    onChange={(e) => setPhotoFormData({ ...photoFormData, startTime: e.target.value })}
                    required
                    className="w-full px-4 py-3 bg-[var(--background)] border border-[var(--border)] rounded-xl text-base"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--foreground-muted)] mb-2">
                    End Time *
                  </label>
                  <input
                    type="time"
                    value={photoFormData.endTime}
                    onChange={(e) => setPhotoFormData({ ...photoFormData, endTime: e.target.value })}
                    required
                    className="w-full px-4 py-3 bg-[var(--background)] border border-[var(--border)] rounded-xl text-base"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--foreground-muted)] mb-2">
                    Break (mins)
                  </label>
                  <input
                    type="number"
                    value={photoFormData.breakMinutes}
                    onChange={(e) => setPhotoFormData({ ...photoFormData, breakMinutes: parseInt(e.target.value) || 0 })}
                    className="w-full px-4 py-3 bg-[var(--background)] border border-[var(--border)] rounded-xl text-base"
                  />
                </div>
              </div>

              {/* Total Hours - Prominent on mobile */}
              <div className="p-4 bg-[var(--accent)]/10 rounded-xl flex items-center justify-between">
                <span className="text-[var(--foreground-muted)] font-medium">Total Hours</span>
                <span className="text-3xl font-bold text-[var(--accent)]">{calculatePhotoHours()}</span>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-[var(--foreground-muted)] mb-2">
                  Notes
                </label>
                <textarea
                  value={photoFormData.notes}
                  onChange={(e) => setPhotoFormData({ ...photoFormData, notes: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-3 bg-[var(--background)] border border-[var(--border)] rounded-xl text-base resize-none"
                />
              </div>

              {/* Signatory Info - Stack on mobile */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                <div>
                  <label className="block text-sm font-medium text-[var(--foreground-muted)] mb-2">
                    Signatory Name
                  </label>
                  <input
                    type="text"
                    value={photoFormData.signatoryName}
                    onChange={(e) => setPhotoFormData({ ...photoFormData, signatoryName: e.target.value })}
                    className="w-full px-4 py-3 bg-[var(--background)] border border-[var(--border)] rounded-xl text-base"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--foreground-muted)] mb-2">
                    Company
                  </label>
                  <input
                    type="text"
                    value={photoFormData.signatoryCompany}
                    onChange={(e) => setPhotoFormData({ ...photoFormData, signatoryCompany: e.target.value })}
                    className="w-full px-4 py-3 bg-[var(--background)] border border-[var(--border)] rounded-xl text-base"
                  />
                </div>
              </div>

              {/* Digital Signature (optional for photo uploads) */}
              <div className="pt-4 border-t border-[var(--border)]">
                <p className="text-sm text-[var(--foreground-muted)] mb-3">
                  Optional: Add digital signature for extra verification
                </p>
                <SignaturePad onSave={setSignatureDataUrl} />
                {signatureDataUrl && (
                  <p className="text-sm text-green-400 mt-2 flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Digital signature added
                  </p>
                )}
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={isSubmittingPhoto || !photoFormData.jobId}
                className="
                  w-full py-4
                  bg-[var(--accent)] text-[var(--background)]
                  font-semibold text-lg rounded-xl
                  hover:bg-[var(--accent)]/90
                  disabled:opacity-50
                  active:scale-[0.98] transition-transform
                "
              >
                {isSubmittingPhoto ? 'Submitting...' : 'Confirm & Submit'}
              </button>
            </form>
          )}
        </div>
      )}

      {/* Pending Approval (Owner only) */}
      {effectiveTab === 'pending' && isOwner && (
        <div className="space-y-3 md:space-y-4">
          {pendingTimesheets.length === 0 ? (
            <div className="text-center py-12 text-[var(--foreground-muted)] bg-[var(--card)] rounded-xl border border-[var(--border)]">
              <svg className="w-12 h-12 mx-auto mb-4 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-lg">No timesheets pending approval</p>
              <p className="text-sm mt-1">All timesheets have been processed</p>
            </div>
          ) : (
            pendingTimesheets.map((ts) => (
              <div key={ts._id} className="bg-[var(--card)] p-4 rounded-xl border border-[var(--border)]">
                <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-4">
                  <div className="space-y-1 flex-1">
                    <h3 className="font-semibold text-lg">{ts.worker?.name}</h3>
                    <p className="text-sm text-[var(--foreground-muted)]">{ts.job?.name}</p>
                    <p className="text-sm">
                      {format(new Date(ts.date), 'EEE, dd MMM')} · {ts.startTime} - {ts.endTime}
                    </p>
                    <p className="text-2xl font-bold text-[var(--accent)]">{ts.totalHours}h</p>
                    {ts.notes && (
                      <p className="text-sm text-[var(--foreground-muted)] mt-2 p-3 bg-[var(--background)] rounded-lg">
                        {ts.notes}
                      </p>
                    )}
                    {ts.signatoryName && (
                      <p className="text-xs text-[var(--foreground-muted)]">
                        Signed by: {ts.signatoryName} {ts.signatoryCompany && `(${ts.signatoryCompany})`}
                      </p>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 md:flex-col">
                    <button
                      onClick={() => handleApprove(ts._id)}
                      className="
                        flex-1 md:flex-none
                        flex items-center justify-center gap-2
                        px-4 py-3 md:py-2
                        bg-green-600 hover:bg-green-700
                        text-white rounded-xl md:rounded-lg
                        font-medium transition-colors
                        active:scale-95
                      "
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Approve
                    </button>

                    {queryingId === ts._id ? (
                      <div className="flex-1 space-y-2">
                        <textarea
                          value={queryNote}
                          onChange={(e) => setQueryNote(e.target.value)}
                          placeholder="Enter query note..."
                          className="w-full px-3 py-2 text-sm bg-[var(--background)] border border-[var(--border)] rounded-lg resize-none"
                          rows={2}
                          autoFocus
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleQuery(ts._id)}
                            disabled={!queryNote.trim()}
                            className="flex-1 px-3 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg text-sm disabled:opacity-50 active:scale-95"
                          >
                            Send
                          </button>
                          <button
                            onClick={() => { setQueryingId(null); setQueryNote(''); }}
                            className="px-3 py-2 bg-[var(--background)] hover:bg-[var(--border)] rounded-lg text-sm active:scale-95"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => setQueryingId(ts._id)}
                        className="
                          flex-1 md:flex-none
                          flex items-center justify-center gap-2
                          px-4 py-3 md:py-2
                          bg-yellow-600 hover:bg-yellow-700
                          text-white rounded-xl md:rounded-lg
                          font-medium transition-colors
                          active:scale-95
                        "
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
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
        <div className="space-y-3 md:space-y-4">
          {!timesheets ? (
            <div className="animate-pulse space-y-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-24 bg-[var(--card)] rounded-xl" />
              ))}
            </div>
          ) : timesheets.length === 0 ? (
            <div className="text-center py-12 text-[var(--foreground-muted)] bg-[var(--card)] rounded-xl border border-[var(--border)]">
              <svg className="w-12 h-12 mx-auto mb-4 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-lg">No timesheets found</p>
              <p className="text-sm mt-1">
                {isOwner ? 'No timesheets have been submitted yet' : 'Submit your first timesheet to get started'}
              </p>
            </div>
          ) : (
            timesheets.map((ts) => (
              <div key={ts._id} className="bg-[var(--card)] p-4 rounded-xl border border-[var(--border)]">
                <div className="flex justify-between items-start gap-4">
                  <div className="space-y-1 flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold truncate">{ts.job?.name}</h3>
                      {getStatusBadge(ts.status)}
                    </div>
                    {isOwner && <p className="text-sm text-[var(--foreground-muted)]">{ts.worker?.name}</p>}
                    <p className="text-sm text-[var(--foreground-muted)]">
                      {format(new Date(ts.date), 'EEE, dd MMM')} · {ts.startTime} - {ts.endTime}
                    </p>
                    {ts.status === 'queried' && ts.queryNote && (
                      <p className="text-sm text-red-400 mt-2 p-2 bg-red-500/10 rounded-lg">
                        Query: {ts.queryNote}
                      </p>
                    )}
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-2xl font-bold text-[var(--accent)]">{ts.totalHours}h</p>
                    <p className="text-xs text-[var(--foreground-muted)]">
                      {format(new Date(ts.submittedAt), 'dd/MM/yy')}
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
