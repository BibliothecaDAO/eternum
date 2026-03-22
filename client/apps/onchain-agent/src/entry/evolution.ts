/**
 * Evolution engine — asks a language model to compare before/after game state
 * snapshots, analyze the agent's performance, and write concrete soul and
 * task-list improvements to disk.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { Model } from "@mariozechner/pi-ai";
import { completeSimple } from "@mariozechner/pi-ai";
import { loadTaskLists } from "./soul.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A single improvement proposed by the evolution model. */
interface EvolutionSuggestion {
  /** Artifact to modify: the agent's soul, a named task list, or a named skill. */
  target: "soul" | "task_list" | "skill";
  /** Required for `"task_list"` and `"skill"` targets; identifies the file by domain name. Silently skipped if missing. */
  domain?: string;
  /** Whether to overwrite an existing file (`"update"`) or create a new one (`"create"`). */
  action: "update" | "create";
  /** Full replacement content for the target file. */
  content: string;
  /** One-sentence explanation of why the change helps. */
  reasoning: string;
}

/** Structured output of a single evolution cycle. */
interface EvolutionResult {
  /** Concrete file changes to apply (may be empty if the model finds nothing to improve). */
  suggestions: EvolutionSuggestion[];
  /** Free-form analysis text the model generated before producing suggestions. */
  analysis: string;
}

// ---------------------------------------------------------------------------
// Build prompt
// ---------------------------------------------------------------------------

export interface EvolutionSnapshot {
  /** Structured briefing from map protocol. */
  briefing: object;
  /** Unix timestamp in milliseconds. */
  timestamp: number;
}

function buildEvolutionPrompt(dataDir: string, briefing: object): string {
  const memoryPath = join(dataDir, "memory.md");
  const memory = existsSync(memoryPath) ? readFileSync(memoryPath, "utf-8").trim() : "(no memory yet)";
  const taskLists = loadTaskLists(join(dataDir, "tasks"));

  let prompt = `You are the evolution engine for an autonomous Eternum agent.

## Agent's Memory (what the agent experienced and learned)
${memory}

## Current Strategy
`;

  for (const [domain, content] of taskLists) {
    prompt += `### ${domain}\n${content}\n\n`;
  }

  prompt += `## Current Game State
${JSON.stringify(briefing, null, 2)}

## Instructions

Given what the agent experienced and learned, update the strategy files if you see improvements.

Focus on:
- Concrete tactical adjustments (e.g. "don't attack below 2x strength ratio")
- Resource priorities (e.g. "save essence for realm upgrades before expanding")
- Positioning advice (e.g. "keep armies within 3 hexes of owned structures")

Keep suggestions SHORT and CONCRETE. Each file should be under 50 lines.
Only change what needs changing. Do NOT modify soul.md.

Each suggestion must have:
- target: "task_list" (only — soul is not modifiable)
- domain: one of: combat, economy, exploration, priorities, reflection
- action: "update"
- content: the FULL new content (replaces the file entirely)
- reasoning: one sentence explaining what changed and why

\`\`\`json
[
  {
    "target": "task_list",
    "domain": "combat",
    "action": "update",
    "content": "- Only attack when strength ratio > 2x\\n- Retreat if ratio < 0.5x",
    "reasoning": "Lost 3 armies attacking at bad ratios."
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
        continue; // soul.md is operator-owned, never auto-modified
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
 * Run a full evolution cycle.
 *
 * Builds a prompt from the current soul, task lists, and before/after game
 * state snapshots, asks `model` for improvement suggestions, writes accepted
 * suggestions to disk, and returns the structured result.
 *
 * @param model - Language model used to generate suggestions.
 * @param dataDir - Root path of the agent's world data directory.
 * @param currentSnapshot - Current game state snapshot (becomes the "after"
 *   in the comparison; the previous call's snapshot is reused as "before").
 * @returns Parsed {@link EvolutionResult} with analysis and validated suggestions.
 */
export async function evolve(
  model: Model<any>,
  dataDir: string,
  briefing: object,
): Promise<EvolutionResult> {
  const prompt = buildEvolutionPrompt(dataDir, briefing);

  const response = await completeSimple(model, {
    systemPrompt:
      "You are analyzing a game-playing AI agent's strategy. " +
      "Suggest concrete, specific improvements to task files only. Do not modify soul.md.",
    messages: [{ role: "user" as const, content: prompt, timestamp: Date.now() }],
  });

  const text = response.content.find((b): b is { type: "text"; text: string } => b.type === "text");
  if (!text) return { suggestions: [], analysis: "No response from model." };

  const result = parseEvolutionResult(text.text);

  if (result.suggestions.length > 0) {
    const applied = applyEvolution(result.suggestions, dataDir);
    console.error(`Evolution: applied ${applied.length} changes`);
    for (const f of applied) console.error(`  → ${f}`);
  } else {
    console.error("Evolution: no changes suggested");
  }

  return result;
}
