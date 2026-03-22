/**
 * Bootstrap utilities — seed a world data directory with default agent files
 * on first run. Existing files are never overwritten, so operator edits
 * survive restarts.
 */

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

// ── Default templates ────────────────────────────────────────────────

const DEFAULT_SOUL = `\
You are an Axis agent autonomously playing Eternum, the onchain strategy game.
`;

const DEFAULT_TASKS: Record<string, string> = {
  priorities: `\
# Priorities

(No priorities yet. Observe the map and decide.)
`,

  combat: `\
# Combat

(No combat strategy yet.)
`,

  economy: `\
# Economy

(No economic strategy yet.)
`,

  exploration: `\
# Exploration

(No exploration strategy yet.)
`,

  reflection: `\
# Reflection

(No reflections yet.)
`,
};

// ── Bootstrap ────────────────────────────────────────────────────────

function writeIfMissing(path: string, content: string): void {
  if (!existsSync(path)) {
    writeFileSync(path, content);
  }
}

/**
 * Ensure a world data directory exists and is populated with default files.
 *
 * On first run, creates `<dataDir>/soul.md` and
 * `<dataDir>/tasks/{priorities,combat,economy,exploration,reflection}.md`
 * from built-in templates. Existing files are never overwritten, so operator
 * edits survive restarts.
 *
 * @param dataDir - Absolute path to the world's data directory (created
 *                  recursively if absent).
 */
export function bootstrapDataDir(dataDir: string): void {
  if (!existsSync(dataDir)) {
    mkdirSync(dataDir, { recursive: true });
  }

  const tasksDir = join(dataDir, "tasks");
  if (!existsSync(tasksDir)) {
    mkdirSync(tasksDir, { recursive: true });
  }

  writeIfMissing(join(dataDir, "soul.md"), DEFAULT_SOUL);

  for (const [name, content] of Object.entries(DEFAULT_TASKS)) {
    writeIfMissing(join(tasksDir, `${name}.md`), content);
  }
}
