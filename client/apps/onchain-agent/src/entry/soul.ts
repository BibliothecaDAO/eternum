import { existsSync, readFileSync, readdirSync } from "node:fs";
import { basename, join } from "node:path";

export function stripFrontmatter(content: string): string {
  const normalized = content.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const match = normalized.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (match) return match[2].trimStart();
  return normalized;
}

export function loadSoul(soulPath: string): string {
  return stripFrontmatter(readFileSync(soulPath, "utf-8"));
}

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
