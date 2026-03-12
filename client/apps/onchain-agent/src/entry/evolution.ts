/**
 * Evolution engine: asks a language model to analyze the agent's current soul
 * and task lists, then writes the suggested improvements to disk.
 */

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { Model } from "@mariozechner/pi-ai";
import { completeSimple } from "@mariozechner/pi-ai";
import { loadSoul, loadTaskLists } from "./soul.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * A single improvement proposed by the evolution model.
 *
 * @property target    - Artifact to modify: the agent's soul, a named task list,
 *                       or a named skill.
 * @property domain    - Required when `target` is `"task_list"` or `"skill"`;
 *                       identifies the file by domain name. Suggestions missing
 *                       this field for those targets are silently skipped.
 * @property action    - Whether to overwrite an existing file (`"update"`) or
 *                       create a new one (`"create"`).
 * @property content   - Full replacement content for the target file.
 * @property reasoning - Human-readable explanation of why the change helps.
 */
interface EvolutionSuggestion {
  target: "soul" | "task_list" | "skill";
  domain?: string;
  action: "update" | "create";
  content: string;
  reasoning: string;
}

/**
 * Structured output of a single evolution cycle.
 *
 * @property suggestions - Concrete file changes to apply (may be empty).
 * @property analysis    - Free-form analysis text preceding the suggestions.
 */
interface EvolutionResult {
  suggestions: EvolutionSuggestion[];
  analysis: string;
}

// ---------------------------------------------------------------------------
// Build prompt
// ---------------------------------------------------------------------------

function buildEvolutionPrompt(dataDir: string): string {
  const soulPath = join(dataDir, "soul.md");
  const soul = existsSync(soulPath) ? loadSoul(soulPath) : "(no soul defined)";
  const taskLists = loadTaskLists(join(dataDir, "tasks"));

  let prompt = `You are the evolution engine for a game-playing agent. Analyze its performance and suggest improvements.

## Current Soul
${soul}

## Current Task Lists
`;

  for (const [domain, content] of taskLists) {
    prompt += `### ${domain}\n${content}\n\n`;
  }

  prompt += `## Instructions

Analyze the agent's performance based on its decisions and current configuration.
Suggest improvements as a JSON array of suggestions.

Each suggestion must have:
- target: "soul" | "task_list" | "skill"
- domain: (optional) domain name for task_list targets
- action: "update" | "create"
- content: the new/updated content
- reasoning: why this change would help

Respond with:
1. A brief analysis section
2. A JSON code block with the suggestions array

\`\`\`json
[
  {
    "target": "soul",
    "action": "update",
    "content": "updated soul content...",
    "reasoning": "why this change..."
  }
]
\`\`\``;

  return prompt;
}

// ---------------------------------------------------------------------------
// Parse result
// ---------------------------------------------------------------------------

function parseEvolutionResult(response: string): EvolutionResult {
  const jsonMatch = response.match(/```(?:json)?\s*\n([\s\S]*?)\n```/);
  let suggestions: EvolutionSuggestion[] = [];

  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[1]);
      if (Array.isArray(parsed)) {
        suggestions = parsed
          .filter(
            (s) => s && typeof s.target === "string" && typeof s.action === "string" && typeof s.content === "string",
          )
          .map((s) => ({
            target: s.target,
            domain: s.domain,
            action: s.action,
            content: s.content,
            reasoning: s.reasoning ?? "",
          }));
      }
    } catch {
      // Failed to parse JSON — suggestions stays empty
    }
  }

  const analysisEnd = response.indexOf("```");
  const analysis = analysisEnd > 0 ? response.slice(0, analysisEnd).trim() : response.trim();

  return { suggestions, analysis };
}

// ---------------------------------------------------------------------------
// Apply suggestions to disk
// ---------------------------------------------------------------------------

function applyEvolution(suggestions: EvolutionSuggestion[], dataDir: string): string[] {
  const appliedFiles: string[] = [];

  for (const suggestion of suggestions) {
    let filePath: string;

    switch (suggestion.target) {
      case "soul":
        filePath = join(dataDir, "soul.md");
        break;
      case "task_list":
        if (!suggestion.domain) continue;
        filePath = join(dataDir, "tasks", `${suggestion.domain}.md`);
        break;
      case "skill":
        if (!suggestion.domain) continue;
        filePath = join(dataDir, "skills", suggestion.domain, "SKILL.md");
        break;
      default:
        continue;
    }

    mkdirSync(dirname(filePath), { recursive: true });
    writeFileSync(filePath, suggestion.content);
    appliedFiles.push(filePath);
  }

  return appliedFiles;
}

// ---------------------------------------------------------------------------
// Public: run a full evolution cycle
// ---------------------------------------------------------------------------

/**
 * Run a full evolution cycle: build a prompt from the current soul and task
 * lists, ask `model` for improvement suggestions, write accepted suggestions
 * to disk, and return the structured result.
 *
 * @param model   - Language model used to generate suggestions.
 * @param dataDir - Root path of the agent's world data directory.
 * @returns The parsed {@link EvolutionResult} with the analysis text and all
 *          validated suggestions (a subset may have been written to disk).
 */
export async function evolve(model: Model<any>, dataDir: string): Promise<EvolutionResult> {
  const prompt = buildEvolutionPrompt(dataDir);

  const response = await completeSimple(model, {
    systemPrompt:
      "You are analyzing a game-playing AI agent's strategy. " +
      "Suggest concrete, specific improvements. Be surgical — only change what needs changing.",
    messages: [{ role: "user" as const, content: prompt, timestamp: Date.now() }],
  });

  const text = response.content.find((b): b is { type: "text"; text: string } => b.type === "text");
  if (!text) return { suggestions: [], analysis: "No response from model." };

  const result = parseEvolutionResult(text.text);

  if (result.suggestions.length > 0) {
    const applied = applyEvolution(result.suggestions, dataDir);
    console.log(`Evolution: applied ${applied.length} changes`);
    for (const f of applied) console.log(`  → ${f}`);
  } else {
    console.log("Evolution: no changes suggested");
  }

  return result;
}
