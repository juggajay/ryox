'use client';

import { useQuery, useMutation, useAction } from 'convex/react';
import { api } from '../../../../convex/_generated/api';
import { useAuth } from '@/lib/auth-context';
import { useState, useRef, useEffect } from 'react';
import { format } from 'date-fns';
import { Id } from '../../../../convex/_generated/dataModel';

interface ConversationItem {
  type: 'question' | 'answer';
  content: string;
  sources?: string[];
  timestamp: Date;
}

export default function KnowledgePage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'ask' | 'documents'>('ask');
  const [question, setQuestion] = useState('');
  const [isAsking, setIsAsking] = useState(false);
  const [conversation, setConversation] = useState<ConversationItem[]>([]);
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadForm, setUploadForm] = useState({
    title: '',
    content: '',
    sourceUrl: '',
  });
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Queries
  const documents = useQuery(api.knowledge.listDocuments,
    user ? { userId: user._id } : 'skip'
  );

  // Actions and Mutations
  const askQuestion = useAction(api.knowledge.askQuestion);
  const addDocument = useMutation(api.knowledge.addDocument);
  const deleteDocument = useMutation(api.knowledge.deleteDocument);

  // Auto-scroll to bottom when conversation updates
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversation]);

  const handleAskQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !question.trim()) return;

    const userQuestion = question.trim();
    setQuestion('');
    setIsAsking(true);

    // Add question to conversation
    setConversation(prev => [...prev, {
      type: 'question',
      content: userQuestion,
      timestamp: new Date(),
    }]);

    try {
      const result = await askQuestion({
        userId: user._id,
        question: userQuestion,
      });

      // Add answer to conversation
      setConversation(prev => [...prev, {
        type: 'answer',
        content: result.answer,
        sources: result.sources,
        timestamp: new Date(),
      }]);
    } catch (err) {
      console.error('Failed to get answer:', err);
      setConversation(prev => [...prev, {
        type: 'answer',
        content: 'Sorry, something went wrong. Please try again.',
        timestamp: new Date(),
      }]);
    } finally {
      setIsAsking(false);
      inputRef.current?.focus();
    }
  };

  const handleUploadDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !uploadForm.title || !uploadForm.content) return;

    setIsUploading(true);
    try {
      await addDocument({
        userId: user._id,
        title: uploadForm.title,
        content: uploadForm.content,
        sourceUrl: uploadForm.sourceUrl || undefined,
      });
      setUploadForm({ title: '', content: '', sourceUrl: '' });
      setShowUploadForm(false);
    } catch (err) {
      console.error('Failed to upload document:', err);
      alert('Failed to upload document. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteDocument = async (docId: Id<"knowledgeDocs">) => {
    if (!user || !confirm('Are you sure you want to delete this document?')) return;
    await deleteDocument({ userId: user._id, docId });
  };

  const handleSuggestedQuestion = (q: string) => {
    setQuestion(q);
    inputRef.current?.focus();
  };

  const suggestedQuestions = [
    'What are the stud spacing requirements for load-bearing walls?',
    'What is the required fall for a deck?',
    'What are white card requirements in NSW?',
    'Minimum ceiling height for habitable rooms?',
  ];

  const isOwner = user?.role === 'owner';

  return (
    <div className="space-y-4 md:space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">AI Help</h1>
        <p className="text-sm md:text-base text-[var(--foreground-muted)]">
          Ask questions about building codes, standards, and best practices
        </p>
      </div>

      {/* Tabs - Only show documents tab for owners */}
      {isOwner && (
        <div className="flex gap-1 md:gap-2 overflow-x-auto pb-2 -mx-4 px-4 md:mx-0 md:px-0 border-b border-[var(--border)]">
          <button
            onClick={() => setActiveTab('ask')}
            className={`
              flex items-center gap-2 px-4 py-2.5 rounded-t-lg
              font-medium text-sm whitespace-nowrap
              transition-colors flex-shrink-0
              ${activeTab === 'ask'
                ? 'bg-[var(--accent)] text-[var(--background)]'
                : 'text-[var(--foreground-muted)] hover:text-[var(--foreground)] active:bg-[var(--card)]'
              }
            `}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
            </svg>
            Ask AI
          </button>
          <button
            onClick={() => setActiveTab('documents')}
            className={`
              flex items-center gap-2 px-4 py-2.5 rounded-t-lg
              font-medium text-sm whitespace-nowrap
              transition-colors flex-shrink-0
              ${activeTab === 'documents'
                ? 'bg-[var(--accent)] text-[var(--background)]'
                : 'text-[var(--foreground-muted)] hover:text-[var(--foreground)] active:bg-[var(--card)]'
              }
            `}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Documents ({documents?.length || 0})
          </button>
        </div>
      )}

      {/* Ask AI Tab */}
      {activeTab === 'ask' && (
        <div className="flex flex-col h-[calc(100vh-16rem)] md:h-[calc(100vh-14rem)]">
          {/* Conversation Area */}
          <div className="flex-1 overflow-y-auto space-y-4 pb-4">
            {conversation.length === 0 ? (
              <div className="text-center py-8 md:py-12">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[var(--accent)]/10 flex items-center justify-center">
                  <svg className="w-8 h-8 text-[var(--accent)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold mb-2">Building Code Assistant</h3>
                <p className="text-sm text-[var(--foreground-muted)] mb-6 max-w-md mx-auto">
                  Ask questions about Australian building codes, carpentry standards, safety requirements, and more.
                </p>

                {/* Suggested Questions */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-w-2xl mx-auto">
                  {suggestedQuestions.map((q, i) => (
                    <button
                      key={i}
                      onClick={() => handleSuggestedQuestion(q)}
                      className="
                        p-3 bg-[var(--card)] border border-[var(--border)]
                        rounded-xl text-left text-sm
                        hover:border-[var(--accent)] hover:bg-[var(--card-hover)]
                        active:scale-[0.98] transition-all
                      "
                    >
                      <span className="text-[var(--accent)] mr-2">→</span>
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <>
                {conversation.map((item, index) => (
                  <div
                    key={index}
                    className={`flex ${item.type === 'question' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`
                        max-w-[90%] md:max-w-[80%] rounded-2xl px-4 py-3
                        ${item.type === 'question'
                          ? 'bg-[var(--accent)] text-[var(--background)] rounded-br-md'
                          : 'bg-[var(--card)] border border-[var(--border)] rounded-bl-md'
                        }
                      `}
                    >
                      {item.type === 'answer' && (
                        <div className="flex items-center gap-2 mb-2 text-[var(--accent)]">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                          </svg>
                          <span className="text-xs font-medium">AI Assistant</span>
                        </div>
                      )}
                      <p className="whitespace-pre-wrap text-[15px]">{item.content}</p>
                      {item.sources && item.sources.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-[var(--border)]">
                          <p className="text-xs text-[var(--foreground-muted)] mb-2">Sources:</p>
                          <div className="flex flex-wrap gap-1">
                            {item.sources.map((source, i) => (
                              <span
                                key={i}
                                className="px-2 py-0.5 bg-[var(--background)] rounded text-xs"
                              >
                                {source}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                {/* Loading indicator */}
                {isAsking && (
                  <div className="flex justify-start">
                    <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl rounded-bl-md px-4 py-3">
                      <div className="flex items-center gap-2 text-[var(--foreground-muted)]">
                        <div className="flex gap-1">
                          <div className="w-2 h-2 bg-[var(--accent)] rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                          <div className="w-2 h-2 bg-[var(--accent)] rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                          <div className="w-2 h-2 bg-[var(--accent)] rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                        </div>
                        <span className="text-sm">Thinking...</span>
                      </div>
                    </div>
                  </div>
                )}

                <div ref={chatEndRef} />
              </>
            )}
          </div>

          {/* Question Input */}
          <form onSubmit={handleAskQuestion} className="mt-auto pt-4 border-t border-[var(--border)]">
            <div className="flex gap-2">
              <input
                ref={inputRef}
                type="text"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="Ask about building codes, carpentry..."
                className="
                  flex-1 px-4 py-3
                  bg-[var(--card)] border border-[var(--border)]
                  rounded-2xl text-base
                  focus:outline-none focus:ring-2 focus:ring-[var(--accent)]
                "
                disabled={isAsking}
              />
              <button
                type="submit"
                disabled={isAsking || !question.trim()}
                className="
                  p-3 md:px-6 md:py-3
                  bg-[var(--accent)] text-[var(--background)]
                  rounded-2xl md:rounded-xl
                  font-medium
                  hover:bg-[var(--accent)]/90
                  disabled:opacity-50
                  active:scale-95 transition-transform
                "
              >
                {isAsking ? (
                  <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <svg className="w-5 h-5 md:hidden" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                    </svg>
                    <span className="hidden md:inline">Ask</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Documents Tab (Owner only) */}
      {activeTab === 'documents' && isOwner && (
        <div className="space-y-4">
          {/* Upload Button */}
          <div className="flex justify-end">
            <button
              onClick={() => setShowUploadForm(!showUploadForm)}
              className="
                flex items-center gap-2 px-4 py-2.5
                bg-[var(--accent)] text-[var(--background)]
                rounded-xl font-medium
                hover:bg-[var(--accent)]/90
                active:scale-95 transition-transform
              "
            >
              {showUploadForm ? (
                <>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  Cancel
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Add Document
                </>
              )}
            </button>
          </div>

          {/* Upload Form */}
          {showUploadForm && (
            <form onSubmit={handleUploadDocument} className="bg-[var(--card)] p-4 md:p-6 rounded-xl border border-[var(--border)] space-y-4">
              <h3 className="font-semibold text-lg">Add Knowledge Document</h3>

              <div>
                <label className="block text-sm font-medium text-[var(--foreground-muted)] mb-2">
                  Title *
                </label>
                <input
                  type="text"
                  value={uploadForm.title}
                  onChange={(e) => setUploadForm({ ...uploadForm, title: e.target.value })}
                  required
                  placeholder="e.g., AS 1684 Residential Timber Framing"
                  className="w-full px-4 py-3 bg-[var(--background)] border border-[var(--border)] rounded-xl text-base"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--foreground-muted)] mb-2">
                  Source URL (optional)
                </label>
                <input
                  type="url"
                  value={uploadForm.sourceUrl}
                  onChange={(e) => setUploadForm({ ...uploadForm, sourceUrl: e.target.value })}
                  placeholder="https://..."
                  className="w-full px-4 py-3 bg-[var(--background)] border border-[var(--border)] rounded-xl text-base"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--foreground-muted)] mb-2">
                  Content *
                </label>
                <textarea
                  value={uploadForm.content}
                  onChange={(e) => setUploadForm({ ...uploadForm, content: e.target.value })}
                  required
                  rows={8}
                  placeholder="Paste the document content here..."
                  className="w-full px-4 py-3 bg-[var(--background)] border border-[var(--border)] rounded-xl text-base resize-none"
                />
              </div>

              <button
                type="submit"
                disabled={isUploading}
                className="
                  w-full py-3
                  bg-[var(--accent)] text-[var(--background)]
                  rounded-xl font-medium
                  hover:bg-[var(--accent)]/90
                  disabled:opacity-50
                  active:scale-[0.98] transition-transform
                "
              >
                {isUploading ? 'Processing...' : 'Upload & Process'}
              </button>
            </form>
          )}

          {/* Documents List */}
          <div className="space-y-3">
            {!documents ? (
              <div className="animate-pulse space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-20 bg-[var(--card)] rounded-xl" />
                ))}
              </div>
            ) : documents.length === 0 ? (
              <div className="text-center py-12 bg-[var(--card)] rounded-xl border border-[var(--border)]">
                <svg className="w-12 h-12 mx-auto mb-4 text-[var(--foreground-muted)] opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <p className="text-lg font-medium">No documents in knowledge base</p>
                <p className="text-sm text-[var(--foreground-muted)] mt-1">
                  Add documents to improve AI responses
                </p>
              </div>
            ) : (
              documents.map((doc) => (
                <div
                  key={doc._id}
                  className="bg-[var(--card)] p-4 rounded-xl border border-[var(--border)] flex items-center justify-between gap-4"
                >
                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-medium truncate">{doc.title}</h3>
                      {doc.isGlobal && (
                        <span className="px-2 py-0.5 rounded text-xs bg-blue-500/20 text-blue-400">
                          Global
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-[var(--foreground-muted)]">
                      {doc.chunkCount} chunks · {format(new Date(doc.uploadedAt), 'dd MMM yyyy')}
                    </p>
                    {doc.sourceUrl && (
                      <a
                        href={doc.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-[var(--accent)] hover:underline inline-flex items-center gap-1"
                      >
                        View source
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                      </a>
                    )}
                  </div>
                  {!doc.isGlobal && (
                    <button
                      onClick={() => handleDeleteDocument(doc._id)}
                      className="text-red-400 hover:text-red-300 p-2 active:scale-95"
                    >
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
