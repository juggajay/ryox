'use client';

import { useState, useRef } from 'react';
import { useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { useAuth } from '@/lib/auth-context';

interface ExtractedData {
  date: string | null;
  startTime: string | null;
  endTime: string | null;
  breakMinutes: number | null;
  signatoryName: string | null;
  signatoryCompany: string | null;
  notes: string | null;
}

interface Props {
  onExtracted: (data: ExtractedData, photoStorageId: string) => void;
}

export function TimesheetPhotoUpload({ onExtracted }: Props) {
  const { user } = useAuth();
  const [isUploading, setIsUploading] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const generateUploadUrl = useMutation(api.timesheets.generateUploadUrl);
  const extractFromPhoto = useMutation(api.timesheets.extractFromPhoto);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    // Show preview
    const reader = new FileReader();
    reader.onload = (e) => setPreview(e.target?.result as string);
    reader.readAsDataURL(file);

    setIsUploading(true);
    setError(null);

    try {
      // Upload to Convex storage
      const uploadUrl = await generateUploadUrl();
      const uploadResponse = await fetch(uploadUrl, {
        method: 'POST',
        headers: { 'Content-Type': file.type },
        body: file,
      });

      const { storageId } = await uploadResponse.json();

      setIsUploading(false);
      setIsExtracting(true);

      // Extract data with Gemini
      const result = await extractFromPhoto({
        userId: user._id,
        photoStorageId: storageId,
      });

      if (result.success && result.data) {
        onExtracted(result.data as ExtractedData, result.photoStorageId!);
      } else {
        setError(result.error || 'Failed to extract data from photo');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setIsUploading(false);
      setIsExtracting(false);
    }
  };

  const resetUpload = () => {
    setPreview(null);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-4">
      <div
        onClick={() => !isUploading && !isExtracting && fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
          isUploading || isExtracting
            ? 'border-[var(--accent)] bg-[var(--accent)]/5'
            : 'border-[var(--border)] hover:border-[var(--accent)]'
        }`}
      >
        {preview ? (
          <div className="space-y-4">
            <img src={preview} alt="Timesheet preview" className="max-h-64 mx-auto rounded" />
            {!isUploading && !isExtracting && !error && (
              <button
                onClick={(e) => { e.stopPropagation(); resetUpload(); }}
                className="text-sm text-[var(--foreground-muted)] hover:text-[var(--foreground)]"
              >
                Click to upload a different photo
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            <div className="text-5xl">📷</div>
            <p className="text-lg font-medium">Upload Timesheet Photo</p>
            <p className="text-sm text-[var(--foreground-muted)]">
              Take a photo of your signed paper timesheet
            </p>
            <p className="text-xs text-[var(--foreground-muted)]">
              AI will extract the date, times, and signature details
            </p>
          </div>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleFileSelect}
          className="hidden"
        />
      </div>

      {isUploading && (
        <div className="flex items-center justify-center gap-2 text-[var(--foreground-muted)]">
          <div className="animate-spin h-4 w-4 border-2 border-[var(--accent)] border-t-transparent rounded-full" />
          <span>Uploading photo...</span>
        </div>
      )}

      {isExtracting && (
        <div className="flex items-center justify-center gap-2 text-[var(--accent)]">
          <div className="animate-spin h-4 w-4 border-2 border-[var(--accent)] border-t-transparent rounded-full" />
          <span>AI is extracting timesheet data...</span>
        </div>
      )}

      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/50 rounded text-red-400 text-sm text-center">
          {error}
          <button
            onClick={resetUpload}
            className="block mx-auto mt-2 text-xs underline hover:no-underline"
          >
            Try again
          </button>
        </div>
      )}
    </div>
  );
}
