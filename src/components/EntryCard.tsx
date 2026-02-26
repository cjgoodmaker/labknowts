"use client";

import { useState } from "react";

interface EntryCardProps {
  timestamp: string;
  tags: string[];
  files?: string[];
  message: string;
  projectSlug: string;
  projectName?: string;
  showProject?: boolean;
  dimension?: string;
  onDelete?: () => void;
}

export default function EntryCard({
  timestamp,
  tags,
  files,
  message,
  projectSlug,
  projectName,
  showProject,
  dimension,
  onDelete,
}: EntryCardProps) {
  const [confirming, setConfirming] = useState(false);

  const date = new Date(timestamp);
  const timeStr = date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
  const dateStr = date.toLocaleDateString([], {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  async function handleDelete() {
    if (!confirming) {
      setConfirming(true);
      return;
    }

    const dimParam = dimension ? `&dimension=${encodeURIComponent(dimension)}` : "";
    await fetch(
      `/api/projects/${projectSlug}/entries?timestamp=${encodeURIComponent(timestamp)}${dimParam}`,
      { method: "DELETE" }
    );
    onDelete?.();
    setConfirming(false);
  }

  return (
    <div className="bg-white border border-border rounded-2xl p-5 group">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          {showProject && projectName && (
            <a
              href={`/project/${projectSlug}`}
              className="text-xs font-medium text-muted hover:text-foreground transition-colors"
            >
              {projectName}
            </a>
          )}
          <p className="text-sm text-foreground mt-1 whitespace-pre-wrap">
            {message}
          </p>
          {(tags.length > 0 || (files && files.length > 0)) && (
            <div className="flex flex-wrap gap-1.5 mt-3">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="text-[10px] uppercase tracking-wide bg-gray-100 text-muted px-2 py-0.5 rounded-full"
                >
                  {tag}
                </span>
              ))}
              {files && files.map((file) => (
                <span
                  key={file}
                  className="text-[10px] font-mono bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full"
                >
                  {file}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-col items-end shrink-0">
          <span className="text-xs text-muted">{dateStr}</span>
          <span className="text-xs text-muted">{timeStr}</span>
          {onDelete && (
            <button
              onClick={handleDelete}
              className={`mt-2 text-[10px] transition-opacity ${
                confirming
                  ? "text-red-500 opacity-100"
                  : "text-muted opacity-0 group-hover:opacity-100"
              }`}
            >
              {confirming ? "confirm?" : "delete"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
