#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

// sample-notes-mcp-server
// A standalone MCP *server* exposing a tiny "notes" toolset. It knows nothing
// about any particular client — it just speaks MCP over stdio, so ANY MCP
// client can use it. Notes persist as JSON on disk.
//
//   Usage:  sample-notes-mcp-server [notes-file]
//           (defaults to ./notes.json in the current working directory)
//
// IMPORTANT: stdout is reserved for the MCP protocol on this transport, so we
// never write to it. All human-facing logging goes to stderr (console.error).

// First CLI argument is the notes-file path; fall back to ./notes.json.
const NOTES_FILE = resolve(process.argv[2] ?? "./notes.json");

interface Note {
  id: number;
  text: string;
  createdAt: string;
}

async function loadNotes(): Promise<Note[]> {
  try {
    return JSON.parse(await readFile(NOTES_FILE, "utf8")) as Note[];
  } catch {
    return []; // file doesn't exist yet → no notes
  }
}

async function saveNotes(notes: Note[]): Promise<void> {
  await writeFile(NOTES_FILE, JSON.stringify(notes, null, 2), "utf8");
}

const server = new McpServer({ name: "sample-notes-mcp-server", version: "0.1.0" });

// Each registerTool call publishes one tool: a name, a description (the client's
// model reads this to decide when to call it), an optional Zod input schema, and
// the handler that runs on the server.
server.registerTool(
  "add_note",
  {
    description: "Save a short text note for later. Returns the new note's id.",
    inputSchema: { text: z.string().describe("The note text to save.") },
  },
  async ({ text }) => {
    const notes = await loadNotes();
    const note: Note = {
      id: (notes.at(-1)?.id ?? 0) + 1,
      text,
      createdAt: new Date().toISOString(),
    };
    notes.push(note);
    await saveNotes(notes);
    return { content: [{ type: "text", text: `Saved note #${note.id}.` }] };
  },
);

server.registerTool(
  "list_notes",
  { description: "List all saved notes." },
  async () => {
    const notes = await loadNotes();
    const text = notes.length
      ? notes.map((n) => `#${n.id} (${n.createdAt}): ${n.text}`).join("\n")
      : "No notes yet.";
    return { content: [{ type: "text", text }] };
  },
);

server.registerTool(
  "search_notes",
  {
    description: "Find saved notes containing the given text (case-insensitive).",
    inputSchema: { query: z.string().describe("Substring to search for.") },
  },
  async ({ query }) => {
    const notes = await loadNotes();
    const matches = notes.filter((n) =>
      n.text.toLowerCase().includes(query.toLowerCase()),
    );
    const text = matches.length
      ? matches.map((n) => `#${n.id}: ${n.text}`).join("\n")
      : `No notes matching "${query}".`;
    return { content: [{ type: "text", text }] };
  },
);

server.registerTool(
  "delete_note",
  {
    description: "Delete a saved note by its id.",
    inputSchema: { id: z.number().int().describe("The id of the note to delete.") },
  },
  async ({ id }) => {
    const notes = await loadNotes();
    const remaining = notes.filter((n) => n.id !== id);
    if (remaining.length === notes.length) {
      return { content: [{ type: "text", text: `No note with id #${id}.` }] };
    }
    await saveNotes(remaining);
    return { content: [{ type: "text", text: `Deleted note #${id}.` }] };
  },
);

// Connect over stdio and run until the client disconnects (stdin closes).
const transport = new StdioServerTransport();
await server.connect(transport);
console.error(`sample-notes-mcp-server ready (notes file: ${NOTES_FILE})`);
