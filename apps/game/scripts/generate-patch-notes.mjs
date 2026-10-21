#!/usr/bin/env node
// The patch notes: one markdown file per release under content/patch-notes (its rules in that folder's AGENTS.md),
// checked and written as src/shell/generated/patch-notes.ts, so What's new and the docs read them as plain data. Run
// it from apps/game after editing a release; CI refuses a committed copy its files no longer render to.

import { promises as fs } from "node:fs";
import path from "node:path";
import process from "node:process";
import matter from "gray-matter";
import { marked } from "marked";
import * as Result from "effect/Result";
import * as Schema from "effect/Schema";
import * as SchemaIssue from "effect/SchemaIssue";

const rootDir = process.cwd();
const contentDir = path.join(rootDir, "content", "patch-notes");
const outputFile = path.join(rootDir, "src", "shell", "generated", "patch-notes.ts");
const iconMeanings = path.join(rootDir, "asset-sources", "facets", "semantic-map.json");

/** The folder's own instructions, which are not releases. */
const NOT_RELEASES = new Set(["AGENTS.md", "CLAUDE.md"]);
/** Each mode's heading, in the order a release lists them. */
const MODES = { "All modes": "all", Frontier: "frontier", Blitz: "blitz", Eternum: "eternum" };
/** Each kind's heading, in the order a mode lists them. */
const KINDS = { New: "new", Balance: "balance", Fixes: "fix" };
/** `{icon} **Name**: the line`, ending with `` `old → new` `` where a number moved. */
const CHANGE = /^\{([a-z0-9-]+)\} \*\*([^*]+)\*\*: (.+?)(?: `([^`→]+) → ([^`→]+)`)?$/;

const frontmatterSchema = Schema.Struct({
  title: Schema.Trim.check(Schema.isMinLength(1)),
  summary: Schema.Trim.check(Schema.isMinLength(1)),
});

/** A release's file is named for its day, `YYYY-MM-DD.md`, a real one. */
const releaseDay = (fileName) => {
  const day = fileName.replace(/\.md$/, "");
  const time = /^\d{4}-\d{2}-\d{2}$/.test(day) ? Date.parse(day) : Number.NaN;
  return !Number.isNaN(time) && new Date(time).toISOString().slice(0, 10) === day ? day : null;
};

async function generate() {
  const icons = new Set(Object.keys(JSON.parse(await fs.readFile(iconMeanings, "utf8"))));
  const files = (await fs.readdir(contentDir)).filter((file) => file.endsWith(".md") && !NOT_RELEASES.has(file));
  const notes = [];
  for (const fileName of files) {
    const source = await fs.readFile(path.join(contentDir, fileName), "utf8");
    notes.push(readRelease(fileName, source, icons));
  }
  notes.sort((left, right) => right.date.localeCompare(left.date));
  await fs.mkdir(path.dirname(outputFile), { recursive: true });
  await fs.writeFile(outputFile, renderModule(notes), "utf8");
  process.stdout.write(`Generated ${path.relative(rootDir, outputFile)} with ${notes.length} releases\n`);
}

/** One release's file as a note, or the first rule it breaks, named with its file. */
function readRelease(fileName, source, icons) {
  const where = path.join("content", "patch-notes", fileName);
  const date = releaseDay(fileName);
  if (date === null) throw new Error(`${where}: a release's file is named for its day, YYYY-MM-DD.md`);
  const { data, content } = matter(source);
  const front = decodeFrontmatter(where, data);
  const modes = readModes(where, content, icons);
  // What's new opens a release on its first changed section: a release with none has nothing to open.
  if (Object.values(modes).every((changes) => changes.length === 0))
    throw new Error(`${where}: a release names at least one change`);
  return { date, title: front.title, summary: front.summary, modes };
}

function decodeFrontmatter(where, data) {
  const parsed = Schema.decodeUnknownResult(frontmatterSchema, { errors: "all" })(data);
  if (Result.isSuccess(parsed)) return parsed.success;
  const issues = SchemaIssue.makeFormatterStandardSchemaV1()(parsed.failure.issue).issues;
  throw new Error(`${where}: ${issues.map((issue) => `${(issue.path ?? []).join(".")}: ${issue.message}`).join("; ")}`);
}

/** The body's modes, kinds and changes, each heading known and in its order, nothing else between them. */
function readModes(where, content, icons) {
  const modes = Object.fromEntries(Object.values(MODES).map((mode) => [mode, []]));
  let mode = null;
  let kind = null;
  for (const token of marked.lexer(content)) {
    if (token.type === "space") continue;
    if (token.type === "heading" && token.depth === 2) {
      mode = nextInOrder(where, MODES, token.text, mode, "mode");
      kind = null;
    } else if (token.type === "heading" && token.depth === 3 && mode !== null) {
      kind = nextInOrder(where, KINDS, token.text, kind, "kind");
    } else if (token.type === "list" && kind !== null) {
      for (const item of token.items) modes[mode].push(readChange(where, item.text, kind, icons));
    } else {
      throw new Error(`${where}: only ## modes, ### kinds and their list items belong here, not "${token.raw.trim()}"`);
    }
  }
  return modes;
}

/** The heading's key, if it is a known one that comes after the previous. */
function nextInOrder(where, known, heading, previous, what) {
  const order = Object.values(known);
  const key = known[heading];
  if (key === undefined)
    throw new Error(`${where}: unknown ${what} "${heading}"; one of ${Object.keys(known).join(", ")}`);
  if (previous !== null && order.indexOf(key) <= order.indexOf(previous))
    throw new Error(`${where}: ${what} "${heading}" is out of order; the order is ${Object.keys(known).join(", ")}`);
  return key;
}

function readChange(where, text, kind, icons) {
  const line = text.replace(/\s+/g, " ").trim();
  const match = line.match(CHANGE);
  if (!match) throw new Error(`${where}: a change reads "{icon} **Name**: the line", not "${line}"`);
  const [, icon, title, said, from, to] = match;
  if (!icons.has(icon)) throw new Error(`${where}: unknown icon "${icon}" in "${title}"`);
  return { kind, icon, title, line: said, ...(from !== undefined && { from: from.trim(), to: to.trim() }) };
}

function renderModule(notes) {
  return `// This file is auto-generated by scripts/generate-patch-notes.mjs.
// Do not edit manually.
import type { PatchNote } from "../news/patch-note";

export const patchNotes = ${JSON.stringify(notes, null, 2)} as const satisfies readonly PatchNote[];
`;
}

generate().catch((error) => {
  process.stderr.write(`Failed to generate patch notes: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
