'use client';

import { useQuery, useMutation } from 'convex/react';
import { api } from '../../../../convex/_generated/api';
import { useAuth } from '@/lib/auth-context';
import { useState, useEffect, useRef } from 'react';
import { format } from 'date-fns';
import { Id } from '../../../../convex/_generated/dataModel';

export default function ChatPage() {
  const { user } = useAuth();
  const [selectedChannelId, setSelectedChannelId] = useState<Id<"chatChannels"> | null>(null);
  const [messageInput, setMessageInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [showMobileMessages, setShowMobileMessages] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Queries
  const channels = useQuery(api.chat.listChannels,
    user ? { userId: user._id } : 'skip'
  );

  const messages = useQuery(api.chat.getMessages,
    user && selectedChannelId
      ? { userId: user._id, channelId: selectedChannelId }
      : 'skip'
  );

  const selectedChannel = useQuery(api.chat.getChannel,
    user && selectedChannelId
      ? { userId: user._id, channelId: selectedChannelId }
      : 'skip'
  );

  // Mutations
  const sendMessage = useMutation(api.chat.sendMessage);
  const markAsRead = useMutation(api.chat.markAsRead);
  const getOrCreateCompanyChannel = useMutation(api.chat.getOrCreateCompanyChannel);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Mark as read when viewing channel
  useEffect(() => {
    if (user && selectedChannelId) {
      markAsRead({ userId: user._id, channelId: selectedChannelId });
    }
  }, [selectedChannelId, messages?.length, user, markAsRead]);

  // Initialize company channel on first load if none exists
  useEffect(() => {
    if (user && channels && channels.length === 0) {
      getOrCreateCompanyChannel({ userId: user._id }).then((id) => {
        setSelectedChannelId(id);
      });
    } else if (channels && channels.length > 0 && !selectedChannelId) {
      setSelectedChannelId(channels[0]._id);
    }
  }, [channels, user, selectedChannelId, getOrCreateCompanyChannel]);

  const handleSelectChannel = (channelId: Id<"chatChannels">) => {
    setSelectedChannelId(channelId);
    setShowMobileMessages(true);
  };

  const handleBackToChannels = () => {
    setShowMobileMessages(false);
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !selectedChannelId || !messageInput.trim()) return;

    setIsSending(true);
    try {
      await sendMessage({
        userId: user._id,
        channelId: selectedChannelId,
        content: messageInput.trim(),
      });
      setMessageInput('');
      // Keep focus on input for continuous chatting
      inputRef.current?.focus();
    } catch (err) {
      console.error('Failed to send message:', err);
    } finally {
      setIsSending(false);
    }
  };

  const getChannelDisplayName = (channel: NonNullable<typeof channels>[0]) => {
    if (channel.type === 'company') return channel.name || 'Team Chat';
    if (channel.type === 'job') return channel.jobName || channel.name || 'Job Chat';
    if (channel.type === 'dm') return channel.participantNames.join(', ') || 'Direct Message';
    return 'Chat';
  };

  const getChannelIcon = (type: string) => {
    switch (type) {
      case 'company': return '🏢';
      case 'job': return '🔨';
      case 'dm': return '💬';
      default: return '📝';
    }
  };

  if (!channels) {
    return (
      <div className="flex h-[calc(100vh-10rem)] md:h-[calc(100vh-8rem)]">
        <div className="w-full md:w-80 border-r border-[var(--border)] animate-pulse bg-[var(--card)] rounded-l-xl" />
        <div className="hidden md:block flex-1 animate-pulse bg-[var(--secondary)] rounded-r-xl" />
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-10rem)] md:h-[calc(100vh-8rem)] bg-[var(--card)] rounded-xl border border-[var(--border)] overflow-hidden">
      {/* Channel List - Full width on mobile, fixed width on desktop */}
      <div className={`
        ${showMobileMessages ? 'hidden md:flex' : 'flex'}
        w-full md:w-80
        border-r border-[var(--border)]
        flex-col
      `}>
        <div className="p-4 border-b border-[var(--border)]">
          <h2 className="font-semibold text-lg">Messages</h2>
        </div>

        <div className="flex-1 overflow-y-auto">
          {channels.length === 0 ? (
            <div className="p-4 text-center text-[var(--foreground-muted)]">
              No conversations yet
            </div>
          ) : (
            channels.map((channel) => (
              <button
                key={channel._id}
                onClick={() => handleSelectChannel(channel._id)}
                className={`
                  w-full p-4 text-left
                  border-b border-[var(--border)]
                  transition-colors
                  active:bg-[var(--background)]
                  ${selectedChannelId === channel._id ? 'bg-[var(--secondary)]' : 'hover:bg-[var(--secondary)]'}
                `}
              >
                <div className="flex items-start gap-3">
                  <span className="text-xl">{getChannelIcon(channel.type)}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="font-medium truncate">
                        {getChannelDisplayName(channel)}
                      </h3>
                      {channel.unreadCount > 0 && (
                        <span className="flex-shrink-0 px-2 py-0.5 bg-[var(--accent)] text-[var(--background)] text-xs rounded-full font-medium">
                          {channel.unreadCount}
                        </span>
                      )}
                    </div>
                    {channel.lastMessage && (
                      <p className="text-sm text-[var(--foreground-muted)] truncate mt-1">
                        {channel.lastMessage.content}
                      </p>
                    )}
                  </div>
                  {/* Mobile chevron indicator */}
                  <svg
                    className="w-5 h-5 text-[var(--foreground-muted)] md:hidden flex-shrink-0"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Message Area - Hidden on mobile unless channel selected */}
      <div className={`
        ${showMobileMessages ? 'flex' : 'hidden md:flex'}
        flex-1 flex-col
      `}>
        {selectedChannelId && selectedChannel ? (
          <>
            {/* Channel Header */}
            <div className="p-3 md:p-4 border-b border-[var(--border)] bg-[var(--secondary)]">
              <div className="flex items-center gap-3">
                {/* Mobile back button */}
                <button
                  onClick={handleBackToChannels}
                  className="md:hidden p-2 -ml-2 rounded-lg hover:bg-[var(--card)] active:scale-95"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>

                <span className="text-xl">{getChannelIcon(selectedChannel.type)}</span>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold truncate">
                    {selectedChannel.type === 'company' && (selectedChannel.name || 'Team Chat')}
                    {selectedChannel.type === 'job' && selectedChannel.job?.name}
                    {selectedChannel.type === 'dm' && selectedChannel.participants
                      .filter((p): p is NonNullable<typeof p> => p !== null && p._id !== user?._id)
                      .map(p => p.name)
                      .join(', ')}
                  </h3>
                  <p className="text-xs text-[var(--foreground-muted)]">
                    {selectedChannel.participants.length} members
                  </p>
                </div>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-3 md:p-4 space-y-3 md:space-y-4">
              {!messages || messages.length === 0 ? (
                <div className="text-center text-[var(--foreground-muted)] py-12">
                  <svg
                    className="w-12 h-12 mx-auto mb-3 opacity-50"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                    />
                  </svg>
                  <p>No messages yet</p>
                  <p className="text-sm mt-1">Start the conversation!</p>
                </div>
              ) : (
                messages.map((msg) => (
                  <div
                    key={msg._id}
                    className={`flex ${msg.isOwnMessage ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`
                        max-w-[85%] md:max-w-[70%] rounded-2xl px-4 py-2.5
                        ${msg.isOwnMessage
                          ? 'bg-[var(--accent)] text-[var(--background)] rounded-br-md'
                          : 'bg-[var(--secondary)] rounded-bl-md'
                        }
                      `}
                    >
                      {!msg.isOwnMessage && (
                        <p className="text-xs font-medium mb-1 opacity-70">
                          {msg.senderName}
                        </p>
                      )}
                      <p className="whitespace-pre-wrap break-words text-[15px]">{msg.content}</p>
                      <p
                        className={`text-[10px] mt-1 ${
                          msg.isOwnMessage ? 'opacity-70 text-right' : 'text-[var(--foreground-muted)]'
                        }`}
                      >
                        {format(new Date(msg.createdAt), 'HH:mm')}
                      </p>
                    </div>
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Message Input */}
            <form onSubmit={handleSendMessage} className="p-3 md:p-4 border-t border-[var(--border)] bg-[var(--card)]">
              <div className="flex gap-2">
                <input
                  ref={inputRef}
                  type="text"
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  placeholder="Type a message..."
                  className="
                    flex-1 px-4 py-3
                    bg-[var(--secondary)] border border-[var(--border)]
                    rounded-2xl
                    text-base
                    focus:outline-none focus:ring-2 focus:ring-[var(--accent)]
                  "
                  disabled={isSending}
                />
                <button
                  type="submit"
                  disabled={isSending || !messageInput.trim()}
                  className="
                    p-3 md:px-6 md:py-3
                    bg-[var(--accent)] text-[var(--background)]
                    rounded-2xl md:rounded-xl
                    font-medium
                    hover:bg-[var(--accent)]/90
                    disabled:opacity-50 disabled:cursor-not-allowed
                    active:scale-95 transition-transform
                  "
                >
                  {isSending ? (
                    <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <svg className="w-5 h-5 md:hidden" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                      </svg>
                      <span className="hidden md:inline">Send</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-[var(--foreground-muted)]">
            <div className="text-center">
              <svg
                className="w-16 h-16 mx-auto mb-4 opacity-50"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                />
              </svg>
              <p>Select a conversation to start chatting</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
