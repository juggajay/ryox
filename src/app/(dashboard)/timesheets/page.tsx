'use client';

import { useQuery, useMutation } from 'convex/react';
import { api } from '../../../../convex/_generated/api';
import { useAuth } from '@/lib/auth-context';
import { WeeklyTimesheetForm } from '@/components/weekly-timesheet-form';
import { WeeklyTimesheetReview } from '@/components/weekly-timesheet-review';
import { TimesheetPhotoUpload } from '@/components/timesheet-photo-upload';
import { useState } from 'react';
import { format } from 'date-fns';
import { Id } from '../../../../convex/_generated/dataModel';

interface ExtractedDataWeekly {
  entries: Array<{
    dayOfWeek: string;
    date: string;
    startTime: string;
    endTime: string;
    breakMinutes: number;
  }>;
  signatoryName?: string;
  signatoryCompany?: string;
  totalHours?: number;
  siteName?: string;
  workerName?: string;
}

export default function TimesheetsPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'submit' | 'photo' | 'history' | 'pending'>('submit');
  const [queryNote, setQueryNote] = useState('');
  const [queryingId, setQueryingId] = useState<string | null>(null);

  // Photo extraction state
  const [extractedData, setExtractedData] = useState<ExtractedDataWeekly | null>(null);
  const [photoStorageId, setPhotoStorageId] = useState<string | null>(null);

  // Fetch weekly batches for the new workflow
  const weeklyBatches = useQuery(api.timesheets.getWorkerWeeklyBatches,
    user ? { userId: user._id } : 'skip'
  );

  const pendingBatches = useQuery(api.timesheets.listWeeklyBatches,
    user ? { userId: user._id, status: 'submitted' } : 'skip'
  );

  const approveWeeklyBatch = useMutation(api.timesheets.approveWeeklyBatch);
  const queryWeeklyBatch = useMutation(api.timesheets.queryWeeklyBatch);

  const isOwner = user?.role === 'owner';

  // Handle extracted data from photo
  const handleExtracted = (data: ExtractedDataWeekly, storageId: string) => {
    setExtractedData(data);
    setPhotoStorageId(storageId);
  };

  const handleApprove = async (batchId: string) => {
    if (!user) return;
    await approveWeeklyBatch({ userId: user._id, batchId: batchId as Id<"timesheetBatches"> });
  };

  const handleQuery = async (batchId: string) => {
    if (!queryNote.trim() || !user) return;
    await queryWeeklyBatch({
      userId: user._id,
      batchId: batchId as Id<"timesheetBatches">,
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
    };
    return (
      <span className={`px-2 py-1 rounded text-xs font-medium ${styles[status] || 'bg-gray-500/20'}`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  // Format week range
  const formatWeekRange = (weekStartDate: number) => {
    const start = new Date(weekStartDate);
    const end = new Date(weekStartDate);
    end.setDate(end.getDate() + 6);
    return `${format(start, 'MMM d')} - ${format(end, 'MMM d, yyyy')}`;
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

  const pendingCount = pendingBatches?.length || 0;

  return (
    <div className="space-y-4 md:space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">Timesheets</h1>
        <p className="text-sm md:text-base text-[var(--foreground-muted)]">
          {isOwner ? 'Manage and approve worker timesheets' : 'Submit and track your weekly timesheets'}
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
              <span className="hidden md:inline">Manual Entry</span>
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
              Photo Upload
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
            {pendingCount > 0 && (
              <span className="ml-1 px-1.5 py-0.5 rounded-full text-xs bg-[var(--background)] text-[var(--accent)]">
                {pendingCount}
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

      {/* Submit Weekly Form (Worker only) */}
      {effectiveTab === 'submit' && !isOwner && (
        <WeeklyTimesheetForm onSuccess={() => setActiveTab('history')} />
      )}

      {/* Photo Upload (Worker only) */}
      {effectiveTab === 'photo' && !isOwner && (
        <div className="space-y-4 md:space-y-6">
          {!extractedData ? (
            <div className="bg-[var(--card)] p-4 md:p-6 rounded-xl border border-[var(--border)]">
              <h2 className="text-lg md:text-xl font-semibold mb-2 md:mb-4">Upload Weekly Timesheet</h2>
              <p className="text-sm text-[var(--foreground-muted)] mb-4">
                Take or select a photo of your signed weekly timesheet. AI will extract all days automatically.
              </p>
              <TimesheetPhotoUpload
                mode="weekly"
                onExtracted={(data, storageId) => handleExtracted(data as ExtractedDataWeekly, storageId)}
              />
            </div>
          ) : (
            <WeeklyTimesheetReview
              extractedData={extractedData}
              photoStorageId={photoStorageId!}
              onSuccess={() => {
                setExtractedData(null);
                setPhotoStorageId(null);
                setActiveTab('history');
              }}
              onBack={() => {
                setExtractedData(null);
                setPhotoStorageId(null);
              }}
            />
          )}
        </div>
      )}

      {/* Pending Approval (Owner only) - Weekly Batches */}
      {effectiveTab === 'pending' && isOwner && (
        <div className="space-y-3 md:space-y-4">
          {!pendingBatches ? (
            <div className="animate-pulse space-y-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-32 bg-[var(--card)] rounded-xl" />
              ))}
            </div>
          ) : pendingBatches.length === 0 ? (
            <div className="text-center py-12 text-[var(--foreground-muted)] bg-[var(--card)] rounded-xl border border-[var(--border)]">
              <svg className="w-12 h-12 mx-auto mb-4 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-lg">No timesheets pending approval</p>
              <p className="text-sm mt-1">All weekly timesheets have been processed</p>
            </div>
          ) : (
            pendingBatches.map((batch) => (
              <div key={batch._id} className="bg-[var(--card)] p-4 rounded-xl border border-[var(--border)]">
                <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-4">
                  <div className="space-y-2 flex-1">
                    <div className="flex items-center gap-3">
                      <h3 className="font-semibold text-lg">{batch.worker?.name}</h3>
                      {getStatusBadge(batch.status)}
                    </div>
                    <p className="text-sm text-[var(--foreground-muted)]">{batch.job?.name}</p>
                    <p className="text-sm font-medium">
                      {formatWeekRange(batch.weekStartDate)}
                    </p>
                    <p className="text-2xl font-bold text-[var(--accent)]">{batch.totalHours}h total</p>

                    {/* Show individual days */}
                    {batch.timesheets && batch.timesheets.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-[var(--border)]">
                        <p className="text-xs text-[var(--foreground-muted)] mb-2">{batch.timesheets.length} days worked:</p>
                        <div className="flex flex-wrap gap-2">
                          {batch.timesheets.map((ts: any) => (
                            <div key={ts._id} className="text-xs bg-[var(--background)] px-2 py-1 rounded">
                              {format(new Date(ts.date), 'EEE d')}: {ts.totalHours}h
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {batch.signatoryName && (
                      <p className="text-xs text-[var(--foreground-muted)] mt-2">
                        Signed by: {batch.signatoryName} {batch.signatoryCompany && `(${batch.signatoryCompany})`}
                      </p>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 md:flex-col">
                    <button
                      onClick={() => handleApprove(batch._id)}
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
                      Approve Week
                    </button>

                    {queryingId === batch._id ? (
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
                            onClick={() => handleQuery(batch._id)}
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
                        onClick={() => setQueryingId(batch._id)}
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

      {/* History - Weekly Batches */}
      {effectiveTab === 'history' && (
        <div className="space-y-3 md:space-y-4">
          {!weeklyBatches ? (
            <div className="animate-pulse space-y-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-24 bg-[var(--card)] rounded-xl" />
              ))}
            </div>
          ) : weeklyBatches.length === 0 ? (
            <div className="text-center py-12 text-[var(--foreground-muted)] bg-[var(--card)] rounded-xl border border-[var(--border)]">
              <svg className="w-12 h-12 mx-auto mb-4 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-lg">No timesheets found</p>
              <p className="text-sm mt-1">
                {isOwner ? 'No weekly timesheets have been submitted yet' : 'Submit your first weekly timesheet to get started'}
              </p>
            </div>
          ) : (
            weeklyBatches.map((batch) => (
              <div key={batch._id} className="bg-[var(--card)] p-4 rounded-xl border border-[var(--border)]">
                <div className="flex justify-between items-start gap-4">
                  <div className="space-y-1 flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold truncate">{batch.job?.name}</h3>
                      {getStatusBadge(batch.status)}
                    </div>
                    {isOwner && <p className="text-sm text-[var(--foreground-muted)]">{batch.worker?.name}</p>}
                    <p className="text-sm text-[var(--foreground-muted)]">
                      {formatWeekRange(batch.weekStartDate)}
                    </p>
                    <p className="text-xs text-[var(--foreground-muted)]">
                      {batch.timesheets?.length || 0} days worked
                    </p>
                    {batch.status === 'queried' && batch.queryNote && (
                      <p className="text-sm text-red-400 mt-2 p-2 bg-red-500/10 rounded-lg">
                        Query: {batch.queryNote}
                      </p>
                    )}
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-2xl font-bold text-[var(--accent)]">{batch.totalHours}h</p>
                    <p className="text-xs text-[var(--foreground-muted)]">
                      {format(new Date(batch.submittedAt), 'dd/MM/yy')}
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
