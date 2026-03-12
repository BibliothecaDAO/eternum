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

function extractMessageText(msg: any): string {
  if (typeof msg.content === "string") return msg.content;
  if (Array.isArray(msg.content)) {
    return msg.content
      .filter((b: any) => b.type === "text")
      .map((b: any) => b.text)
      .join("\n");
  }
  return "";
}

function buildEvolutionPrompt(dataDir: string, recentMessages?: any[]): string {
  const soulPath = join(dataDir, "soul.md");
  const soul = existsSync(soulPath) ? loadSoul(soulPath) : "(no soul defined)";
  const taskLists = loadTaskLists(join(dataDir, "tasks"));

  let prompt = `You are the evolution engine for a game-playing agent in Eternum (an on-chain strategy game).
Analyze the agent's ACTUAL recent gameplay and suggest improvements to its strategy files.

## Current Soul
${soul}

## Current Task Lists
`;

  for (const [domain, content] of taskLists) {
    prompt += `### ${domain}\n${content}\n\n`;
  }

  // Include recent gameplay so evolution is grounded in reality
  if (recentMessages && recentMessages.length > 0) {
    prompt += `## Recent Gameplay (last ${recentMessages.length} messages)\n\n`;
    for (const msg of recentMessages) {
      const text = extractMessageText(msg).slice(0, 500);
      if (!text) continue;
      if (msg.role === "user") prompt += `[TICK] ${text}\n\n`;
      else if (msg.role === "assistant") {
        // Show tool calls inline
        if (Array.isArray(msg.content)) {
          for (const b of msg.content) {
            if (b.type === "text" && b.text) prompt += `[AGENT] ${b.text.slice(0, 300)}\n`;
            if (b.type === "toolCall") prompt += `[TOOL CALL] ${b.name}(${JSON.stringify(b.arguments).slice(0, 200)})\n`;
          }
          prompt += "\n";
        } else {
          prompt += `[AGENT] ${text}\n\n`;
        }
      } else if (msg.role === "toolResult") {
        prompt += `[TOOL RESULT] ${text.slice(0, 300)}\n\n`;
      }
    }
  } else {
    prompt += `## Recent Gameplay\n(No messages yet — agent just started.)\n\n`;
  }

  prompt += `## Instructions

Based on the ACTUAL gameplay above, suggest improvements. Focus on:
- What went wrong? (failed moves, bad attacks, wasted stamina)
- What went right? (successful captures, good positioning)
- What should change in the strategy?

Keep suggestions SHORT and CONCRETE. Don't add complex frameworks or military doctrine.
The agent has these tools: inspect_tile, move_army, attack_target, create_army, reinforce_army,
defend_structure, transfer_resources, open_chest, view_map.

Each suggestion must have:
- target: "soul" | "task_list"
- domain: (required for task_list) one of: combat, economy, exploration, priorities
- action: "update"
- content: the FULL new content (replaces the file entirely)
- reasoning: one sentence explaining why

IMPORTANT: Keep content concise. Each file should be under 50 lines. No verbose military doctrine.

\`\`\`json
[
  {
    "target": "task_list",
    "domain": "combat",
    "action": "update",
    "content": "- Attack structures when strength ratio > 2x\\n- Retreat when ratio < 0.5x",
    "reasoning": "Agent attacked at 0.7x ratio and lost — need clearer threshold."
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
export async function evolve(model: Model<any>, dataDir: string, recentMessages?: any[]): Promise<EvolutionResult> {
  const prompt = buildEvolutionPrompt(dataDir, recentMessages);

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
