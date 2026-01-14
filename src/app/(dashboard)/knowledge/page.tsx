'use client';

import { useQuery, useMutation, useAction } from 'convex/react';
import { api } from '../../../../convex/_generated/api';
import { useAuth } from '@/lib/auth-context';
import { useState, useRef } from 'react';
import { format } from 'date-fns';
import { Id } from '../../../../convex/_generated/dataModel';

export default function KnowledgePage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'ask' | 'documents'>('ask');
  const [question, setQuestion] = useState('');
  const [isAsking, setIsAsking] = useState(false);
  const [answer, setAnswer] = useState<{ answer: string; sources: string[] } | null>(null);
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadForm, setUploadForm] = useState({
    title: '',
    content: '',
    sourceUrl: '',
  });
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Queries
  const documents = useQuery(api.knowledge.listDocuments,
    user ? { userId: user._id } : 'skip'
  );

  // Actions and Mutations
  const askQuestion = useAction(api.knowledge.askQuestion);
  const addDocument = useMutation(api.knowledge.addDocument);

  // Mutations
  const deleteDocument = useMutation(api.knowledge.deleteDocument);

  const handleAskQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !question.trim()) return;

    setIsAsking(true);
    setAnswer(null);

    try {
      const result = await askQuestion({
        userId: user._id,
        question: question.trim(),
      });
      setAnswer(result);
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    } catch (err) {
      console.error('Failed to get answer:', err);
      setAnswer({ answer: 'Sorry, something went wrong. Please try again.', sources: [] });
    } finally {
      setIsAsking(false);
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Knowledge Base</h1>
        <p className="text-[var(--foreground-muted)]">
          Ask questions about building codes, standards, and best practices
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-[var(--border)] pb-2">
        <button
          onClick={() => setActiveTab('ask')}
          className={`px-4 py-2 rounded-t font-medium transition-colors ${
            activeTab === 'ask'
              ? 'bg-[var(--accent)] text-[var(--background)]'
              : 'text-[var(--foreground-muted)] hover:text-[var(--foreground)]'
          }`}
        >
          Ask AI
        </button>
        <button
          onClick={() => setActiveTab('documents')}
          className={`px-4 py-2 rounded-t font-medium transition-colors ${
            activeTab === 'documents'
              ? 'bg-[var(--accent)] text-[var(--background)]'
              : 'text-[var(--foreground-muted)] hover:text-[var(--foreground)]'
          }`}
        >
          Documents ({documents?.length || 0})
        </button>
      </div>

      {/* Ask AI Tab */}
      {activeTab === 'ask' && (
        <div className="space-y-4">
          {/* Answer Display */}
          {answer && (
            <div className="bg-[var(--card)] p-6 rounded-lg border border-[var(--border)]">
              <div className="flex items-start gap-3">
                <span className="text-2xl">🤖</span>
                <div className="flex-1">
                  <p className="whitespace-pre-wrap">{answer.answer}</p>
                  {answer.sources.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-[var(--border)]">
                      <p className="text-xs text-[var(--foreground-muted)]">Sources:</p>
                      <div className="flex flex-wrap gap-2 mt-1">
                        {answer.sources.map((source, i) => (
                          <span
                            key={i}
                            className="px-2 py-1 bg-[var(--secondary)] rounded text-xs"
                          >
                            {source}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
          <div ref={chatEndRef} />

          {/* Question Input */}
          <form onSubmit={handleAskQuestion} className="bg-[var(--card)] p-4 rounded-lg border border-[var(--border)]">
            <div className="flex gap-3">
              <input
                type="text"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="Ask about building codes, carpentry standards, safety requirements..."
                className="flex-1 px-4 py-3 bg-[var(--secondary)] border border-[var(--border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                disabled={isAsking}
              />
              <button
                type="submit"
                disabled={isAsking || !question.trim()}
                className="px-6 py-3 bg-[var(--accent)] text-[var(--background)] rounded-lg font-medium hover:bg-[var(--accent)]/90 disabled:opacity-50"
              >
                {isAsking ? '...' : 'Ask'}
              </button>
            </div>
          </form>

          {/* Suggested Questions */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {[
              'What are the minimum stud spacing requirements for load-bearing walls?',
              'What is the required fall for a deck?',
              'What are the white card requirements in NSW?',
              'What is the minimum ceiling height for a habitable room?',
            ].map((q, i) => (
              <button
                key={i}
                onClick={() => setQuestion(q)}
                className="p-3 bg-[var(--card)] border border-[var(--border)] rounded-lg text-left text-sm hover:border-[var(--accent)] transition-colors"
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Documents Tab */}
      {activeTab === 'documents' && (
        <div className="space-y-4">
          {/* Upload Button (Owner only) */}
          {user?.role === 'owner' && (
            <div className="flex justify-end">
              <button
                onClick={() => setShowUploadForm(!showUploadForm)}
                className="px-4 py-2 bg-[var(--accent)] text-[var(--background)] rounded-lg font-medium hover:bg-[var(--accent)]/90"
              >
                {showUploadForm ? 'Cancel' : '+ Add Document'}
              </button>
            </div>
          )}

          {/* Upload Form */}
          {showUploadForm && (
            <form onSubmit={handleUploadDocument} className="bg-[var(--card)] p-6 rounded-lg border border-[var(--border)] space-y-4">
              <h3 className="font-semibold text-lg">Add Knowledge Document</h3>

              <div>
                <label className="block text-sm font-medium text-[var(--foreground-muted)] mb-1">
                  Title *
                </label>
                <input
                  type="text"
                  value={uploadForm.title}
                  onChange={(e) => setUploadForm({ ...uploadForm, title: e.target.value })}
                  required
                  placeholder="e.g., AS 1684 Residential Timber Framing"
                  className="w-full px-3 py-2 bg-[var(--secondary)] border border-[var(--border)] rounded-lg"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--foreground-muted)] mb-1">
                  Source URL (optional)
                </label>
                <input
                  type="url"
                  value={uploadForm.sourceUrl}
                  onChange={(e) => setUploadForm({ ...uploadForm, sourceUrl: e.target.value })}
                  placeholder="https://..."
                  className="w-full px-3 py-2 bg-[var(--secondary)] border border-[var(--border)] rounded-lg"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--foreground-muted)] mb-1">
                  Content *
                </label>
                <textarea
                  value={uploadForm.content}
                  onChange={(e) => setUploadForm({ ...uploadForm, content: e.target.value })}
                  required
                  rows={10}
                  placeholder="Paste the document content here..."
                  className="w-full px-3 py-2 bg-[var(--secondary)] border border-[var(--border)] rounded-lg resize-none"
                />
              </div>

              <button
                type="submit"
                disabled={isUploading}
                className="w-full py-2 bg-[var(--accent)] text-[var(--background)] rounded-lg font-medium hover:bg-[var(--accent)]/90 disabled:opacity-50"
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
                  <div key={i} className="h-20 bg-[var(--card)] rounded-lg" />
                ))}
              </div>
            ) : documents.length === 0 ? (
              <div className="text-center py-12 bg-[var(--card)] rounded-lg border border-[var(--border)]">
                <p className="text-lg font-medium">No documents in knowledge base</p>
                <p className="text-sm text-[var(--foreground-muted)] mt-1">
                  Add documents to improve AI responses
                </p>
              </div>
            ) : (
              documents.map((doc) => (
                <div
                  key={doc._id}
                  className="bg-[var(--card)] p-4 rounded-lg border border-[var(--border)] flex items-center justify-between"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium">{doc.title}</h3>
                      {doc.isGlobal && (
                        <span className="px-2 py-0.5 rounded text-xs bg-blue-500/20 text-blue-400">
                          Global
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-[var(--foreground-muted)]">
                      {doc.chunkCount} chunks • Added {format(new Date(doc.uploadedAt), 'dd MMM yyyy')}
                    </p>
                    {doc.sourceUrl && (
                      <a
                        href={doc.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-[var(--accent)] hover:underline"
                      >
                        View source →
                      </a>
                    )}
                  </div>
                  {user?.role === 'owner' && !doc.isGlobal && (
                    <button
                      onClick={() => handleDeleteDocument(doc._id)}
                      className="text-red-400 hover:text-red-300 text-sm"
                    >
                      Delete
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
