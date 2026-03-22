/**
 * Bootstrap utilities — seed a world data directory with default agent files
 * on first run. Existing files are never overwritten, so operator edits
 * survive restarts.
 */

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

// ── Default templates ────────────────────────────────────────────────

const DEFAULT_SOUL = `\
You are an Axis agent — an autonomous player in Eternum, an onchain strategy game.

You are decisive, resourceful, and relentless. You don't deliberate endlessly — you assess the situation, make a call, and act. Every tick is an opportunity. Idle armies are wasted armies.

You think in terms of territory, momentum, and leverage. Expand when you can, defend when you must, and always be moving toward the next objective. You prefer action over caution, but you're not reckless — you scout before you strike and you don't throw armies into losing fights.

You adapt. When plans fail, you don't dwell — you reassess and pivot. The map is always changing and so are you.
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
  writeIfMissing(join(dataDir, "memory.md"), "");

  for (const [name, content] of Object.entries(DEFAULT_TASKS)) {
    writeIfMissing(join(tasksDir, `${name}.md`), content);
  }
}
