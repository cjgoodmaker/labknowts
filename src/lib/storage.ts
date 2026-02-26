import fs from "fs";
import path from "path";

const DATA_DIR = process.env.LABKNOWTS_DATA_DIR
  || path.join(process.cwd(), "data", "projects");

// --- Types ---

export interface Dimension {
  slug: string;
  name: string;
  forkedFrom: { dimension: string; timestamp: string } | null;
  createdAt: string;
}

export interface ProjectMeta {
  name: string;
  slug: string;
  description: string;
  repoPath: string;
  createdAt: string;
  dimensions?: Dimension[];
}

export interface Entry {
  timestamp: string;
  tags: string[];
  files: string[];
  message: string;
}

// --- Helpers ---

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function projectDir(slug: string): string {
  return path.join(DATA_DIR, slug);
}

function metaPath(slug: string): string {
  return path.join(projectDir(slug), "meta.json");
}

function logPathForDimension(projectSlug: string, dimension: string): string {
  if (dimension === "main") {
    return path.join(projectDir(projectSlug), "log.md");
  }
  return path.join(projectDir(projectSlug), `log--${dimension}.md`);
}

function logPath(slug: string): string {
  return logPathForDimension(slug, "main");
}

// --- Projects ---

export function listProjects(): ProjectMeta[] {
  ensureDataDir();
  const dirs = fs.readdirSync(DATA_DIR, { withFileTypes: true });
  const projects: ProjectMeta[] = [];

  for (const dir of dirs) {
    if (!dir.isDirectory()) continue;
    const mp = path.join(DATA_DIR, dir.name, "meta.json");
    if (!fs.existsSync(mp)) continue;
    try {
      const meta = JSON.parse(fs.readFileSync(mp, "utf-8"));
      projects.push(meta);
    } catch {
      // skip malformed
    }
  }

  return projects.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

export function getProject(slug: string): ProjectMeta | null {
  const mp = metaPath(slug);
  if (!fs.existsSync(mp)) return null;
  try {
    return JSON.parse(fs.readFileSync(mp, "utf-8"));
  } catch {
    return null;
  }
}

export function createProject(
  name: string,
  description?: string,
  repoPath?: string
): ProjectMeta {
  ensureDataDir();
  const slug = slugify(name);
  const dir = projectDir(slug);

  if (fs.existsSync(dir)) {
    const existing = getProject(slug);
    if (existing) return existing;
  }

  fs.mkdirSync(dir, { recursive: true });

  const meta: ProjectMeta = {
    name,
    slug,
    description: description || "",
    repoPath: repoPath || "",
    createdAt: new Date().toISOString(),
  };

  fs.writeFileSync(metaPath(slug), JSON.stringify(meta, null, 2));
  fs.writeFileSync(logPath(slug), "");

  return meta;
}

export function updateProject(
  slug: string,
  updates: Partial<Pick<ProjectMeta, "name" | "description" | "repoPath">>
): ProjectMeta | null {
  const meta = getProject(slug);
  if (!meta) return null;

  const updated = { ...meta, ...updates };
  fs.writeFileSync(metaPath(slug), JSON.stringify(updated, null, 2));
  return updated;
}

export function findProjectByRepoPath(repoPath: string): ProjectMeta | null {
  const projects = listProjects();
  const normalized = repoPath.replace(/\/+$/, "");
  return (
    projects.find((p) => p.repoPath.replace(/\/+$/, "") === normalized) || null
  );
}

// --- Dimensions ---

export function listDimensions(projectSlug: string): Dimension[] {
  const meta = getProject(projectSlug);
  if (!meta) return [];

  if (meta.dimensions && meta.dimensions.length > 0) {
    return meta.dimensions;
  }

  // Backward compatible: no dimensions field means just "main"
  return [{ slug: "main", name: "Main", forkedFrom: null, createdAt: meta.createdAt }];
}

export function createDimension(
  projectSlug: string,
  name: string,
  fromDimension: string = "main",
  fromTimestamp?: string
): Dimension {
  const meta = getProject(projectSlug);
  if (!meta) throw new Error(`Project "${projectSlug}" not found`);

  const slug = slugify(name);
  const dimensions = listDimensions(projectSlug);

  // Check if already exists
  if (dimensions.find((d) => d.slug === slug)) {
    throw new Error(`Dimension "${slug}" already exists`);
  }

  // Get entries from the source dimension up to the fork point
  const sourceEntries = getEntries(projectSlug, undefined, fromDimension);
  // sourceEntries are newest-first, we need chronological order for writing
  const chronological = [...sourceEntries].reverse();

  let entriesToCopy = chronological;
  if (fromTimestamp) {
    const cutoffTime = new Date(fromTimestamp).getTime();
    entriesToCopy = chronological.filter(
      (e) => new Date(e.timestamp).getTime() <= cutoffTime
    );
  }

  // Write the new dimension's log file
  const lp = logPathForDimension(projectSlug, slug);
  const content = entriesToCopy
    .map((e) => formatEntry(e))
    .join("");
  fs.writeFileSync(lp, content);

  // Update meta.json
  const dim: Dimension = {
    slug,
    name,
    forkedFrom: {
      dimension: fromDimension,
      timestamp: fromTimestamp || (chronological.length > 0
        ? chronological[chronological.length - 1].timestamp
        : new Date().toISOString()),
    },
    createdAt: new Date().toISOString(),
  };

  const updatedDimensions = [...dimensions, dim];
  const updatedMeta = { ...meta, dimensions: updatedDimensions };
  fs.writeFileSync(metaPath(projectSlug), JSON.stringify(updatedMeta, null, 2));

  return dim;
}

export function deleteDimension(projectSlug: string, dimensionSlug: string): boolean {
  if (dimensionSlug === "main") throw new Error("Cannot delete the main dimension");

  const meta = getProject(projectSlug);
  if (!meta) return false;

  const dimensions = listDimensions(projectSlug);
  if (!dimensions.find((d) => d.slug === dimensionSlug)) return false;

  // Collect all descendants (forks of this fork, recursively)
  const toDelete = new Set<string>([dimensionSlug]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const dim of dimensions) {
      if (dim.forkedFrom && toDelete.has(dim.forkedFrom.dimension) && !toDelete.has(dim.slug)) {
        toDelete.add(dim.slug);
        changed = true;
      }
    }
  }

  // Delete log files
  for (const slug of toDelete) {
    const lp = logPathForDimension(projectSlug, slug);
    if (fs.existsSync(lp)) fs.unlinkSync(lp);
  }

  // Update meta.json
  const remaining = dimensions.filter((d) => !toDelete.has(d.slug));
  const updatedMeta = { ...meta, dimensions: remaining };
  fs.writeFileSync(metaPath(projectSlug), JSON.stringify(updatedMeta, null, 2));

  return true;
}

