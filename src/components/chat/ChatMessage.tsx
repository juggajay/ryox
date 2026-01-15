'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import { useMutation } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { Id } from '../../../convex/_generated/dataModel';

// Quick reaction emojis
const QUICK_REACTIONS = ['👍', '✅', '❤️', '😂', '🔥'];

interface Attachment {
  url: string;
  type: 'image' | 'file';
  name: string;
  size: number;
}

interface Reaction {
  emoji: string;
  userId: string;
  userName: string;
}

interface ChatMessageProps {
  message: {
    _id: Id<"chatMessages">;
    content: string;
    senderName: string;
    isOwnMessage: boolean;
    createdAt: number;
    editedAt?: number;
    isDeleted?: boolean;
    attachments?: Attachment[];
    attachmentUrl?: string;
    reactionsWithNames: Reaction[];
    canEdit: boolean;
    readByCount: number;
    mentions?: Id<"users">[];
  };
  userId: Id<"users">;
  onEdit?: (messageId: Id<"chatMessages">, content: string) => void;
}

export function ChatMessage({ message, userId, onEdit }: ChatMessageProps) {
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const [showContextMenu, setShowContextMenu] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(message.content);

  const toggleReaction = useMutation(api.chat.toggleReaction);
  const editMessage = useMutation(api.chat.editMessage);
  const deleteMessage = useMutation(api.chat.deleteMessage);

  // Group reactions by emoji
  const groupedReactions = message.reactionsWithNames.reduce((acc, r) => {
    if (!acc[r.emoji]) {
      acc[r.emoji] = { emoji: r.emoji, count: 0, users: [], hasOwn: false };
    }
    acc[r.emoji].count++;
    acc[r.emoji].users.push(r.userName);
    if (r.userId === userId) {
      acc[r.emoji].hasOwn = true;
    }
    return acc;
  }, {} as Record<string, { emoji: string; count: number; users: string[]; hasOwn: boolean }>);

  const handleReaction = async (emoji: string) => {
    await toggleReaction({ userId, messageId: message._id, emoji });
    setShowReactionPicker(false);
  };

  const handleEdit = async () => {
    if (editContent.trim() && editContent !== message.content) {
      await editMessage({ userId, messageId: message._id, content: editContent.trim() });
    }
    setIsEditing(false);
  };

  const handleDelete = async () => {
    if (confirm('Delete this message?')) {
      await deleteMessage({ userId, messageId: message._id });
      setShowContextMenu(false);
    }
  };

  // Handle deleted messages
  if (message.isDeleted) {
    return (
      <div className={`flex ${message.isOwnMessage ? 'justify-end' : 'justify-start'}`}>
        <div className="max-w-[85%] md:max-w-[70%] px-4 py-2.5 text-[var(--foreground-muted)] italic text-sm">
          This message was deleted
        </div>
      </div>
    );
  }

  return (
    <div className={`flex ${message.isOwnMessage ? 'justify-end' : 'justify-start'} group`}>
      <div className="relative">
        {/* Message bubble */}
        <div
          className={`
            max-w-[85%] md:max-w-[70%] rounded-2xl px-4 py-2.5
            ${message.isOwnMessage
              ? 'bg-[var(--accent)] text-[var(--background)] rounded-br-md'
              : 'bg-[var(--secondary)] rounded-bl-md'
            }
          `}
          onContextMenu={(e) => {
            e.preventDefault();
            setShowContextMenu(!showContextMenu);
          }}
          onClick={() => setShowReactionPicker(false)}
        >
          {!message.isOwnMessage && (
            <p className="text-xs font-medium mb-1 opacity-70">
              {message.senderName}
            </p>
          )}

          {isEditing ? (
            <div className="space-y-2">
              <input
                type="text"
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                className="w-full px-2 py-1 rounded bg-[var(--background)] text-[var(--foreground)] text-sm"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleEdit();
                  if (e.key === 'Escape') setIsEditing(false);
                }}
              />
              <div className="flex gap-2 text-xs">
                <button onClick={handleEdit} className="text-green-400">Save</button>
                <button onClick={() => setIsEditing(false)} className="opacity-70">Cancel</button>
              </div>
            </div>
          ) : (
            <p className="whitespace-pre-wrap break-words text-[15px]">{message.content}</p>
          )}

          {/* Attachments */}
          {message.attachments && message.attachments.length > 0 && (
            <div className="mt-2 space-y-2">
              {message.attachments.map((att, i) => (
                <div key={i}>
                  {att.type === 'image' ? (
                    <img
                      src={att.url}
                      alt={att.name}
                      className="max-w-full rounded-lg cursor-pointer"
                      onClick={() => window.open(att.url, '_blank')}
                    />
                  ) : (
                    <a
                      href={att.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 p-2 bg-[var(--background)]/20 rounded-lg text-sm"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <span className="truncate">{att.name}</span>
                      <span className="text-xs opacity-70">
                        {(att.size / 1024).toFixed(0)}KB
                      </span>
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Legacy single attachment */}
          {message.attachmentUrl && !message.attachments?.length && (
            <div className="mt-2">
              <img
                src={message.attachmentUrl}
                alt="Attachment"
                className="max-w-full rounded-lg cursor-pointer"
                onClick={() => window.open(message.attachmentUrl, '_blank')}
              />
            </div>
          )}

          <div className={`flex items-center gap-2 mt-1 text-[10px] ${
            message.isOwnMessage ? 'opacity-70 justify-end' : 'text-[var(--foreground-muted)]'
          }`}>
            {message.editedAt && <span>(edited)</span>}
            <span>{format(new Date(message.createdAt), 'HH:mm')}</span>
            {message.isOwnMessage && (
              <span title={`Seen by ${message.readByCount}`}>
                {message.readByCount > 1 ? '✓✓' : '✓'}
              </span>
            )}
          </div>
        </div>

        {/* Reactions display */}
        {Object.keys(groupedReactions).length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {Object.values(groupedReactions).map((r) => (
              <button
                key={r.emoji}
                onClick={() => handleReaction(r.emoji)}
                className={`
                  flex items-center gap-1 px-2 py-0.5 rounded-full text-xs
                  ${r.hasOwn
                    ? 'bg-[var(--accent)]/30 border border-[var(--accent)]'
                    : 'bg-[var(--secondary)] border border-[var(--border)]'
                  }
                `}
                title={r.users.join(', ')}
              >
                <span>{r.emoji}</span>
                <span>{r.count}</span>
              </button>
            ))}
          </div>
        )}

        {/* Reaction picker */}
        {showReactionPicker && (
          <div className={`
            absolute bottom-full mb-2 z-10
            ${message.isOwnMessage ? 'right-0' : 'left-0'}
            flex gap-1 p-2 bg-[var(--card)] border border-[var(--border)] rounded-full shadow-lg
          `}>
            {QUICK_REACTIONS.map((emoji) => (
              <button
                key={emoji}
                onClick={() => handleReaction(emoji)}
                className="w-8 h-8 flex items-center justify-center hover:bg-[var(--secondary)] rounded-full transition-colors"
              >
                {emoji}
              </button>
            ))}
          </div>
        )}

        {/* Context menu */}
        {showContextMenu && (
          <div className={`
            absolute top-full mt-1 z-10
            ${message.isOwnMessage ? 'right-0' : 'left-0'}
            bg-[var(--card)] border border-[var(--border)] rounded-lg shadow-lg py-1 min-w-[140px]
          `}>
            <button
              onClick={() => { setShowReactionPicker(true); setShowContextMenu(false); }}
              className="w-full px-4 py-2 text-left text-sm hover:bg-[var(--secondary)]"
            >
              React
            </button>
            <button
              onClick={() => { navigator.clipboard.writeText(message.content); setShowContextMenu(false); }}
              className="w-full px-4 py-2 text-left text-sm hover:bg-[var(--secondary)]"
            >
              Copy
            </button>
            {message.canEdit && (
              <>
                <button
                  onClick={() => { setIsEditing(true); setShowContextMenu(false); }}
                  className="w-full px-4 py-2 text-left text-sm hover:bg-[var(--secondary)]"
                >
                  Edit
                </button>
                <button
                  onClick={handleDelete}
                  className="w-full px-4 py-2 text-left text-sm hover:bg-[var(--secondary)] text-red-400"
                >
                  Delete
                </button>
              </>
            )}
          </div>
        )}

        {/* Quick reaction button (appears on hover) */}
        <button
          onClick={() => setShowReactionPicker(!showReactionPicker)}
          className={`
            absolute top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity
            ${message.isOwnMessage ? '-left-10' : '-right-10'}
            w-8 h-8 flex items-center justify-center bg-[var(--card)] border border-[var(--border)] rounded-full text-sm
          `}
        >
          😀
        </button>
      </div>
    </div>
  );
}
