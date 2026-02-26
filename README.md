# LabKnowts

A centralized lab notebook for AI research projects. Track every project, every session, every insight — all in one place.

Next.js web app + MCP server + markdown storage.

## Features

- **Timeline entries** — timestamped logs with tags and file links
- **Dimensions** — fork your timeline to track parallel experiments, then navigate between them with inline breadcrumbs
- **MCP server** — Claude logs entries, creates forks, and searches your notes directly from conversation
- **Markdown storage** — everything is plain text in `data/`, easy to read, grep, and back up
- **Search** — full-text search across all projects and dimensions

## Setup

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to use the web UI.

## Adding to Claude Desktop

The MCP server lets Claude read and write to your notebook during conversations.

### Option 1: Install the `.mcpb` bundle (recommended)

1. Build the bundle:

   ```bash
   npm run pack
   ```

2. Open Claude Desktop and drag `labknowts.mcpb` onto the window (or double-click it)
3. When prompted, set the **LabKnowts Directory** to wherever you cloned this repo (e.g. `~/Developer/labknowts`)
4. Restart Claude Desktop

### Option 2: Manual config

Add this to your Claude Desktop config file:

- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "labknowts": {
      "command": "node",
      "args": ["<path-to-labknowts>/dist/mcp-server.cjs"],
      "env": {
        "LABKNOWTS_DATA_DIR": "<path-to-labknowts>/data/projects"
      }
    }
  }
}
```

Then build the server and restart Claude Desktop:

```bash
npm run bundle:mcp
```

### MCP tools available to Claude

| Tool | Description |
|------|-------------|
| `labknowts_log` | Log a timestamped entry (with optional tags, files, dimension) |
| `labknowts_read` | Read recent entries from a project |
| `labknowts_list` | List all tracked projects |
| `labknowts_search` | Search across all project notes |
| `labknowts_init` | Create or register a new project |
| `labknowts_fork` | Fork a dimension (create a parallel timeline) |
| `labknowts_dimensions` | List all dimensions in a project |
| `labknowts_delete_dimension` | Delete a dimension and its descendants |

## How it works

Each project is a folder in `data/projects/`:

```
data/projects/my-project/
  ├── meta.json          # name, description, dimensions
  ├── log.md             # main timeline
  ├── log--experiment.md  # "experiment" dimension
  └── log--v2.md          # "v2" dimension
```

Entries are plain markdown blocks:

```
---
2026-02-26T14:05:00.000Z | setup, ui
files: src/components/Upload.tsx, src/lib/api.ts
Built image upload component with drag-and-drop support.
```

## License

MIT
