# sample-notes-mcp-server

A tiny [Model Context Protocol](https://modelcontextprotocol.io) (MCP) server for saving, listing, searching, and deleting text notes — over stdio.

It knows nothing about any particular client. It just speaks MCP over stdio, so **any** MCP client (Claude Desktop, Claude Code, or your own) can use it. Notes persist as a JSON file on disk.

## Install

No install required — run it straight from npm with `npx`:

```bash
npx sample-notes-mcp-server
```

Or install it globally:

```bash
npm install -g sample-notes-mcp-server
sample-notes-mcp-server
```

## Usage

```bash
sample-notes-mcp-server [notes-file]
```

- `notes-file` (optional) — path to the JSON file where notes are stored. Defaults to `./notes.json` in the current working directory. The file is created on first write.

The server communicates over **stdio**: stdout is reserved for the MCP protocol, so all human-facing logging goes to stderr. You normally don't run it by hand — an MCP client launches it for you (see below).

## Tools

| Tool | Arguments | Description |
| --- | --- | --- |
| `add_note` | `text: string` | Save a short text note. Returns the new note's id. |
| `list_notes` | _(none)_ | List all saved notes. |
| `search_notes` | `query: string` | Find notes containing `query` (case-insensitive substring match). |
| `delete_note` | `id: number` | Delete a saved note by its id. |

Each note is stored as `{ id, text, createdAt }`, where `id` auto-increments and `createdAt` is an ISO 8601 timestamp.

## MCP client configuration

Add the server to your MCP client's config. Most clients use a JSON block like this:

```json
{
  "mcpServers": {
    "notes": {
      "command": "npx",
      "args": ["-y", "sample-notes-mcp-server", "/absolute/path/to/notes.json"]
    }
  }
}
```

The trailing path argument is optional — omit it to use `./notes.json` relative to the client's working directory. Using an absolute path is recommended so your notes land in a predictable place.

### Claude Desktop

Add the block above to `claude_desktop_config.json`:

- **macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

Then restart Claude Desktop.

### Claude Code

```bash
claude mcp add notes -- npx -y sample-notes-mcp-server /absolute/path/to/notes.json
```

## Development

```bash
npm install      # install dependencies
npm run build    # compile TypeScript to dist/
npm run start    # run the built server
npm run smoke-test  # spawn the built server via a real MCP stdio client and exercise every tool
```

The build uses a two-config split: `tsconfig.json` drives the editor and typecheck (and covers the smoke test), while `tsconfig.build.json` excludes the smoke test so it never ships in `dist/`.

## License

MIT — see [LICENSE](LICENSE).
