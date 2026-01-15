'use client';

import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { WeeklyTimesheetForm } from './weekly-timesheet-form';

interface ExtractedEntry {
  dayOfWeek: string;
  date: string;
  startTime: string;
  endTime: string;
  breakMinutes: number;
}

interface ExtractedData {
  entries: ExtractedEntry[];
  signatoryName?: string;
  signatoryCompany?: string;
  totalHours?: number;
  siteName?: string;
  workerName?: string;
}

interface WeeklyTimesheetReviewProps {
  extractedData: ExtractedData;
  photoStorageId: string;
  onSuccess?: () => void;
  onBack?: () => void;
}

export function WeeklyTimesheetReview({
  extractedData,
  photoStorageId,
  onSuccess,
  onBack,
}: WeeklyTimesheetReviewProps) {
  // Get photo URL for display
  const photoUrl = useQuery(api.timesheets.getStorageUrl,
    photoStorageId ? { storageId: photoStorageId as any } : 'skip'
  );

  return (
    <div className="space-y-6">
      {/* Back Button */}
      {onBack && (
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
          </svg>
          Back to upload
        </button>
      )}

      {/* Photo Preview */}
      {photoUrl && (
        <div className="bg-[var(--card)] p-4 rounded-lg border border-[var(--border)]">
          <h3 className="text-sm font-medium text-[var(--foreground-muted)] mb-3">Uploaded Timesheet</h3>
          <div className="relative">
            <img
              src={photoUrl}
              alt="Uploaded timesheet"
              className="w-full max-h-48 object-contain rounded-lg bg-black/20"
            />
            <div className="absolute top-2 right-2 bg-green-500/90 text-white text-xs px-2 py-1 rounded">
              AI Extracted
            </div>
          </div>
          {extractedData.siteName && (
            <p className="mt-2 text-sm text-[var(--foreground-muted)]">
              Site: <span className="text-[var(--foreground)]">{extractedData.siteName}</span>
            </p>
          )}
          {extractedData.workerName && (
            <p className="text-sm text-[var(--foreground-muted)]">
              Worker: <span className="text-[var(--foreground)]">{extractedData.workerName}</span>
            </p>
          )}
        </div>
      )}

      {/* Extraction Summary */}
      <div className="bg-[var(--accent)]/10 p-4 rounded-lg border border-[var(--accent)]/30">
        <div className="flex items-center gap-2 mb-2">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-[var(--accent)]" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
          </svg>
          <span className="font-medium">Review Extracted Data</span>
        </div>
        <p className="text-sm text-[var(--foreground-muted)]">
          We extracted {extractedData.entries?.length || 0} day(s) from your timesheet.
          Please review and correct any errors before submitting.
        </p>
      </div>

      {/* Form with pre-filled data */}
      <WeeklyTimesheetForm
        initialData={extractedData}
        photoStorageId={photoStorageId}
        onSuccess={onSuccess}
      />
    </div>
  );
}
