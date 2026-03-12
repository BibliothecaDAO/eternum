/**
 * Utilities for loading the agent's soul and task lists from the data directory
 * and assembling them into a system prompt.
 */

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { basename, join } from "node:path";

function stripFrontmatter(content: string): string {
  const normalized = content.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const match = normalized.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (match) return match[2].trimStart();
  return normalized;
}

/**
 * Read a soul Markdown file and strip its YAML frontmatter.
 *
 * @param soulPath - Path to the `soul.md` file.
 * @returns The soul content as a plain string, without frontmatter.
 * @throws If the file cannot be read (missing or permission error).
 */
export function loadSoul(soulPath: string): string {
  return stripFrontmatter(readFileSync(soulPath, "utf-8"));
}

/**
 * Load all auto-loadable task-list Markdown files from a directory.
 *
 * Skips files with `autoload: false` in their YAML frontmatter. Returns files
 * keyed by base name (without the `.md` extension), sorted alphabetically.
 *
 * @param taskListDir - Path to the directory containing task-list `.md` files.
 * @returns A map from domain name to task-list content (frontmatter stripped).
 *          Returns an empty map if the directory does not exist.
 */
export function loadTaskLists(taskListDir: string): Map<string, string> {
  if (!existsSync(taskListDir)) return new Map();
  const files = readdirSync(taskListDir)
    .filter((f) => f.endsWith(".md"))
    .sort();
  const result = new Map<string, string>();
  for (const file of files) {
    const raw = readFileSync(join(taskListDir, file), "utf-8");
    if (/^---\n[\s\S]*?autoload:\s*false[\s\S]*?\n---/m.test(raw)) continue;
    result.set(basename(file, ".md"), stripFrontmatter(raw));
  }
  return result;
}

/**
 * Build the full system prompt by combining the soul definition and all
 * auto-loaded task lists found in `dataDir`.
 *
 * Falls back to a minimal default soul if `soul.md` is absent. Appends task
 * lists as an XML `<task_lists>` block with one `<domain>` element per file.
 *
 * @param dataDir - Root path of the agent's world data directory.
 * @returns The assembled system prompt string.
 */
export function buildSystemPrompt(dataDir: string): string {
  const soulPath = join(dataDir, "soul.md");
  const soul = existsSync(soulPath)
    ? loadSoul(soulPath)
    : "You are an autonomous Eternum agent. Win by capturing hyperstructures.";

  const taskLists = loadTaskLists(join(dataDir, "tasks"));

  const sections: string[] = [soul];
  if (taskLists.size > 0) {
    let xml = "\n\n<task_lists>\n";
    for (const [domain, content] of taskLists) {
      xml += `<domain name="${domain}">\n${content}\n</domain>\n`;
    }
    xml += "</task_lists>";
    sections.push(xml);
  }

  return sections.join("");
}
