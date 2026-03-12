/**
 * Essence & food pulse check — the only base-status the agent needs.
 *
 * Answers two questions:
 * 1. "Am I blocked on essence?" → go capture a Fragment Mine
 * 2. "Can my armies move?" → wheat is the fuel for army movement
 *
 * Everything else (building, production) is handled by background automation.
 */

import { type BuildStep, buildOrderForBiome } from "./build-order.js";
import type { RealmState } from "./runner.js";

// ── Essence costs per BuildingType ────────────────────────────────────
// Only buildings that require Essence are listed.

const ESSENCE_COST: Record<number, number> = {
  // T2 troop buildings
  29: 600, // KnightT2
  32: 600, // CrossbowmanT2
  35: 600, // PaladinT2

  // T3 resource buildings
  21: 600, // Adamantine
  11: 600, // Mithral
  24: 600, // Dragonhide

  // T3 troop buildings
  30: 1200, // KnightT3
  33: 1200, // CrossbowmanT3
  36: 1200, // PaladinT3
};

// ── Types ─────────────────────────────────────────────────────────────

interface EssencePulse {
  balance: number;
  milestone: { label: string; cost: number } | null;
  shortfall: number;
  sufficient: boolean;
}

interface WheatPulse {
  balance: number;
  movesRemaining: number;
  low: boolean;
}

interface PulseCheck {
  essence: EssencePulse;
  wheat: WheatPulse;
  briefing: string;
}

// ── Constants ─────────────────────────────────────────────────────────

/** Approximate wheat consumed per army move (hardcoded estimate, not read from game config at runtime). */
const WHEAT_PER_MOVE = 20;

/** Below this many moves, warn the agent. */
const LOW_MOVES_THRESHOLD = 10;

// ── Pulse check ───────────────────────────────────────────────────────

/**
 * Check essence and wheat status for a realm.
 *
 * @param essenceBalance - Current essence balance on hand.
 * @param wheatBalance - Current wheat balance on hand.
 * @param realmState - Current realm state; only `biome` and `buildingCounts` are read
 *                     to determine the next essence-gated build step.
 * @returns A PulseCheck with essence sufficiency, wheat move estimates, and a formatted briefing string.
 */
export function checkPulse(essenceBalance: number, wheatBalance: number, realmState: RealmState): PulseCheck {
  const essence = checkEssence(essenceBalance, realmState);
  const wheat = checkWheat(wheatBalance);
  const briefing = formatBriefing(essence, wheat);

  return { essence, wheat, briefing };
}

function checkEssence(balance: number, realmState: RealmState): EssencePulse {
  const order = buildOrderForBiome(realmState.biome);

  // Walk the build order to find the next essence-gated step
  const claimed = new Map<number, number>();

  for (const step of order.steps) {
    const built = realmState.buildingCounts.get(step.building) ?? 0;
    const alreadyClaimed = claimed.get(step.building) ?? 0;

    if (built > alreadyClaimed) {
      claimed.set(step.building, alreadyClaimed + 1);
      continue;
    }

    // This step isn't built yet. Does it need essence?
    const cost = ESSENCE_COST[step.building];
    if (cost) {
      const shortfall = Math.max(0, cost - balance);
      return {
        balance,
        milestone: { label: step.label, cost },
        shortfall,
        sufficient: shortfall === 0,
      };
    }
  }

  // No essence-gated steps remaining
  return { balance, milestone: null, shortfall: 0, sufficient: true };
}

function checkWheat(balance: number): WheatPulse {
  const movesRemaining = Math.floor(balance / WHEAT_PER_MOVE);
  return {
    balance,
    movesRemaining,
    low: movesRemaining < LOW_MOVES_THRESHOLD,
  };
}

function formatBriefing(essence: EssencePulse, wheat: WheatPulse): string {
  const lines: string[] = [];

  // Essence line
  if (essence.milestone) {
    if (essence.sufficient) {
      lines.push(`Essence: ${essence.balance} — sufficient for ${essence.milestone.label} (${essence.milestone.cost})`);
    } else {
      lines.push(
        `Essence: ${essence.balance} — need ${essence.milestone.cost} for ${essence.milestone.label} (short ${essence.shortfall})`,
      );
      lines.push(`Action: Capture a Fragment Mine`);
    }
  } else {
    lines.push(`Essence: ${essence.balance} — no pending milestones`);
  }

  // Wheat line
  if (wheat.low) {
    lines.push(`Wheat: ${wheat.balance} — LOW (~${wheat.movesRemaining} army moves remaining)`);
    lines.push(`Action: Prioritize food or return armies to base`);
  } else {
    lines.push(`Wheat: ${wheat.balance} (~${wheat.movesRemaining} army moves)`);
  }

  return lines.join("\n");
}
