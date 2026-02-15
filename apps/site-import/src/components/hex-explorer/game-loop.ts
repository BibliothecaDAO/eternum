import type { GameState } from "./game-state";
import type { AgentData, FeatureHexData, PixelCoord } from "./types";
import { hexToPixel, hexKey, hexDistance } from "./hex-utils";
import { AGENT_PHRASES } from "./feature-data";
import { resetAfterDeath } from "./game-state";
import { updateAgents, lerpAgents, updateEnemies, lerpEnemies, checkEnemyCollision } from "./ai-controller";
import { drawScene } from "./game-renderer";

/** Lerp between two numbers. */
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Pick a random element from an array. */
function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export interface GameCallbacks {
  onFeatureHexActivate: (feature: FeatureHexData | null) => void;
  onAgentNearby: (agent: AgentData | null, screenPos: PixelCoord | null) => void;
}

/**
 * Create and start the game loop. Returns a cleanup function.
 *
 * Orchestrates: player movement → AI → collision → camera → proximity → draw.
 */
export function createGameLoop(
  canvas: HTMLCanvasElement,
  state: GameState,
  width: number,
  height: number,
  callbacks: GameCallbacks
): () => void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return () => {};

  const dpr = window.devicePixelRatio || 1;
  canvas.width = width * dpr;
  canvas.height = height * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  let lastAgentUpdate = 0;
  let animFrame = 0;

  function frame(now: number) {
    if (!ctx) return;
    state.time = now;

    const moveDuration = state.prefersReducedMotion ? 0 : 200;

    // ── Player movement ──────────────────────────────────────────
    if (state.isMoving) {
      const elapsed = now - state.moveStartTime;
      const t = Math.min(elapsed / Math.max(moveDuration, 1), 1);
      const eased = t * (2 - t); // ease-out quad

      const startPixel = hexToPixel(state.playerHex, state.hexSize);
      state.playerPixel.x = lerp(startPixel.x, state.playerTargetPixel.x, eased);
      state.playerPixel.y = lerp(startPixel.y, state.playerTargetPixel.y, eased);

      if (t >= 1) {
        state.isMoving = false;
        state.trail.push({ ...state.playerHex });
        if (state.trail.length > 6) state.trail.shift();
        state.playerHex = { ...state.playerTargetHex };
        state.playerPixel = hexToPixel(state.playerHex, state.hexSize);
      }
    }

    // ── AI updates ───────────────────────────────────────────────
    lastAgentUpdate = updateAgents(state, now, lastAgentUpdate);
    lerpAgents(state);
    updateEnemies(state, now);
    lerpEnemies(state);

    // ── Collision ────────────────────────────────────────────────
    checkEnemyCollision(state, now);

    // ── Death reset ──────────────────────────────────────────────
    if (state.isDead && now - state.deathFlashTime > 1200) {
      resetAfterDeath(state);
      callbacks.onFeatureHexActivate(null);
      callbacks.onAgentNearby(null, null);
    }

    // ── Camera ───────────────────────────────────────────────────
    const camLerp = state.prefersReducedMotion ? 1 : 0.08;
    state.cameraX = lerp(state.cameraX, state.playerPixel.x, camLerp);
    state.cameraY = lerp(state.cameraY, state.playerPixel.y, camLerp);

    // ── Feature proximity ────────────────────────────────────────
    let foundFeature: FeatureHexData | null = null;
    const playerKey = hexKey(state.playerHex);
    if (state.featureMap.has(playerKey)) {
      foundFeature = state.featureMap.get(playerKey)!;
    }
    if (foundFeature !== state.activeFeature) {
      state.activeFeature = foundFeature;
      callbacks.onFeatureHexActivate(foundFeature);
    }

    // ── Agent proximity ──────────────────────────────────────────
    let nearestAgent: AgentData | null = null;
    let nearestAgentScreenPos: PixelCoord | null = null;
    for (const agent of state.agents) {
      if (hexDistance(state.playerHex, agent.coord) <= 2) {
        nearestAgent = agent;
        nearestAgentScreenPos = {
          x: agent.pixelPos.x - state.cameraX + width / 2,
          y: agent.pixelPos.y - state.cameraY + height / 2,
        };
        break;
      }
    }
    if (nearestAgent !== state.activeAgent) {
      state.activeAgent = nearestAgent;
      if (nearestAgent) {
        nearestAgent.phrase = pick(AGENT_PHRASES);
      }
      callbacks.onAgentNearby(nearestAgent, nearestAgentScreenPos);
    }

    // ── Draw ─────────────────────────────────────────────────────
    drawScene(ctx, state, width, height, now);

    animFrame = requestAnimationFrame(frame);
  }

  animFrame = requestAnimationFrame(frame);

  return () => cancelAnimationFrame(animFrame);
}
