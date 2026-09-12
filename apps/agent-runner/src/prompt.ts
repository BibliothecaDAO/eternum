// Every piece of text the model reads from the runner lives here: system prompt sections, wake messages, notices.
import type { WorldDelta } from "./delta";
import type { GamePhase } from "./game-phase";
import type { Wake } from "./wake";

export const WORLD_STATE_UPDATE_PREFIX = "[WORLD STATE UPDATE]";
export const OWNER_DIRECTION_PREFIX = "[OWNER DIRECTION]";
export const GAME_ENDED_PREFIX = "[GAME ENDED]";

export interface SkillText {
  name: string;
  body: string;
}

export interface ToolGuideEntry {
  name: string;
  description: string;
}

interface GameSummaryInput {
  gameId: number;
  gameName: string;
  mode: "blitz" | "eternum" | null;
  chain: string;
  /** The signer's address, or null while spectating. */
  viewer: string | null;
  structures: number[];
  explorers: number[];
}

// System prompt sections

export const renderIdentitySection = (soul: string): string => `# Who I am\n\n${soul.trim()}`;

export const renderGameSection = (gameSummary: string): string => `# The game\n\n${gameSummary.trim()}`;

export const renderGameSummary = (input: GameSummaryInput): string =>
  [
    `Game ${input.gameId} "${input.gameName}" (${input.mode ?? "unknown mode"}) on the ${input.chain} chain.`,
    input.mode === "blitz"
      ? "Blitz is a short timed match: a fixed number of hours, a small map, and victory points from exploration, fights, chests, and hyperstructures. Every tick counts."
      : "Eternum is the long format: days of play, a large map, and an economy that rewards patient building and trade.",
    input.viewer
      ? `I play as ${input.viewer}. My structures: ${renderIds(input.structures)}. My explorers: ${renderIds(input.explorers)}.`
      : "I am spectating: no signer is connected, so act refuses to submit and I can only observe and plan.",
  ].join("\n");

export const renderRulesOfEngagementSection = (): string =>
  [
    "# Rules of engagement",
    "",
    "- Observe before acting. Call observe_game before the first decision of every wake, and again after any action that changes the board.",
    "- One action per decision. Decide, act once, read the result, then decide again. Batch only read-only planning calls (armyPaths, structurePaths, simulate); never batch submitting actions.",
    "- Never invent entity ids, coordinates, troop counts, or balances. Use only ids and hexes an observation or planner returned in this conversation.",
    "- Read the result of every act call. A refused or failed action means the board disagrees with my picture of it: re-observe before retrying, and never retry the same failed call unchanged.",
    "- When a WORLD STATE UPDATE arrives mid-plan, re-observe what it names before continuing; the plan may be stale.",
    "- Report to my owner with report_to_owner on notable events only: settled, fought, lost or won a structure, a threat spotted or resolved, the game ending.",
    "- Stamina and transactions are scarce. Skip a wake with nothing worth doing; a short answer with no action is a valid decision.",
  ].join("\n");

export const renderSkillsSection = (skills: SkillText[]): string =>
  ["<skills>", ...skills.map(renderSkill), "</skills>"].join("\n");

const renderSkill = (skill: SkillText): string => `<skill name="${skill.name}">\n${skill.body.trim()}\n</skill>`;

export const renderToolGuideSection = (tools: ToolGuideEntry[]): string =>
  [
    "# Tools",
    "",
    "The loop is observe_game → list_actions → act:",
    "1. observe_game(focus) is the only source of truth about the board. empire for my structures, armies for my explorers, nearby for what stands within three hexes of them, market, leaderboard, events.",
    "2. list_actions(keyword) documents each action's parameters and preconditions. Look an action up before the first time I use it.",
    "3. act(action, params) runs one action. Planners (armyPaths, structurePaths) are read-only and return reachable hexes; a moveArmy target must be one of them. Submitting actions sign, wait for confirmation, and return the confirmation or a classified failure.",
    "simulate prices a fight, a raid, or a building before I commit. remember and recall keep notes across wakes. report_to_owner is for my owner, not for thinking aloud.",
    "",
    "Available tools:",
    ...tools.map((tool) => `- ${tool.name}: ${tool.description}`),
  ].join("\n");

// Wake messages

export const renderWakeMessage = (wake: Wake, delta: WorldDelta): string => {
  switch (wake.reason) {
    case "startup":
      return [
        "[GAME START] I have just connected to the game.",
        "Observe the empire, my armies, and what is nearby, then decide the first action.",
      ].join("\n");
    case "heartbeat":
      return [
        "[HEARTBEAT]",
        renderDelta(delta) || "Nothing material changed since my last look.",
        "Review the plan: is every explorer doing something useful, is production running, is anything within reach worth taking? Act only if it is.",
      ].join("\n");
    case "world-delta":
      return renderWorldStateUpdate(delta);
    case "phase-change":
      return [
        `[PHASE CHANGE] ${describePhaseChange(delta)}`,
        renderDelta(delta),
        "Re-observe and adjust the plan to the new phase.",
      ]
        .filter(Boolean)
        .join("\n");
    case "direction":
      return [`${OWNER_DIRECTION_PREFIX} ${wake.direction ?? ""}`.trim(), renderDelta(delta)]
        .filter(Boolean)
        .join("\n");
  }
};

export const renderWorldStateUpdate = (delta: WorldDelta): string =>
  [WORLD_STATE_UPDATE_PREFIX, renderDelta(delta), "Re-observe what changed before continuing."].join("\n");

export const renderGameEndedMessage = (): string =>
  `${GAME_ENDED_PREFIX} The game is over. Send my owner one final report with report_to_owner: my final standing if the leaderboard shows it, what worked, and what to change next game. Then stop.`;

export const renderCompactionNotice = (dropped: number): string =>
  `[Context compacted: ${dropped} older messages dropped. Re-observe before relying on anything I no longer see.]`;

/** The delta as short lines; empty when nothing material changed. */
const renderDelta = (delta: WorldDelta): string =>
  [
    delta.phase && `Phase: ${describePhaseChange(delta)}.`,
    delta.ownStructures.length > 0 && `My structures changed: ${renderIds(delta.ownStructures)}.`,
    delta.ownArmies.length > 0 && `My armies changed: ${renderIds(delta.ownArmies)}.`,
    delta.hostilesAppeared.length > 0 && `Hostile armies now within reach: ${renderIds(delta.hostilesAppeared)}.`,
    delta.hostilesMoved.length > 0 && `Hostile armies moved: ${renderIds(delta.hostilesMoved)}.`,
    delta.hostilesLeft.length > 0 && `Hostile armies left reach: ${renderIds(delta.hostilesLeft)}.`,
    delta.chestsAppeared.length > 0 && `Chests within reach: ${renderIds(delta.chestsAppeared)}.`,
    delta.ticksAdvanced > 0 && `${delta.ticksAdvanced} tick(s) passed.`,
  ]
    .filter((line): line is string => typeof line === "string")
    .join("\n");

const describePhaseChange = (delta: WorldDelta): string =>
  delta.phase ? `${describePhase(delta.phase.from)} → ${describePhase(delta.phase.to)}` : "phase unchanged";

const describePhase = (phase: GamePhase): string => phase;

const renderIds = (ids: number[]): string => (ids.length === 0 ? "none" : ids.map((id) => `#${id}`).join(", "));
