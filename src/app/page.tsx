"use client";

import { useEffect, useState } from "react";
import SearchBar from "@/components/SearchBar";
import EntryCard from "@/components/EntryCard";

interface ProjectWithActivity {
  name: string;
  slug: string;
  description: string;
  createdAt: string;
  entryCount: number;
  lastEntry: { timestamp: string; tags: string[]; files: string[]; message: string } | null;
}

export default function Dashboard() {
  const [projects, setProjects] = useState<ProjectWithActivity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/projects")
      .then((r) => r.json())
      .then((data) => {
        setProjects(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  // Collect all recent entries across projects
  const recentEntries = projects
    .filter((p) => p.lastEntry)
    .map((p) => ({
      ...p.lastEntry!,
      projectName: p.name,
      projectSlug: p.slug,
    }))
    .sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

  return (
    <div className="gradient-hero min-h-screen">
      <div className="max-w-2xl mx-auto px-6 py-16 md:py-24">
        {/* Hero */}
        <div className="text-center mb-16">
          <h1 className="text-5xl md:text-6xl font-bold tracking-tight mb-4">
            LabKnowts
          </h1>
          <p className="text-muted text-lg max-w-md mx-auto leading-relaxed">
            Your centralized lab notebook. Track every project, every session,
            every insight — all in one place.
          </p>
        </div>

        {/* Search */}
        <div className="mb-12">
          <SearchBar />
        </div>

        {/* How it works */}
        {projects.length === 0 && !loading && (
          <div className="mb-16">
            <p className="text-[10px] uppercase tracking-widest text-muted mb-4 font-medium">
              How it works
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                {
                  n: 1,
                  title: "Connect",
                  desc: "Add the MCP server to your Claude Code settings. Works across all projects.",
                },
                {
                  n: 2,
                  title: "Log",
                  desc: "Claude automatically logs what it did at the end of each session.",
                },
                {
                  n: 3,
                  title: "Track",
                  desc: "Browse, search, and edit your notes from this dashboard.",
                },
              ].map((step) => (
                <div
                  key={step.n}
                  className="bg-white border border-border rounded-2xl p-5"
                >
                  <div className="bg-black text-white w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold mb-3">
                    {step.n}
                  </div>
                  <h3 className="font-semibold text-sm mb-1">{step.title}</h3>
                  <p className="text-xs text-muted leading-relaxed">
                    {step.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Projects */}
        {projects.length > 0 && (
          <div className="mb-12">
            <p className="text-[10px] uppercase tracking-widest text-muted mb-4 font-medium">
              Your projects
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {projects.map((p) => (
                <a
                  key={p.slug}
                  href={`/project/${p.slug}`}
                  className="bg-white border border-border rounded-2xl p-5 hover:border-gray-300 transition-colors block"
                >
                  <h3 className="font-semibold text-sm">{p.name}</h3>
                  {p.description && (
                    <p className="text-xs text-muted mt-1 line-clamp-2">
                      {p.description}
                    </p>
                  )}
                  <div className="flex items-center gap-3 mt-3">
                    <span className="text-[10px] text-muted">
                      {p.entryCount} {p.entryCount === 1 ? "entry" : "entries"}
                    </span>
                    {p.lastEntry && (
                      <span className="text-[10px] text-muted">
                        Last:{" "}
                        {new Date(p.lastEntry.timestamp).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </a>
              ))}
            </div>
          </div>
        )}

        {/* Recent activity */}
        {recentEntries.length > 0 && (
          <div>
            <p className="text-[10px] uppercase tracking-widest text-muted mb-4 font-medium">
              Recent activity
            </p>
            <div className="space-y-3">
              {recentEntries.slice(0, 10).map((entry) => (
                <EntryCard
                  key={`${entry.projectSlug}-${entry.timestamp}`}
                  timestamp={entry.timestamp}
                  tags={entry.tags}
                  files={entry.files}
                  message={entry.message}
                  projectSlug={entry.projectSlug}
                  projectName={entry.projectName}
                  showProject
                />
              ))}
            </div>
          </div>
        )}

        {loading && (
          <p className="text-center text-sm text-muted py-12">Loading...</p>
        )}
      </div>
    </div>
  );
}
