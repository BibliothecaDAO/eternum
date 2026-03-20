/**
 * Evolution engine — asks a language model to compare before/after game state
 * snapshots, analyze the agent's performance, and write concrete soul and
 * task-list improvements to disk.
 */

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { Model } from "@mariozechner/pi-ai";
import { completeSimple } from "@mariozechner/pi-ai";
import { loadSoul, loadTaskLists } from "./soul.js";

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

/** Compact snapshot of game state used for before/after comparison in an evolution cycle. */
export interface EvolutionSnapshot {
  /** ASCII map text from the current {@link MapSnapshot}. */
  map: string;
  /** Multi-line summary of owned structures (name, level, build progress, resources). */
  structures: string;
  /** Multi-line summary of owned armies (entity ID, troop count, type, tier). */
  armies: string;
  /** Newline-separated tool error strings accumulated since the last evolution. */
  toolErrors: string;
  /** Recent agent messages (last ~30) for the model to review actions taken. */
  recentMessages?: any[];
  /** Unix timestamp in milliseconds when the snapshot was captured. */
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
Map:
${before.map}
Structures:
${before.structures}
Armies:
${before.armies}
Tool errors since last evolution:
${before.toolErrors || "None"}

## AFTER (${new Date(after.timestamp).toISOString()})
Map:
${after.map}
Structures:
${after.structures}
Armies:
${after.armies}
Tool errors since last evolution:
${after.toolErrors || "None"}

`;
  } else {
    prompt += `## Current State (first evolution — no "before" snapshot)
Map:
${after.map}
Structures:
${after.structures}
Armies:
${after.armies}

`;
  }

  // Include key actions from recent messages (tool calls and results only, skip tick prompts)
  const msgs = after.recentMessages ?? [];
  if (msgs.length > 0) {
    prompt += `## Key Actions (last ${msgs.length} messages)\n\n`;
    for (const msg of msgs) {
      if (msg.role === "assistant" && Array.isArray(msg.content)) {
        for (const b of msg.content) {
          if (b.type === "toolCall") prompt += `→ ${b.name}(${JSON.stringify(b.arguments).slice(0, 150)})\n`;
        }
      } else if (msg.role === "toolResult") {
        const text = Array.isArray(msg.content)
          ? msg.content.filter((b: any) => b.type === "text").map((b: any) => b.text).join("").slice(0, 200)
          : String(msg.content ?? "").slice(0, 200);
        if (text) prompt += `  ${text}\n`;
      }
    }
    prompt += "\n";
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