// --- Entries ---

function formatEntry(e: Entry): string {
  const tagStr = e.tags.length > 0 ? ` | ${e.tags.join(", ")}` : "";
  const filesStr = e.files.length > 0 ? `\nfiles: ${e.files.join(", ")}` : "";
  return `---\n${e.timestamp}${tagStr}${filesStr}\n${e.message}\n`;
}

export function parseEntries(raw: string): Entry[] {
  if (!raw.trim()) return [];

  const blocks = raw.split("---").filter((b) => b.trim());
  const entries: Entry[] = [];

  for (const block of blocks) {
    const lines = block.trim().split("\n");
    if (lines.length < 2) continue;

    const headerLine = lines[0];
    const pipeIndex = headerLine.indexOf("|");

    let timestamp: string;
    let tags: string[] = [];

    if (pipeIndex !== -1) {
      timestamp = headerLine.slice(0, pipeIndex).trim();
      tags = headerLine
        .slice(pipeIndex + 1)
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
    } else {
      timestamp = headerLine.trim();
    }

    // Check for files: line
    let files: string[] = [];
    let messageStartIndex = 1;

    if (lines.length > 1 && lines[1].startsWith("files:")) {
      files = lines[1]
        .slice(6) // remove "files:"
        .split(",")
        .map((f) => f.trim())
        .filter(Boolean);
      messageStartIndex = 2;
    }

    const message = lines.slice(messageStartIndex).join("\n").trim();
    entries.push({ timestamp, tags, files, message });
  }

  return entries;
}

