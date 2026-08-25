import type { GameState } from "./game-state";
import type { HexDirection } from "./types";
import { hexToPixel, hexDistance, hexNeighbor } from "./hex-utils";

/** Lerp between two numbers. */
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Update agent wandering and pixel interpolation. */
export function updateAgents(state: GameState, now: number, lastAgentUpdate: number): number {
  // Pick new wander targets every 2.5s
  if (now - lastAgentUpdate > 2500) {
    for (let i = 0; i < state.agents.length; i++) {
      const agent = state.agents[i];
      const dir = Math.floor(Math.random() * 6) as HexDirection;
      const next = hexNeighbor(agent.coord, dir);
      if (hexDistance({ q: 0, r: 0 }, next) <= state.gridRadius) {
        agent.targetCoord = next;
        state.agentMoveTimers[i] = now;
      }
    }
    return now; // return new lastAgentUpdate
  }
  return lastAgentUpdate;
}

/** Lerp all agents toward their target positions. */
export function lerpAgents(state: GameState): void {
  const speed = state.prefersReducedMotion ? 1 : 0.03;

  for (const agent of state.agents) {
    const target = hexToPixel(agent.targetCoord, state.hexSize);
    agent.pixelPos.x = lerp(agent.pixelPos.x, target.x, speed);
    agent.pixelPos.y = lerp(agent.pixelPos.y, target.y, speed);

    // Snap when close
    const dx = target.x - agent.pixelPos.x;
    const dy = target.y - agent.pixelPos.y;
    if (dx * dx + dy * dy < 1) {
      agent.coord = { ...agent.targetCoord };
      agent.pixelPos = { ...target };
    }
  }
}

/** Update enemy AI: 70% chase player, 30% wander. */
export function updateEnemies(state: GameState, now: number): void {
  if (!state.hasReceivedInput || state.isDead) return;
  if (now - state.lastEnemyMoveTime <= 3000) return;

  state.lastEnemyMoveTime = now;

  for (const enemy of state.enemies) {
    if (Math.random() < 0.7) {
      // Greedy chase: pick neighbor closest to player
      let bestDir: HexDirection = 0;
      let bestDist = Infinity;
      for (let d = 0; d < 6; d++) {
        const neighbor = hexNeighbor(enemy.coord, d as HexDirection);
        const dist = hexDistance(neighbor, state.playerHex);
        if (dist < bestDist && hexDistance({ q: 0, r: 0 }, neighbor) <= state.gridRadius) {
          bestDist = dist;
          bestDir = d as HexDirection;
        }
      }
      enemy.targetCoord = hexNeighbor(enemy.coord, bestDir);
    } else {
      // Random wander
      const dir = Math.floor(Math.random() * 6) as HexDirection;
      const next = hexNeighbor(enemy.coord, dir);
      if (hexDistance({ q: 0, r: 0 }, next) <= state.gridRadius) {
        enemy.targetCoord = next;
      }
    }
  }
}

/** Lerp all enemies toward their target positions. */
export function lerpEnemies(state: GameState): void {
  const speed = state.prefersReducedMotion ? 1 : 0.025;

  for (const enemy of state.enemies) {
    const target = hexToPixel(enemy.targetCoord, state.hexSize);
    enemy.pixelPos.x = lerp(enemy.pixelPos.x, target.x, speed);
    enemy.pixelPos.y = lerp(enemy.pixelPos.y, target.y, speed);

    const dx = target.x - enemy.pixelPos.x;
    const dy = target.y - enemy.pixelPos.y;
    if (dx * dx + dy * dy < 1) {
      enemy.coord = { ...enemy.targetCoord };
      enemy.pixelPos = { ...target };
    }
  }
}

/** Check if any enemy occupies the same hex as the player. */
export function checkEnemyCollision(state: GameState, now: number): boolean {
  if (state.isDead || !state.hasReceivedInput) return false;

  for (const enemy of state.enemies) {
    if (hexDistance(state.playerHex, enemy.coord) === 0) {
      state.isDead = true;
      state.deathFlashTime = now;
      return true;
    }
  }
  return false;
}
