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
  const messagesEndRef = useRef<HTMLDivElement>(null);

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
      <div className="flex h-[calc(100vh-8rem)]">
        <div className="w-80 border-r border-[var(--border)] animate-pulse bg-[var(--card)]" />
        <div className="flex-1 animate-pulse bg-[var(--secondary)]" />
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-8rem)] bg-[var(--card)] rounded-lg border border-[var(--border)] overflow-hidden">
      {/* Channel List */}
      <div className="w-80 border-r border-[var(--border)] flex flex-col">
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
                onClick={() => setSelectedChannelId(channel._id)}
                className={`w-full p-4 text-left border-b border-[var(--border)] hover:bg-[var(--secondary)] transition-colors ${
                  selectedChannelId === channel._id ? 'bg-[var(--secondary)]' : ''
                }`}
              >
                <div className="flex items-start gap-3">
                  <span className="text-xl">{getChannelIcon(channel.type)}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h3 className="font-medium truncate">
                        {getChannelDisplayName(channel)}
                      </h3>
                      {channel.unreadCount > 0 && (
                        <span className="ml-2 px-2 py-0.5 bg-[var(--accent)] text-[var(--background)] text-xs rounded-full">
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
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Message Area */}
      <div className="flex-1 flex flex-col">
        {selectedChannelId && selectedChannel ? (
          <>
            {/* Channel Header */}
            <div className="p-4 border-b border-[var(--border)] bg-[var(--secondary)]">
              <div className="flex items-center gap-2">
                <span className="text-xl">{getChannelIcon(selectedChannel.type)}</span>
                <div>
                  <h3 className="font-semibold">
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
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {!messages || messages.length === 0 ? (
                <div className="text-center text-[var(--foreground-muted)] py-12">
                  No messages yet. Start the conversation!
                </div>
              ) : (
                messages.map((msg) => (
                  <div
                    key={msg._id}
                    className={`flex ${msg.isOwnMessage ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[70%] rounded-lg p-3 ${
                        msg.isOwnMessage
                          ? 'bg-[var(--accent)] text-[var(--background)]'
                          : 'bg-[var(--secondary)]'
                      }`}
                    >
                      {!msg.isOwnMessage && (
                        <p className="text-xs font-medium mb-1 opacity-70">
                          {msg.senderName}
                        </p>
                      )}
                      <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                      <p
                        className={`text-xs mt-1 ${
                          msg.isOwnMessage ? 'opacity-70' : 'text-[var(--foreground-muted)]'
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
            <form onSubmit={handleSendMessage} className="p-4 border-t border-[var(--border)]">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  placeholder="Type a message..."
                  className="flex-1 px-4 py-2 bg-[var(--secondary)] border border-[var(--border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                  disabled={isSending}
                />
                <button
                  type="submit"
                  disabled={isSending || !messageInput.trim()}
                  className="px-6 py-2 bg-[var(--accent)] text-[var(--background)] rounded-lg font-medium hover:bg-[var(--accent)]/90 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSending ? '...' : 'Send'}
                </button>
              </div>
            </form>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-[var(--foreground-muted)]">
            Select a conversation to start chatting
          </div>
        )}
      </div>
    </div>
  );
}