export function getEntries(
  slug: string,
  limit?: number,
  dimension: string = "main"
): Entry[] {
  const lp = logPathForDimension(slug, dimension);
  if (!fs.existsSync(lp)) return [];

  const raw = fs.readFileSync(lp, "utf-8");
  const entries = parseEntries(raw);

  // Newest first
  entries.reverse();

  if (limit && limit > 0) {
    return entries.slice(0, limit);
  }
  return entries;
}

export function addEntry(
  slug: string,
  message: string,
  tags?: string[],
  files?: string[],
  dimension: string = "main"
): Entry {
  const dir = projectDir(slug);
  if (!fs.existsSync(dir)) {
    throw new Error(`Project "${slug}" not found`);
  }

  const entry: Entry = {
    timestamp: new Date().toISOString(),
    tags: tags || [],
    files: files || [],
    message,
  };

  const lp = logPathForDimension(slug, dimension);
  // Create the file if it doesn't exist (e.g. new dimension)
  if (!fs.existsSync(lp)) {
    fs.writeFileSync(lp, "");
  }
  fs.appendFileSync(lp, formatEntry(entry));

  return entry;
}

export function deleteEntry(
  slug: string,
  timestamp: string,
  dimension: string = "main"
): boolean {
  const lp = logPathForDimension(slug, dimension);
  if (!fs.existsSync(lp)) return false;

  const raw = fs.readFileSync(lp, "utf-8");
  const entries = parseEntries(raw);
  const filtered = entries.filter((e) => e.timestamp !== timestamp);

  if (filtered.length === entries.length) return false;

  const content = filtered.map((e) => formatEntry(e)).join("");
  fs.writeFileSync(lp, content);
  return true;
}

// --- Search ---

export function searchEntries(
  query: string
): Array<Entry & { project: ProjectMeta; dimension: string }> {
  const projects = listProjects();
  const results: Array<Entry & { project: ProjectMeta; dimension: string }> = [];
  const q = query.toLowerCase();

  for (const project of projects) {
    const dimensions = listDimensions(project.slug);
    for (const dim of dimensions) {
      const entries = getEntries(project.slug, undefined, dim.slug);
      for (const entry of entries) {
        if (
          entry.message.toLowerCase().includes(q) ||
          entry.tags.some((t) => t.toLowerCase().includes(q)) ||
          entry.files.some((f) => f.toLowerCase().includes(q)) ||
          project.name.toLowerCase().includes(q)
        ) {
          results.push({ ...entry, project, dimension: dim.slug });
        }
      }
    }
  }

  // Deduplicate entries that appear in multiple dimensions (same timestamp + message)
  const seen = new Set<string>();
  const deduped = results.filter((r) => {
    const key = `${r.project.slug}:${r.timestamp}:${r.message}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return deduped.sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
}

// --- Helper for MCP ---

export function resolveProject(
  projectName?: string,
  repoPath?: string
): ProjectMeta {
  if (projectName) {
    const slug = slugify(projectName);
    const existing = getProject(slug);
    if (existing) return existing;
    return createProject(projectName);
  }

  if (repoPath) {
    const existing = findProjectByRepoPath(repoPath);
    if (existing) return existing;

    const name = path.basename(repoPath);
    return createProject(name, "", repoPath);
  }

  throw new Error("Either project name or repo_path must be provided");
}
