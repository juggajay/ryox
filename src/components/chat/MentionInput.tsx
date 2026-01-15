'use client';

import { useState, useRef, useEffect, KeyboardEvent } from 'react';

interface Participant {
  _id: string;
  name: string;
}

interface MentionInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  participants: Participant[];
  disabled?: boolean;
  placeholder?: string;
}

export function MentionInput({
  value,
  onChange,
  onSubmit,
  participants,
  disabled,
  placeholder = "Type a message...",
}: MentionInputProps) {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState<Participant[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [mentionStart, setMentionStart] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Check if we're in a mention context (after @)
    const cursorPos = inputRef.current?.selectionStart || 0;
    const textBeforeCursor = value.slice(0, cursorPos);
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');

    if (lastAtIndex >= 0) {
      const textAfterAt = textBeforeCursor.slice(lastAtIndex + 1);
      // Only show suggestions if no space after @
      if (!textAfterAt.includes(' ')) {
        const query = textAfterAt.toLowerCase();
        const filtered = participants.filter(p =>
          p.name.toLowerCase().includes(query) ||
          p.name.toLowerCase().split(' ')[0].includes(query)
        ).slice(0, 5);

        setSuggestions(filtered);
        setShowSuggestions(filtered.length > 0);
        setMentionStart(lastAtIndex);
        setSelectedIndex(0);
        return;
      }
    }

    setShowSuggestions(false);
    setMentionStart(-1);
  }, [value, participants]);

  const insertMention = (participant: Participant) => {
    if (mentionStart < 0) return;

    const beforeMention = value.slice(0, mentionStart);
    const cursorPos = inputRef.current?.selectionStart || value.length;
    const afterMention = value.slice(cursorPos);

    // Use first name for mention
    const mentionText = `@${participant.name.split(' ')[0]} `;
    const newValue = beforeMention + mentionText + afterMention;

    onChange(newValue);
    setShowSuggestions(false);

    // Focus and set cursor position
    setTimeout(() => {
      inputRef.current?.focus();
      const newCursorPos = beforeMention.length + mentionText.length;
      inputRef.current?.setSelectionRange(newCursorPos, newCursorPos);
    }, 0);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (showSuggestions) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, suggestions.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        if (suggestions[selectedIndex]) {
          insertMention(suggestions[selectedIndex]);
        }
      } else if (e.key === 'Escape') {
        setShowSuggestions(false);
      }
    } else if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSubmit();
    }
  };

  return (
    <div className="relative flex-1">
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        className="
          w-full px-4 py-3
          bg-[var(--secondary)] border border-[var(--border)]
          rounded-2xl
          text-base
          focus:outline-none focus:ring-2 focus:ring-[var(--accent)]
        "
      />

      {/* Mention suggestions dropdown */}
      {showSuggestions && (
        <div className="absolute bottom-full mb-2 left-0 right-0 bg-[var(--card)] border border-[var(--border)] rounded-lg shadow-lg overflow-hidden z-20">
          {suggestions.map((p, i) => (
            <button
              key={p._id}
              onClick={() => insertMention(p)}
              className={`
                w-full px-4 py-2 text-left text-sm flex items-center gap-2
                ${i === selectedIndex ? 'bg-[var(--secondary)]' : 'hover:bg-[var(--secondary)]'}
              `}
            >
              <div className="w-6 h-6 rounded-full bg-[var(--accent)] flex items-center justify-center text-xs text-[var(--background)]">
                {p.name.charAt(0)}
              </div>
              <span>{p.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
