import { Server } from "@modelcontextprotocol/sdk/server";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import {
  resolveProject,
  getEntries,
  addEntry,
  listProjects,
  searchEntries,
  createProject,
  listDimensions,
  createDimension,
  deleteDimension,
} from "../src/lib/storage.js";

const server = new Server(
  { name: "labknowts", version: "0.2.0" },
  { capabilities: { tools: {} } }
);

const TOOLS = [
  {
    name: "labknowts_log",
    description:
      "Log a timestamped entry to the LabKnowts notebook. Auto-maps repo_path to the correct project (or creates one). Use this to record what you did in a session.",
    inputSchema: {
      type: "object" as const,
      properties: {
        message: {
          type: "string",
          description: "Short description of what was done (1-3 sentences)",
        },
        project: {
          type: "string",
          description: "Project name (if known). Will be auto-created if needed.",
        },
        repo_path: {
          type: "string",
          description: "Absolute path to the repo/project directory. Used to auto-map to a project.",
        },
        tags: {
          type: "string",
          description: "Comma-separated tags (e.g. 'bugfix, fhir, refactor')",
        },
        files: {
          type: "string",
          description: "Comma-separated file paths that were changed (e.g. 'src/index.ts, lib/api.ts')",
        },
        dimension: {
          type: "string",
          description: "Dimension (timeline fork) to log to. Defaults to 'main'.",
        },
      },
      required: ["message"],
    },
  },
  {
    name: "labknowts_read",
    description: "Read recent entries from a project in the LabKnowts notebook.",
    inputSchema: {
      type: "object" as const,
      properties: {
        project: { type: "string", description: "Project name or slug" },
        limit: { type: "number", description: "Max entries to return (default 20)" },
        dimension: { type: "string", description: "Dimension to read from. Defaults to 'main'." },
      },
      required: ["project"],
    },
  },
  {
    name: "labknowts_list",
    description: "List all projects tracked in the LabKnowts notebook.",
    inputSchema: { type: "object" as const, properties: {} },
  },
  {
    name: "labknowts_search",
    description: "Search across all project notes in the LabKnowts notebook. Searches messages, tags, files, and project names.",
    inputSchema: {
      type: "object" as const,
      properties: {
        query: { type: "string", description: "Search query" },
      },
      required: ["query"],
    },
  },
  {
    name: "labknowts_init",
    description: "Create or register a new project in the LabKnowts notebook.",
    inputSchema: {
      type: "object" as const,
      properties: {
        name: { type: "string", description: "Project name" },
        description: { type: "string", description: "Short project description" },
        repo_path: { type: "string", description: "Absolute path to the repo directory" },
      },
      required: ["name"],
    },
  },
  {
    name: "labknowts_fork",
    description: "Create a new dimension (timeline fork) in a project. Copies entries up to the fork point into the new dimension.",
    inputSchema: {
      type: "object" as const,
      properties: {
        project: { type: "string", description: "Project name or slug" },
        dimension_name: { type: "string", description: "Name for the new dimension (e.g. 'Experiment Mamba Model')" },
        from_dimension: { type: "string", description: "Dimension to fork from. Defaults to 'main'." },
        from_timestamp: { type: "string", description: "Fork from this timestamp. Defaults to latest entry." },
      },
      required: ["project", "dimension_name"],
    },
  },
  {
    name: "labknowts_dimensions",
    description: "List all dimensions (timeline forks) for a project.",
    inputSchema: {
      type: "object" as const,
      properties: {
        project: { type: "string", description: "Project name or slug" },
      },
      required: ["project"],
    },
  },
  {
    name: "labknowts_delete_dimension",
    description: "Delete a dimension (timeline fork) from a project. Also deletes any child dimensions forked from it. Cannot delete 'main'.",
    inputSchema: {
      type: "object" as const,
      properties: {
        project: { type: "string", description: "Project name or slug" },
        dimension: { type: "string", description: "Dimension slug to delete" },
      },
      required: ["project", "dimension"],
    },
  },
];

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: TOOLS,
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case "labknowts_log": {
        const { message, project, repo_path, tags, files, dimension } = args as {
          message: string;
          project?: string;
          repo_path?: string;
          tags?: string;
          files?: string;
          dimension?: string;
        };
        const resolved = resolveProject(project, repo_path);
        const tagList = tags ? tags.split(",").map((t) => t.trim()).filter(Boolean) : [];
        const fileList = files ? files.split(",").map((f) => f.trim()).filter(Boolean) : [];
        const entry = addEntry(resolved.slug, message, tagList, fileList, dimension || "main");
        const dim = dimension && dimension !== "main" ? ` (${dimension})` : "";
        return {
          content: [{
            type: "text" as const,
            text: `Logged to "${resolved.name}"${dim} at ${entry.timestamp}${tagList.length ? ` [${tagList.join(", ")}]` : ""}`,
          }],
        };
      }

      case "labknowts_read": {
        const { project, limit, dimension } = args as {
          project: string;
          limit?: number;
          dimension?: string;
        };
        const resolved = resolveProject(project);
        const entries = getEntries(resolved.slug, limit || 20, dimension || "main");
        const dim = dimension && dimension !== "main" ? ` (${dimension})` : "";

        if (entries.length === 0) {
          return {
            content: [{ type: "text" as const, text: `No entries found for "${resolved.name}"${dim}.` }],
          };
        }

        const text = entries
          .map((e) => {
            const tagStr = e.tags.length ? ` [${e.tags.join(", ")}]` : "";
            const fileStr = e.files.length ? `\n  files: ${e.files.join(", ")}` : "";
            return `${e.timestamp}${tagStr}${fileStr}\n${e.message}`;
          })
          .join("\n\n");

        return {
          content: [{ type: "text" as const, text: `## ${resolved.name}${dim} — Recent Entries\n\n${text}` }],
        };
      }

      case "labknowts_list": {
        const projects = listProjects();

        if (projects.length === 0) {
          return {
            content: [{ type: "text" as const, text: "No projects yet. Use labknowts_log or labknowts_init to create one." }],
          };
        }

        const text = projects
          .map((p) => {
            const dims = listDimensions(p.slug);
            const dimStr = dims.length > 1 ? ` (${dims.length} dimensions)` : "";
            return `- **${p.name}** (${p.slug})${p.description ? `: ${p.description}` : ""}${dimStr}${p.repoPath ? ` — ${p.repoPath}` : ""}`;
          })
          .join("\n");

        return {
          content: [{ type: "text" as const, text: `## Projects\n\n${text}` }],
        };
      }

      case "labknowts_search": {
        const { query } = args as { query: string };
        const results = searchEntries(query);

        if (results.length === 0) {
          return {
            content: [{ type: "text" as const, text: `No results found for "${query}".` }],
          };
        }

        const text = results
          .slice(0, 20)
          .map((r) => {
            const tagStr = r.tags.length ? ` [${r.tags.join(", ")}]` : "";
            const dimStr = r.dimension !== "main" ? ` (${r.dimension})` : "";
            return `**${r.project.name}**${dimStr} — ${r.timestamp}${tagStr}\n${r.message}`;
          })
          .join("\n\n");

        return {
          content: [{ type: "text" as const, text: `## Search: "${query}" (${results.length} results)\n\n${text}` }],
        };
      }

      case "labknowts_init": {
        const { name: projName, description, repo_path } = args as {
          name: string;
          description?: string;
          repo_path?: string;
        };
        const project = createProject(projName, description, repo_path);
        return {
          content: [{
            type: "text" as const,
            text: `Project "${project.name}" (${project.slug}) created.${repo_path ? ` Mapped to ${repo_path}` : ""}`,
          }],
        };
      }

      case "labknowts_fork": {
        const { project, dimension_name, from_dimension, from_timestamp } = args as {
          project: string;
          dimension_name: string;
          from_dimension?: string;
          from_timestamp?: string;
        };
        const resolved = resolveProject(project);
        const dim = createDimension(resolved.slug, dimension_name, from_dimension || "main", from_timestamp);
        return {
          content: [{
            type: "text" as const,
            text: `Dimension "${dim.name}" (${dim.slug}) created in "${resolved.name}", forked from ${dim.forkedFrom?.dimension || "main"}.`,
          }],
        };
      }

      case "labknowts_dimensions": {
        const { project } = args as { project: string };
        const resolved = resolveProject(project);
        const dims = listDimensions(resolved.slug);

        const text = dims
          .map((d) => {
            const fork = d.forkedFrom
              ? ` (forked from ${d.forkedFrom.dimension} at ${d.forkedFrom.timestamp})`
              : "";
            return `- **${d.name}** (${d.slug})${fork}`;
          })
          .join("\n");

        return {
          content: [{ type: "text" as const, text: `## ${resolved.name} — Dimensions\n\n${text}` }],
        };
      }

      case "labknowts_delete_dimension": {
        const { project, dimension } = args as { project: string; dimension: string };
        const resolved = resolveProject(project);
        const deleted = deleteDimension(resolved.slug, dimension);
        if (!deleted) {
          return {
            content: [{ type: "text" as const, text: `Dimension "${dimension}" not found in "${resolved.name}".` }],
            isError: true,
          };
        }
        return {
          content: [{ type: "text" as const, text: `Dimension "${dimension}" deleted from "${resolved.name}".` }],
        };
      }

      default:
        return {
          content: [{ type: "text" as const, text: `Unknown tool: ${name}` }],
          isError: true,
        };
    }
  } catch (err) {
    return {
      content: [{
        type: "text" as const,
        text: `Error: ${err instanceof Error ? err.message : String(err)}`,
      }],
      isError: true,
    };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error("LabKnowts MCP server error:", error);
  process.exit(1);
});
