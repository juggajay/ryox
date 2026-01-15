'use client';

import { useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { Id } from '../../../convex/_generated/dataModel';

interface ReadReceiptModalProps {
  messageId: Id<"chatMessages">;
  userId: Id<"users">;
  onClose: () => void;
}

export function ReadReceiptModal({ messageId, userId, onClose }: ReadReceiptModalProps) {
  const readReceipts = useQuery(api.chat.getMessageReadBy, { userId, messageId });

  if (!readReceipts) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
        <div className="bg-[var(--card)] rounded-xl p-4 w-72">
          <div className="animate-pulse space-y-2">
            <div className="h-4 bg-[var(--secondary)] rounded w-1/2" />
            <div className="h-8 bg-[var(--secondary)] rounded" />
            <div className="h-8 bg-[var(--secondary)] rounded" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-[var(--card)] rounded-xl p-4 w-72 max-h-80 overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold">
            Seen by {readReceipts.readBy.length}
          </h3>
          <button onClick={onClose} className="text-[var(--foreground-muted)] hover:text-[var(--foreground)]">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-2">
          {readReceipts.readBy
            .filter((user): user is { _id: Id<"users">; name: string } => user !== null)
            .map((user) => (
              <div key={user._id} className="flex items-center gap-2 p-2 rounded-lg hover:bg-[var(--secondary)]">
                <div className="w-8 h-8 rounded-full bg-[var(--accent)] flex items-center justify-center text-sm text-[var(--background)]">
                  {user.name.charAt(0)}
                </div>
                <span className="text-sm">{user.name}</span>
              </div>
            ))}
        </div>

        {readReceipts.readBy.length < readReceipts.totalParticipants && (
          <p className="text-xs text-[var(--foreground-muted)] mt-3 pt-3 border-t border-[var(--border)]">
            {readReceipts.totalParticipants - readReceipts.readBy.length} haven't seen this yet
          </p>
        )}
      </div>
    </div>
  );
}
