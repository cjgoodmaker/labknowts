"use client";

import { useState, useRef } from "react";

interface NewEntryProps {
  projectSlug: string;
  dimension?: string;
  dimensionLabel?: string;
  onAdded: () => void;
}

export default function NewEntry({ projectSlug, dimension, dimensionLabel, onAdded }: NewEntryProps) {
  const [message, setMessage] = useState("");
  const [tags, setTags] = useState("");
  const [files, setFiles] = useState("");
  const [expanded, setExpanded] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!message.trim()) return;

    setSubmitting(true);
    const dimParam = dimension ? `?dimension=${encodeURIComponent(dimension)}` : "";
    await fetch(`/api/projects/${projectSlug}/entries${dimParam}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: message.trim(),
        tags,
        files: files.trim() || undefined,
      }),
    });

    setMessage("");
    setTags("");
    setFiles("");
    setExpanded(false);
    setSubmitting(false);
    onAdded();
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      formRef.current?.requestSubmit();
    }
  }

  return (
    <div className="fixed bottom-0 left-0 md:left-64 right-0 z-30">
      <div className="max-w-2xl mx-auto px-6 pb-5 pt-2">
        <form
          ref={formRef}
          onSubmit={handleSubmit}
          className="bg-white border border-border rounded-2xl shadow-lg shadow-black/5 p-4"
        >
          <div className="flex items-end gap-3">
            <div className="flex-1 min-w-0">
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onFocus={() => setExpanded(true)}
                onKeyDown={handleKeyDown}
                placeholder={dimensionLabel ? `Log to ${dimensionLabel}...` : "What did you work on?"}
                rows={expanded ? 3 : 1}
                className="w-full resize-none text-sm bg-transparent outline-none placeholder:text-gray-300"
              />
            </div>
            <button
              type="submit"
              disabled={!message.trim() || submitting}
              className="bg-black text-white text-sm px-5 py-2 rounded-full disabled:opacity-30 transition-opacity shrink-0"
            >
              {submitting ? "..." : "Add"}
            </button>
          </div>

          {expanded && (
            <div className="flex flex-wrap items-center gap-3 mt-3 pt-3 border-t border-border">
              <input
                type="text"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="tags (comma separated)"
                className="text-xs text-muted bg-transparent outline-none flex-1 min-w-[120px]"
              />
              <input
                type="text"
                value={files}
                onChange={(e) => setFiles(e.target.value)}
                placeholder="files (comma separated)"
                className="text-xs font-mono text-amber-700 bg-transparent outline-none flex-1 min-w-[120px]"
              />
              <button
                type="button"
                onClick={() => { setExpanded(false); }}
                className="text-[10px] text-muted hover:text-foreground"
              >
                Collapse
              </button>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
