import { appendFile, mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import type { AgentTool } from "@mariozechner/pi-agent-core";
import { Type } from "typebox";

import { clipList, textResult } from "./result";

const NOTES_FILE = path.join("memory", "notes.md");
const RECALL_LIMIT = 20;

const RememberParams = Type.Object({
  note: Type.String({ minLength: 1, description: "One learning or intention worth keeping across turns." }),
});

const RecallParams = Type.Object({
  keyword: Type.Optional(Type.String({ description: "Only notes containing this word; omit for the latest notes." })),
});

/** Notes are an append-only, timestamped markdown file under the data dir: readable by the owner, replayable by me. */
export const createMemoryTools = (
  dataDir: string,
): [AgentTool<typeof RememberParams>, AgentTool<typeof RecallParams>] => {
  const notesPath = path.join(dataDir, NOTES_FILE);
  return [
    {
      name: "remember",
      label: "Remember",
      description: "Append a note to my persistent memory.",
      parameters: RememberParams,
      execute: async (_id, params) => {
        await appendNote(notesPath, params.note);
        return textResult("Noted.", { notesPath });
      },
    },
    {
      name: "recall",
      label: "Recall",
      description: "Read my persistent notes, newest first, optionally filtered by keyword.",
      parameters: RecallParams,
      execute: async (_id, params) => {
        const notes = await readNotes(notesPath, params.keyword);
        const text = notes.length === 0 ? "No notes yet." : clipList(notes, RECALL_LIMIT).join("\n");
        return textResult(text, { count: notes.length });
      },
    },
  ];
};

const appendNote = async (notesPath: string, note: string): Promise<void> => {
  await mkdir(path.dirname(notesPath), { recursive: true });
  await appendFile(notesPath, `- ${new Date().toISOString()} ${note.replace(/\r?\n/g, " ")}\n`);
};

const readNotes = async (notesPath: string, keyword: string | undefined): Promise<string[]> => {
  const lines = (await readFile(notesPath, "utf8").catch(() => "")).split("\n").filter((line) => line.startsWith("- "));
  const needle = keyword?.toLowerCase();
  return lines.filter((line) => !needle || line.toLowerCase().includes(needle)).reverse();
};
