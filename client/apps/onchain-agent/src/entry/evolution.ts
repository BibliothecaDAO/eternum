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

/** Compact snapshot of game state for evolution before/after comparison. */
export interface EvolutionSnapshot {
  structures: string;
  armies: string;
  toolErrors: string;
  timestamp: number;
}

function buildEvolutionPrompt(dataDir: string, before: EvolutionSnapshot | null, after: EvolutionSnapshot): string {
  const soulPath = join(dataDir, "soul.md");
  const soul = existsSync(soulPath) ? loadSoul(soulPath) : "(no soul defined)";
  const taskLists = loadTaskLists(join(dataDir, "tasks"));

  let prompt = `You are the evolution engine for a game-playing agent in Eternum (an on-chain strategy game).
Compare the BEFORE and AFTER game state to see what changed, then suggest improvements.

## Current Soul
${soul}

## Current Task Lists
`;

  for (const [domain, content] of taskLists) {
    prompt += `### ${domain}\n${content}\n\n`;
  }

  if (before) {
    prompt += `## BEFORE (${new Date(before.timestamp).toISOString()})
Structures:
${before.structures}
Armies:
${before.armies}
Tool errors since last evolution:
${before.toolErrors || "None"}

## AFTER (${new Date(after.timestamp).toISOString()})
Structures:
${after.structures}
Armies:
${after.armies}
Tool errors since last evolution:
${after.toolErrors || "None"}

`;
  } else {
    prompt += `## Current State (first evolution — no "before" snapshot)
Structures:
${after.structures}
Armies:
${after.armies}

`;
  }

  prompt += `## Instructions

Compare BEFORE and AFTER. What changed? Did the agent:
- Gain or lose structures/villages?
- Gain or lose armies/troops?
- Make repeated tool errors?
- Grow or shrink economically?

Based on what ACTUALLY happened, suggest improvements. Focus on:
- Concrete tactical adjustments (e.g. "don't attack below 2x ratio")
- Resource priorities (e.g. "save essence for T2 buildings")
- Positioning advice (e.g. "keep armies near owned structures")

Keep suggestions SHORT and CONCRETE. Each file should be under 50 lines.
The agent has these tools: inspect_tile, move_army, attack_target, create_army,
reinforce_army, defend_structure, transfer_resources, open_chest, view_map.

Each suggestion must have:
- target: "soul" | "task_list"
- domain: (required for task_list) one of: combat, economy, exploration, priorities
- action: "update"
- content: the FULL new content (replaces the file entirely)
- reasoning: one sentence explaining what changed and why this helps

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
let previousSnapshot: EvolutionSnapshot | null = null;

export async function evolve(
  model: Model<any>,
  dataDir: string,
  currentSnapshot: EvolutionSnapshot,
): Promise<EvolutionResult> {
  const prompt = buildEvolutionPrompt(dataDir, previousSnapshot, currentSnapshot);

  // Save current as "before" for next cycle
  const snapshotForNext = { ...currentSnapshot };


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

  // Save current snapshot as "before" for next evolution cycle
  previousSnapshot = snapshotForNext;

  return result;
}
