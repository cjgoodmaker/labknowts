"use client";

import { Fragment, useEffect, useState, useCallback } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import EntryCard from "@/components/EntryCard";
import NewEntry from "@/components/NewEntry";

interface Dimension {
  slug: string;
  name: string;
  forkedFrom: { dimension: string; timestamp: string } | null;
  createdAt: string;
}

interface ProjectDetail {
  name: string;
  slug: string;
  description: string;
  repoPath: string;
  createdAt: string;
  dimensions: Dimension[];
  entries: Array<{
    timestamp: string;
    tags: string[];
    files: string[];
    message: string;
  }>;
}

interface ForkPoint {
  id: string;
  timestamp: string;
  parentSlug: string;
  dims: Dimension[];
}

type TimelineItem =
  | { type: "date"; date: string }
  | { type: "entry"; entry: ProjectDetail["entries"][number]; index: number; shared: boolean }
  | { type: "fork"; fork: ForkPoint };

export default function ProjectPage() {
  const { slug } = useParams<{ slug: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();

  const activeDim = searchParams.get("dim") || "main";

  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingDesc, setEditingDesc] = useState(false);
  const [desc, setDesc] = useState("");
  const [forking, setForking] = useState(false);
  const [forkName, setForkName] = useState("");
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const loadProject = useCallback(async () => {
    const res = await fetch(`/api/projects/${slug}?dimension=${encodeURIComponent(activeDim)}`);
    if (res.ok) {
      const data = await res.json();
      setProject(data);
      setDesc(data.description);
    }
    setLoading(false);
    window.dispatchEvent(new Event("labknowts:refresh"));
  }, [slug, activeDim]);

  useEffect(() => {
    loadProject();
  }, [loadProject]);

  // Scroll to fork point if URL has hash
  useEffect(() => {
    if (typeof window !== "undefined" && window.location.hash) {
      const el = document.getElementById(window.location.hash.slice(1));
      if (el) {
        setTimeout(() => el.scrollIntoView({ behavior: "smooth", block: "center" }), 200);
      }
    }
  }, [project]);

  function switchDimension(dim: string) {
    if (dim === "main") {
      router.push(`/project/${slug}`);
    } else {
      router.push(`/project/${slug}?dim=${encodeURIComponent(dim)}`);
    }
  }

  async function saveDescription() {
    await fetch(`/api/projects/${slug}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ description: desc }),
    });
    setEditingDesc(false);
    loadProject();
  }

  async function handleFork() {
    if (!forkName.trim()) return;

    await fetch(`/api/projects/${slug}/dimensions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: forkName.trim(),
        fromDimension: activeDim,
      }),
    });

    const newSlug = forkName.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    setForkName("");
    setForking(false);
    window.dispatchEvent(new Event("labknowts:refresh"));
    router.push(`/project/${slug}?dim=${encodeURIComponent(newSlug)}`);
  }

  async function handleDeleteDimension() {
    if (!confirmingDelete) {
      setConfirmingDelete(true);
      return;
    }

    await fetch(
      `/api/projects/${slug}/dimensions?dimension=${encodeURIComponent(activeDim)}`,
      { method: "DELETE" }
    );
    setConfirmingDelete(false);
    window.dispatchEvent(new Event("labknowts:refresh"));
    router.push(`/project/${slug}`);
  }

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-16">
        <p className="text-sm text-muted text-center">Loading...</p>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-16">
        <p className="text-sm text-muted text-center">Project not found.</p>
      </div>
    );
  }

  const dimensions = project.dimensions || [
    { slug: "main", name: "Main", forkedFrom: null, createdAt: project.createdAt },
  ];

  // --- Build ancestry chain: walk from active dimension up to root ---
  const ancestryChain: Dimension[] = [];
  {
    let current = dimensions.find((d) => d.slug === activeDim);
    while (current) {
      ancestryChain.unshift(current);
      if (current.forkedFrom) {
        current = dimensions.find((d) => d.slug === current!.forkedFrom!.dimension);
      } else {
        break;
      }
    }
  }
  const ancestrySlugs = new Set(ancestryChain.map((d) => d.slug));

  // --- Compute fork points ---
  // Group all non-main dimensions by their fork origin (parent + timestamp)
  const forkGroups = new Map<string, { parentSlug: string; children: Dimension[] }>();
  for (const dim of dimensions) {
    if (!dim.forkedFrom) continue;
    const key = `${dim.forkedFrom.dimension}::${dim.forkedFrom.timestamp}`;
    if (!forkGroups.has(key)) {
      forkGroups.set(key, { parentSlug: dim.forkedFrom.dimension, children: [] });
    }
    forkGroups.get(key)!.children.push(dim);
  }

  // Show fork points where:
  // - The active dimension is the parent (forks FROM current dimension)
  // - Any child is in the ancestry chain (ancestor fork points)
  const forkPoints: ForkPoint[] = [];
  for (const [key, group] of forkGroups) {
    const isRelevant =
      group.parentSlug === activeDim ||
      group.children.some((d) => ancestrySlugs.has(d.slug));
    if (!isRelevant) continue;

    const timestamp = key.split("::").slice(1).join("::");
    const parentDim = dimensions.find((d) => d.slug === group.parentSlug) || {
      slug: group.parentSlug,
      name: group.parentSlug,
      forkedFrom: null,
      createdAt: "",
    };

    forkPoints.push({
      id: `fork-${timestamp.replace(/[:.]/g, "-")}`,
      timestamp,
      parentSlug: group.parentSlug,
      dims: [parentDim, ...group.children],
    });
  }

  // At each fork point, determine which pill to highlight.
  // Highlight the dimension "downstream" toward the active dimension —
  // that's the child in the ancestry chain, or activeDim itself.
  function highlightedAtFork(fork: ForkPoint): string {
    if (fork.dims.some((d) => d.slug === activeDim)) return activeDim;
    for (const dim of fork.dims) {
      if (dim.slug !== fork.parentSlug && ancestrySlugs.has(dim.slug)) return dim.slug;
    }
    return fork.parentSlug;
  }

  // --- Build flat timeline with inline fork dividers ---
  // Entries at or before the active dimension's fork point are "shared" (inherited)
  const activeDimObj = dimensions.find((d) => d.slug === activeDim);
  const forkTs = activeDimObj?.forkedFrom?.timestamp;
  const forkTime = forkTs ? new Date(forkTs).getTime() : null;

  const timelineItems: TimelineItem[] = [];
  let currentDate = "";

  for (let i = 0; i < project.entries.length; i++) {
    const entry = project.entries[i];
    const shared = forkTime !== null && new Date(entry.timestamp).getTime() <= forkTime;
    const dateKey = new Date(entry.timestamp).toLocaleDateString([], {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    });

    // Fork divider goes above the entry at the fork timestamp
    // (multiple fork points could share a timestamp — show all)
    const forksHere = forkPoints.filter((fp) => fp.timestamp === entry.timestamp);
    for (const fork of forksHere) {
      timelineItems.push({ type: "fork", fork });
    }

    if (dateKey !== currentDate) {
      timelineItems.push({ type: "date", date: dateKey });
      currentDate = dateKey;
    }

    timelineItems.push({ type: "entry", entry, index: i, shared });
  }

  return (
    <div className="max-w-2xl mx-auto px-6 py-16 md:py-24">
      {/* Header */}
      <div className="mb-10">
        <h1 className="text-4xl font-bold tracking-tight">{project.name}</h1>

        {editingDesc ? (
          <div className="mt-3 flex items-center gap-2">
            <input
              type="text"
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && saveDescription()}
              className="flex-1 text-sm text-muted bg-white border border-border rounded-lg px-3 py-2 outline-none"
              autoFocus
            />
            <button
              onClick={saveDescription}
              className="text-xs bg-black text-white px-4 py-2 rounded-full"
            >
              Save
            </button>
            <button
              onClick={() => {
                setEditingDesc(false);
                setDesc(project.description);
              }}
              className="text-xs text-muted"
            >
              Cancel
            </button>
          </div>
        ) : (
          <p
            onClick={() => setEditingDesc(true)}
            className="text-muted mt-2 text-sm cursor-pointer hover:text-foreground transition-colors"
          >
            {project.description || "Add a description..."}
          </p>
        )}

        {project.repoPath && (
          <p className="text-[10px] text-muted mt-2 font-mono">
            {project.repoPath}
          </p>
        )}
      </div>

      {/* Fork / delete actions */}
      <div className="mb-6 flex items-center justify-end gap-3">
        {forking ? (
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={forkName}
              onChange={(e) => setForkName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleFork()}
              placeholder="Dimension name..."
              className="text-xs bg-white border border-border rounded-full px-4 py-1.5 outline-none w-48"
              autoFocus
            />
            <button
              onClick={handleFork}
              disabled={!forkName.trim()}
              className="text-xs bg-black text-white px-3 py-1.5 rounded-full disabled:opacity-30"
            >
              Fork
            </button>
            <button
              onClick={() => { setForking(false); setForkName(""); }}
              className="text-xs text-muted"
            >
              Cancel
            </button>
          </div>
        ) : (
          <>
            <button
              onClick={() => setForking(true)}
              className="text-[10px] text-muted hover:text-foreground transition-colors"
            >
              + Fork dimension
            </button>
            {activeDim !== "main" && (
              <button
                onClick={handleDeleteDimension}
                onBlur={() => setConfirmingDelete(false)}
                className={`text-[10px] transition-colors ${
                  confirmingDelete
                    ? "text-red-500"
                    : "text-muted hover:text-red-400"
                }`}
              >
                {confirmingDelete ? "Confirm delete?" : "Delete dimension"}
              </button>
            )}
          </>
        )}
      </div>

      {/* Timeline */}
      <div>
        <p className="text-[10px] uppercase tracking-widest text-muted mb-4 font-medium">
          Timeline
        </p>

        {project.entries.length === 0 ? (
          <p className="text-sm text-muted text-center py-12">
            No entries yet. Add one below or let Claude log from the MCP server.
          </p>
        ) : (
          <div className="space-y-3">
            {timelineItems.map((item, idx) => {
              if (item.type === "date") {
                return (
                  <p
                    key={`date-${item.date}`}
                    className={`text-xs font-medium text-muted ${idx > 0 ? "pt-5" : ""} pb-1`}
                  >
                    {item.date}
                  </p>
                );
              }

              if (item.type === "fork") {
                const highlighted = highlightedAtFork(item.fork);
                // Build full breadcrumb: ancestry chain + alternatives at this fork level
                const parentIdx = ancestryChain.findIndex((d) => d.slug === item.fork.parentSlug);
                const prefix = ancestryChain.slice(0, parentIdx + 1); // root → parent
                const forkChildren = item.fork.dims.filter((d) => d.slug !== item.fork.parentSlug);
                const suffix = ancestryChain.slice(parentIdx + 2); // everything after the chosen child

                return (
                  <div
                    key={item.fork.id}
                    id={item.fork.id}
                    className="relative py-4"
                  >
                    {/* Horizontal fork line */}
                    <div className="absolute inset-x-0 top-1/2 h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent" />

                    {/* Full ancestry breadcrumb with fork alternatives */}
                    <div className="relative flex items-center justify-center">
                      <div className="bg-[#fafaf8] px-4 flex items-center gap-1.5 flex-wrap justify-center">
                        {/* Prefix: root through parent */}
                        {prefix.map((dim, i) => (
                          <Fragment key={dim.slug}>
                            {i > 0 && (
                              <span className="text-gray-300 text-xs select-none">{"\u2192"}</span>
                            )}
                            <button
                              onClick={() => switchDimension(dim.slug)}
                              className={`text-xs transition-colors ${
                                dim.slug === highlighted
                                  ? "text-foreground font-semibold"
                                  : "text-muted hover:text-foreground"
                              }`}
                            >
                              {dim.name}
                            </button>
                          </Fragment>
                        ))}

                        {/* Arrow before fork choices */}
                        <span className="text-gray-300 text-xs select-none">{"\u2192"}</span>

                        {/* Fork choices: alternatives at this level */}
                        {forkChildren.map((dim, i) => (
                          <Fragment key={dim.slug}>
                            {i > 0 && (
                              <span className="text-gray-300 text-[10px] select-none">/</span>
                            )}
                            <button
                              onClick={() => switchDimension(dim.slug)}
                              className={`text-xs transition-colors ${
                                dim.slug === highlighted
                                  ? "text-foreground font-semibold"
                                  : "text-muted hover:text-foreground"
                              }`}
                            >
                              {dim.name}
                            </button>
                          </Fragment>
                        ))}

                        {/* Suffix: rest of ancestry after chosen child */}
                        {suffix.map((dim) => (
                          <Fragment key={dim.slug}>
                            <span className="text-gray-300 text-xs select-none">{"\u2192"}</span>
                            <button
                              onClick={() => switchDimension(dim.slug)}
                              className="text-xs text-muted hover:text-foreground transition-colors"
                            >
                              {dim.name}
                            </button>
                          </Fragment>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              }

              // entry
              return (
                <div
                  key={`${item.entry.timestamp}-${item.index}`}
                  className={item.shared ? "opacity-50" : ""}
                >
                  <EntryCard
                    timestamp={item.entry.timestamp}
                    tags={item.entry.tags}
                    files={item.entry.files}
                    message={item.entry.message}
                    projectSlug={project.slug}
                    dimension={activeDim}
                    onDelete={loadProject}
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Spacer for floating input */}
      <div className="h-28" />

      {/* Floating entry input */}
      <NewEntry
        projectSlug={project.slug}
        dimension={activeDim}
        dimensionLabel={ancestryChain.length > 1 ? ancestryChain.map((d) => d.name).join(" \u2192 ") : undefined}
        onAdded={loadProject}
      />
    </div>
  );
}
