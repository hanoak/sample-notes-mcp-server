// Smoke test — connects a real MCP client to the built server over stdio,
// lists its tools, and exercises add_note / list_notes / search_notes /
// delete_note against a throwaway notes file. Exits non-zero on any failure.
//
//   npm run build && npm run smoke-test
//
// This talks to dist/index.js (the published entry point), so run `npm run
// build` first.
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

function assert(condition: unknown, message: string): void {
  if (!condition) throw new Error(`Assertion failed: ${message}`);
}

// Pull the plain text out of a tool result's content array.
function textOf(result: { content: Array<{ type: string; text?: string }> }): string {
  return result.content
    .filter((c) => c.type === "text")
    .map((c) => c.text ?? "")
    .join("\n");
}

const workDir = mkdtempSync(join(tmpdir(), "notes-smoke-"));
const notesFile = join(workDir, "notes.json");

const transport = new StdioClientTransport({
  command: process.execPath, // the current node binary
  args: ["dist/index.js", notesFile],
});
const client = new Client({ name: "smoke-test", version: "0.0.0" });

try {
  await client.connect(transport);

  // 1. listTools — all four tools should be advertised.
  const { tools } = await client.listTools();
  const names = tools.map((t) => t.name).sort();
  console.error("Tools:", names.join(", "));
  for (const expected of ["add_note", "delete_note", "list_notes", "search_notes"]) {
    assert(names.includes(expected), `tool ${expected} is advertised`);
  }

  // 2. add_note — save two notes.
  const add1 = await client.callTool({
    name: "add_note",
    arguments: { text: "Buy oat milk" },
  });
  assert(textOf(add1 as never).includes("#1"), "first note gets id #1");

  const add2 = await client.callTool({
    name: "add_note",
    arguments: { text: "Read the MCP spec" },
  });
  assert(textOf(add2 as never).includes("#2"), "second note gets id #2");

  // 3. list_notes — both notes present.
  const list = await client.callTool({ name: "list_notes", arguments: {} });
  const listText = textOf(list as never);
  assert(listText.includes("Buy oat milk"), "list contains first note");
  assert(listText.includes("Read the MCP spec"), "list contains second note");

  // 4. search_notes — case-insensitive substring match.
  const search = await client.callTool({
    name: "search_notes",
    arguments: { query: "MCP" },
  });
  const searchText = textOf(search as never);
  assert(searchText.includes("Read the MCP spec"), "search finds the matching note");
  assert(!searchText.includes("Buy oat milk"), "search excludes non-matching note");

  const searchLower = await client.callTool({
    name: "search_notes",
    arguments: { query: "oat" },
  });
  assert(
    textOf(searchLower as never).includes("Buy oat milk"),
    "search is case-insensitive",
  );

  // 5. delete_note — remove note #1, confirm it's gone and #2 remains.
  const del = await client.callTool({
    name: "delete_note",
    arguments: { id: 1 },
  });
  assert(textOf(del as never).includes("Deleted note #1"), "delete reports success");

  const listAfter = await client.callTool({ name: "list_notes", arguments: {} });
  const afterText = textOf(listAfter as never);
  assert(!afterText.includes("Buy oat milk"), "deleted note is gone");
  assert(afterText.includes("Read the MCP spec"), "surviving note remains");

  // Deleting a missing id is handled gracefully.
  const delMissing = await client.callTool({
    name: "delete_note",
    arguments: { id: 999 },
  });
  assert(
    textOf(delMissing as never).includes("No note with id #999"),
    "deleting a missing id is reported, not crashed",
  );

  console.error("\n✓ All smoke-test assertions passed.");
} finally {
  await client.close();
  rmSync(workDir, { recursive: true, force: true });
}
