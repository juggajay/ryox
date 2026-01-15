'use client';

import { useRef, useState } from 'react';
import { useMutation } from 'convex/react';
import { api } from '../../../convex/_generated/api';

interface UploadedFile {
  url: string;
  type: 'image' | 'file';
  name: string;
  size: number;
}

interface FileUploadProps {
  onFilesSelected: (files: UploadedFile[]) => void;
  maxFiles?: number;
  maxSizeMB?: number;
}

export function FileUpload({
  onFilesSelected,
  maxFiles = 10,
  maxSizeMB = 25
}: FileUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const generateUploadUrl = useMutation(api.files.generateUploadUrl);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    // Validate
    if (files.length > maxFiles) {
      alert(`Maximum ${maxFiles} files allowed`);
      return;
    }

    const maxSizeBytes = maxSizeMB * 1024 * 1024;
    const oversized = files.filter(f => f.size > maxSizeBytes);
    if (oversized.length > 0) {
      alert(`Files must be under ${maxSizeMB}MB: ${oversized.map(f => f.name).join(', ')}`);
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);

    try {
      const uploadedFiles: UploadedFile[] = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];

        // Get upload URL from Convex
        const uploadUrl = await generateUploadUrl();

        // Upload file
        const response = await fetch(uploadUrl, {
          method: 'POST',
          headers: { 'Content-Type': file.type },
          body: file,
        });

        if (!response.ok) throw new Error('Upload failed');

        const { storageId } = await response.json();

        // Determine file type
        const isImage = file.type.startsWith('image/');

        uploadedFiles.push({
          url: storageId, // Will be resolved by Convex
          type: isImage ? 'image' : 'file',
          name: file.name,
          size: file.size,
        });

        setUploadProgress(((i + 1) / files.length) * 100);
      }

      onFilesSelected(uploadedFiles);
    } catch (err) {
      console.error('Upload error:', err);
      alert('Failed to upload files');
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
      // Reset input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  return (
    <div className="relative">
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
        onChange={handleFileSelect}
        className="hidden"
      />

      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        disabled={isUploading}
        className="
          p-3 rounded-xl
          bg-[var(--secondary)] border border-[var(--border)]
          hover:bg-[var(--card)]
          disabled:opacity-50
          transition-colors
        "
      >
        {isUploading ? (
          <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
        ) : (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        )}
      </button>

      {isUploading && uploadProgress > 0 && (
        <div className="absolute -top-1 -right-1 w-4 h-4">
          <svg className="w-4 h-4 transform -rotate-90">
            <circle
              cx="8"
              cy="8"
              r="6"
              fill="none"
              stroke="var(--accent)"
              strokeWidth="2"
              strokeDasharray={`${(uploadProgress / 100) * 37.7} 37.7`}
            />
          </svg>
        </div>
      )}
    </div>
  );
}
