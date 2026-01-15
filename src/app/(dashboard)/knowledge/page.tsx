'use client';

import { useQuery, useAction } from 'convex/react';
import { api } from '../../../../convex/_generated/api';
import { useAuth } from '@/lib/auth-context';
import { useState, useRef, useEffect } from 'react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  sources?: Array<{ title: string; url?: string }>;
  timestamp: Date;
}

export default function KnowledgePage() {
  const { user } = useAuth();
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const askQuestion = useAction(api.knowledge.askQuestion);

  const hasMessages = messages.length > 0;

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Auto-resize textarea
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
      inputRef.current.style.height = Math.min(inputRef.current.scrollHeight, 200) + 'px';
    }
  }, [input]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput('');
    setIsLoading(true);

    // Add user message
    setMessages(prev => [...prev, {
      role: 'user',
      content: userMessage,
      timestamp: new Date(),
    }]);

    try {
      const result = await askQuestion({
        userId: user._id,
        question: userMessage,
      });

      setMessages(prev => [...prev, {
        role: 'assistant',
        content: result.answer,
        sources: result.sources,
        timestamp: new Date(),
      }]);
    } catch (err) {
      console.error('Failed to get answer:', err);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Unable to process your question. Please try again.',
        timestamp: new Date(),
      }]);
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleSuggestion = (q: string) => {
    setInput(q);
    inputRef.current?.focus();
  };

  const suggestions = [
    'Stud spacing for load-bearing walls?',
    'Minimum ceiling height requirements?',
    'AS 1684 span table basics?',
    'Deck fall requirements?',
  ];

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col relative">
      {/* Messages area or empty state */}
      <div className={`
        flex-1 overflow-y-auto
        ${hasMessages ? 'pb-32' : 'flex items-center justify-center'}
      `}>
        {!hasMessages ? (
          /* Empty state - centered */
          <div className="w-full max-w-2xl mx-auto px-4 -mt-16">
            {/* Title */}
            <div className="text-center mb-8">
              <div className="inline-flex items-center gap-2 text-[var(--accent)] mb-3">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                </svg>
                <span className="text-sm font-medium tracking-wide uppercase">AI Assistant</span>
              </div>
              <h1 className="text-2xl font-semibold text-[var(--foreground)] mb-2">
                Building Code Knowledge
              </h1>
              <p className="text-[var(--foreground-muted)] text-sm">
                Australian standards, NCC requirements, carpentry specs
              </p>
            </div>

            {/* Input */}
            <form onSubmit={handleSubmit} className="mb-6">
              <div className="relative group">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask a question..."
                  rows={1}
                  className="
                    w-full px-4 py-4 pr-14
                    bg-[var(--card)]
                    border border-[var(--border)]
                    rounded-xl
                    text-[var(--foreground)] text-base
                    placeholder:text-[var(--foreground-muted)]/50
                    resize-none
                    focus:outline-none focus:border-[var(--accent)]/50
                    focus:shadow-[0_0_0_1px_var(--accent)/20,0_4px_20px_-4px_var(--accent)/15]
                    transition-all duration-200
                  "
                />
                <button
                  type="submit"
                  disabled={!input.trim() || isLoading}
                  className="
                    absolute right-3 top-1/2 -translate-y-1/2
                    w-9 h-9
                    flex items-center justify-center
                    bg-[var(--accent)] text-[var(--background)]
                    rounded-lg
                    disabled:opacity-30 disabled:cursor-not-allowed
                    hover:opacity-90
                    active:scale-95
                    transition-all duration-150
                  "
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 10.5L12 3m0 0l7.5 7.5M12 3v18" />
                  </svg>
                </button>
              </div>
            </form>

            {/* Suggestions */}
            <div className="flex flex-wrap justify-center gap-2">
              {suggestions.map((q, i) => (
                <button
                  key={i}
                  onClick={() => handleSuggestion(q)}
                  className="
                    px-3 py-1.5
                    text-sm text-[var(--foreground-muted)]
                    bg-[var(--card)]/50
                    border border-[var(--border)]/50
                    rounded-full
                    hover:border-[var(--accent)]/30 hover:text-[var(--foreground)]
                    active:scale-95
                    transition-all duration-150
                  "
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        ) : (
          /* Messages */
          <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
            {messages.map((message, index) => (
              <div
                key={index}
                className={`
                  animate-in fade-in slide-in-from-bottom-2 duration-300
                  ${message.role === 'user' ? 'flex justify-end' : ''}
                `}
                style={{ animationDelay: `${index * 50}ms` }}
              >
                {message.role === 'user' ? (
                  /* User message */
                  <div className="
                    max-w-[85%]
                    px-4 py-3
                    bg-[var(--accent)]/10
                    border border-[var(--accent)]/20
                    rounded-2xl rounded-br-sm
                    text-[var(--foreground)]
                  ">
                    <p className="text-[15px] leading-relaxed">{message.content}</p>
                  </div>
                ) : (
                  /* Assistant message */
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-[var(--accent)]">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                      </svg>
                      <span className="text-xs font-medium tracking-wide uppercase">Assistant</span>
                    </div>
                    <div className="
                      text-[var(--foreground)] text-[15px] leading-relaxed
                      prose prose-invert prose-sm max-w-none
                      prose-p:my-2 prose-ul:my-2 prose-li:my-0.5
                    ">
                      <p className="whitespace-pre-wrap">{message.content}</p>
                    </div>
                    {message.sources && message.sources.length > 0 && (
                      <div className="flex flex-wrap gap-2 pt-2">
                        {message.sources.map((source, i) => (
                          source.url ? (
                            <a
                              key={i}
                              href={source.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="
                                inline-flex items-center gap-1.5
                                px-2.5 py-1
                                text-xs text-[var(--foreground-muted)]
                                bg-[var(--card)]
                                border border-[var(--border)]
                                rounded-md
                                hover:border-[var(--accent)]/30 hover:text-[var(--accent)]
                                transition-colors
                              "
                            >
                              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                              </svg>
                              {source.title}
                            </a>
                          ) : (
                            <span
                              key={i}
                              className="
                                inline-flex items-center
                                px-2.5 py-1
                                text-xs text-[var(--foreground-muted)]
                                bg-[var(--card)]
                                border border-[var(--border)]
                                rounded-md
                              "
                            >
                              {source.title}
                            </span>
                          )
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}

            {/* Loading indicator */}
            {isLoading && (
              <div className="animate-in fade-in duration-300">
                <div className="flex items-center gap-2 text-[var(--accent)]">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                  </svg>
                  <span className="text-xs font-medium tracking-wide uppercase">Assistant</span>
                </div>
                <div className="mt-3 flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] animate-pulse" />
                  <div className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] animate-pulse" style={{ animationDelay: '150ms' }} />
                  <div className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] animate-pulse" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Fixed bottom input - only when there are messages */}
      {hasMessages && (
        <div className="
          fixed bottom-0 left-0 right-0
          bg-gradient-to-t from-[var(--background)] via-[var(--background)] to-transparent
          pt-6 pb-4 px-4
          md:left-64
        ">
          <form onSubmit={handleSubmit} className="max-w-3xl mx-auto">
            <div className="relative">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask a follow-up..."
                rows={1}
                className="
                  w-full px-4 py-3.5 pr-14
                  bg-[var(--card)]
                  border border-[var(--border)]
                  rounded-xl
                  text-[var(--foreground)] text-base
                  placeholder:text-[var(--foreground-muted)]/50
                  resize-none
                  focus:outline-none focus:border-[var(--accent)]/50
                  focus:shadow-[0_0_0_1px_var(--accent)/20,0_4px_20px_-4px_var(--accent)/15]
                  transition-all duration-200
                "
              />
              <button
                type="submit"
                disabled={!input.trim() || isLoading}
                className="
                  absolute right-3 top-1/2 -translate-y-1/2
                  w-8 h-8
                  flex items-center justify-center
                  bg-[var(--accent)] text-[var(--background)]
                  rounded-lg
                  disabled:opacity-30 disabled:cursor-not-allowed
                  hover:opacity-90
                  active:scale-95
                  transition-all duration-150
                "
              >
                {isLoading ? (
                  <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                ) : (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 10.5L12 3m0 0l7.5 7.5M12 3v18" />
                  </svg>
                )}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
