/**
 * Core logic for the update_memory tool.
 *
 * Appends a timestamped entry to the agent's memory file.
 * The agent calls this each tick to record intent and learnings.
 */

import { appendFileSync } from "node:fs";
import { join } from "node:path";

/** Input for the update_memory tool. */
export interface UpdateMemoryInput {
  /** Free-form text to append. The tool prepends a timestamp automatically. */
  content: string;
}

/** Result of an update_memory call. */
export interface UpdateMemoryResult {
  success: boolean;
  message: string;
}

/**
 * Append a timestamped entry to memory.md.
 *
 * @param input - The content to append.
 * @param dataDir - Path to the world data directory containing memory.md.
 * @returns Success result.
 */
export function updateMemory(input: UpdateMemoryInput, dataDir: string): UpdateMemoryResult {
  const timestamp = new Date().toISOString();
  const entry = `[${timestamp}] ${input.content}\n`;
  const memoryPath = join(dataDir, "memory.md");

  try {
    appendFileSync(memoryPath, entry);
    return { success: true, message: "Memory updated." };
  } catch (err: any) {
    return { success: false, message: `Failed to write memory: ${err.message}` };
  }
}
