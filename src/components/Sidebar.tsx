"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

interface Dimension {
  slug: string;
  name: string;
  forkedFrom: { dimension: string; timestamp: string } | null;
  createdAt: string;
}

interface DimNode {
  dim: Dimension;
  children: DimNode[];
}

interface Project {
  name: string;
  slug: string;
  lastEntry: { timestamp: string } | null;
  dimensions?: Dimension[];
}

function buildDimTree(dims: Dimension[]): DimNode[] {
  const byParent = new Map<string, Dimension[]>();
  for (const dim of dims) {
    if (!dim.forkedFrom) continue;
    const parent = dim.forkedFrom.dimension;
    if (!byParent.has(parent)) byParent.set(parent, []);
    byParent.get(parent)!.push(dim);
  }

  function buildNodes(parentSlug: string): DimNode[] {
    const children = byParent.get(parentSlug) || [];
    return children.map((dim) => ({
      dim,
      children: buildNodes(dim.slug),
    }));
  }

  return buildNodes("main");
}

function forkId(timestamp: string) {
  return `fork-${timestamp.replace(/[:.]/g, "-")}`;
}

export default function Sidebar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [projects, setProjects] = useState<Project[]>([]);
  const [open, setOpen] = useState(false);

  const activeDim = searchParams.get("dim") || "main";

  function loadProjects() {
    fetch("/api/projects")
      .then((r) => r.json())
      .then(setProjects)
      .catch(() => {});
  }

  useEffect(() => {
    loadProjects();
  }, [pathname]);

  // Refresh when project data changes (fork created/deleted, entry added, etc.)
  useEffect(() => {
    function onRefresh() { loadProjects(); }
    window.addEventListener("labknowts:refresh", onRefresh);
    return () => window.removeEventListener("labknowts:refresh", onRefresh);
  }, []);

  function renderDimNodes(nodes: DimNode[], projectSlug: string, depth: number) {
    return nodes.map((node) => (
      <div key={node.dim.slug}>
        <Link
          href={`/project/${projectSlug}?dim=${encodeURIComponent(node.dim.slug)}#${forkId(node.dim.forkedFrom!.timestamp)}`}
          onClick={() => setOpen(false)}
          className={`flex items-center gap-1 py-1 rounded text-xs transition-colors ${
            activeDim === node.dim.slug
              ? "text-foreground font-medium"
              : "text-muted hover:text-foreground"
          }`}
          style={{ paddingLeft: `${depth * 12 + 8}px` }}
        >
          <span className="text-muted opacity-50 text-[10px]">{"\u2514"}</span>
          {node.dim.name}
        </Link>
        {node.children.length > 0 && renderDimNodes(node.children, projectSlug, depth + 1)}
      </div>
    ));
  }

  return (
    <>
      {/* Mobile toggle */}
      <button
        onClick={() => setOpen(!open)}
        className="fixed top-4 left-4 z-50 md:hidden bg-black text-white rounded-full w-10 h-10 flex items-center justify-center"
      >
        {open ? "\u2715" : "\u2630"}
      </button>

      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 bg-white border-r border-border transform transition-transform md:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="p-6 h-full flex flex-col">
          <Link href="/" className="block mb-8" onClick={() => setOpen(false)}>
            <h1 className="text-xl font-bold tracking-tight">LabKnowts</h1>
            <p className="text-xs text-muted mt-1">Your lab notebook</p>
          </Link>

          <p className="text-[10px] uppercase tracking-widest text-muted mb-3 font-medium">
            Projects
          </p>

          <nav className="space-y-1">
            {projects.map((p) => {
              const isActive = pathname === `/project/${p.slug}`;
              const dims = p.dimensions || [];
              const tree = buildDimTree(dims);

              return (
                <div key={p.slug}>
                  <Link
                    href={`/project/${p.slug}`}
                    onClick={() => setOpen(false)}
                    className={`block px-3 py-2 rounded-lg text-sm transition-colors ${
                      isActive
                        ? "bg-black text-white"
                        : "text-foreground hover:bg-gray-100"
                    }`}
                  >
                    {p.name}
                  </Link>

                  {/* Dimension tree for active project */}
                  {isActive && tree.length > 0 && (
                    <div className="ml-3 mt-1 mb-2">
                      {renderDimNodes(tree, p.slug, 0)}
                    </div>
                  )}
                </div>
              );
            })}

            {projects.length === 0 && (
              <p className="text-sm text-muted px-3 py-2">
                No projects yet
              </p>
            )}
          </nav>

          <div className="mt-auto pt-8">
            <p className="text-[10px] text-muted/50 font-mono">
              v0.2.0 &middot; MIT License
            </p>
          </div>
        </div>
      </aside>

      {/* Overlay for mobile */}
      {open && (
        <div
          className="fixed inset-0 z-30 bg-black/20 md:hidden"
          onClick={() => setOpen(false)}
        />
      )}
    </>
  );
}
