/**
 * Embedded data files for standalone binary.
 *
 * Bun inlines these as string literals at bundle time via `with { type: "text" }`.
 * The compiled binary carries all data files internally — no companion files needed.
 * On first run, seedDataDir() writes them to the user's data directory.
 *
 * IMPORTANT: When adding or removing files in data/tasks/, you must update the
 * imports and the embeddedData map below. The vitest config handles this
 * dynamically, but the production build requires explicit imports.
 */

import soul from "../data/soul.md" with { type: "text" };
import heartbeat from "../data/HEARTBEAT.md" with { type: "text" };
import priorities from "../data/tasks/priorities.md" with { type: "text" };
import economy from "../data/tasks/economy.md" with { type: "text" };
import learnings from "../data/tasks/learnings.md" with { type: "text" };
import exploration from "../data/tasks/exploration.md" with { type: "text" };
import combat from "../data/tasks/combat.md" with { type: "text" };
import game from "../data/tasks/game.md" with { type: "text" };
import envExample from "../.env.example" with { type: "text" };

/** Map of relative paths → file contents for data directory seeding. */
export const embeddedData: Record<string, string> = {
  "soul.md": soul,
  "HEARTBEAT.md": heartbeat,
  "tasks/priorities.md": priorities,
  "tasks/economy.md": economy,
  "tasks/learnings.md": learnings,
  "tasks/exploration.md": exploration,
  "tasks/combat.md": combat,
  "tasks/game.md": game,
};

export const embeddedEnvExample: string = envExample;
