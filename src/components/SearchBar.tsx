"use client";

import { useState, useCallback } from "react";
import EntryCard from "./EntryCard";

interface SearchResult {
  timestamp: string;
  tags: string[];
  files: string[];
  message: string;
  project: {
    name: string;
    slug: string;
  };
}

export default function SearchBar() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[] | null>(null);
  const [searching, setSearching] = useState(false);

  const search = useCallback(async (q: string) => {
    if (!q.trim()) {
      setResults(null);
      return;
    }

    setSearching(true);
    const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
    const data = await res.json();
    setResults(data);
    setSearching(false);
  }, []);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      search(query);
    }
  }

  return (
    <div>
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            if (!e.target.value.trim()) setResults(null);
          }}
          onKeyDown={handleKeyDown}
          placeholder="Search all notes..."
          className="w-full bg-white border border-border rounded-2xl px-5 py-3 text-sm outline-none focus:border-gray-300 transition-colors"
        />
        {searching && (
          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-muted">
            ...
          </span>
        )}
      </div>

      {results !== null && (
        <div className="mt-4 space-y-3">
          {results.length === 0 ? (
            <p className="text-sm text-muted text-center py-8">
              No results for &ldquo;{query}&rdquo;
            </p>
          ) : (
            results.map((r) => (
              <EntryCard
                key={`${r.project.slug}-${r.timestamp}`}
                timestamp={r.timestamp}
                tags={r.tags}
                files={r.files}
                message={r.message}
                projectSlug={r.project.slug}
                projectName={r.project.name}
                showProject
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}
