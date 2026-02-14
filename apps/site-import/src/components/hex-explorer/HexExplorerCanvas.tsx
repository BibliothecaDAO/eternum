import { useCallback, useEffect, useRef } from "react";
import type {
  AgentData,
  EnemyData,
  FeatureHexData,
  HexCoord,
  HexDirection,
  PixelCoord,
} from "./types";
import {
  hexToPixel,
  hexCorners,
  hexKey,
  hexesInRange,
  hexDistance,
  hexNeighbor,
} from "./hex-utils";
import { FEATURE_HEXES, INITIAL_AGENTS, INITIAL_ENEMIES, AGENT_PHRASES } from "./feature-data";
import { useHexExplorerInput } from "./useHexExplorerInput";

// ── Color palette (canvas-safe hex fallbacks for oklch vars) ──────────
const COLORS = {
  bgVoid: "#0f0f1e",
  borderEtched: "#5c5c4a",
  accentEmber: "#d4874d",
  accentBrass: "#c8a855",
  accentArcane: "#7a6aaa",
  dimText: "#3a3a30",
  featureGame: "#c8a855",
  featureLore: "#7a6aaa",
  featureAgent: "#7a6aaa",
  featureToken: "#c8a855",
  featureCommunity: "#7a6aaa",
  enemyRed: "#e05555",
} as const;

// ── Tiny fill characters for empty hexes ──────────────────────────────
const FILL_CHARS = [".", ":", "\u00b7", "+", ".", ":", "\u00b7"];

interface HexExplorerCanvasProps {
  width: number;
  height: number;
  isActive: boolean;
  onFeatureHexActivate: (feature: FeatureHexData | null) => void;
  onAgentNearby: (agent: AgentData | null, screenPos: PixelCoord | null) => void;
  onFirstInput: () => void;
}

/** Lerp between two numbers. */
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Pick a random element from an array. */
function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function HexExplorerCanvas({
  width,
  height,
  isActive,
  onFeatureHexActivate,
  onAgentNearby,
  onFirstInput,
}: HexExplorerCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number>(0);

  // ── Mutable state stored in refs (no re-renders during animation) ───
  const stateRef = useRef({
    // Grid
    hexSize: 44,
    gridRadius: 30,
    hexFills: new Map<string, string>(), // hex key -> random fill char

    // Player
    playerHex: { q: 0, r: 0 } as HexCoord,
    playerTargetHex: { q: 0, r: 0 } as HexCoord,
    playerPixel: { x: 0, y: 0 } as PixelCoord,
    playerTargetPixel: { x: 0, y: 0 } as PixelCoord,
    isMoving: false,
    moveStartTime: 0,
    trail: [] as HexCoord[],

    // Camera
    cameraX: 0,
    cameraY: 0,

    // Agents
    agents: INITIAL_AGENTS.map((a) => ({ ...a })),
    agentMoveTimers: INITIAL_AGENTS.map(() => 0),

    // Enemies
    enemies: INITIAL_ENEMIES.map((e) => ({ ...e })),
    lastEnemyMoveTime: 0,
    deathFlashTime: 0, // >0 means death animation in progress
    isDead: false,

    // Feature
    activeFeature: null as FeatureHexData | null,
    activeAgent: null as AgentData | null,

    // Misc
    time: 0,
    initialized: false,
    prefersReducedMotion: false,
    hasReceivedInput: false,

    // Feature map for O(1) lookup
    featureMap: new Map<string, FeatureHexData>(),
  });

  // Build feature map and hex fills once
  useEffect(() => {
    const s = stateRef.current;
    if (s.initialized) return;
    s.initialized = true;

    // Check prefers-reduced-motion
    s.prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    // Build feature map
    for (const f of FEATURE_HEXES) {
      s.featureMap.set(hexKey(f.coord), f);
    }

    // Generate random fill chars for grid hexes
    const allHexes = hexesInRange({ q: 0, r: 0 }, s.gridRadius);
    for (const h of allHexes) {
      s.hexFills.set(hexKey(h), pick(FILL_CHARS));
    }

    // Initialize player pixel pos
    s.playerPixel = hexToPixel(s.playerHex, s.hexSize);
    s.playerTargetPixel = { ...s.playerPixel };
    s.cameraX = s.playerPixel.x;
    s.cameraY = s.playerPixel.y;

    // Initialize agent pixel positions
    for (const agent of s.agents) {
      agent.pixelPos = hexToPixel(agent.coord, s.hexSize);
    }

    // Initialize enemy pixel positions
    for (const enemy of s.enemies) {
      enemy.pixelPos = hexToPixel(enemy.coord, s.hexSize);
    }
  }, []);

  // Adjust hex size based on viewport
  useEffect(() => {
    const s = stateRef.current;
    s.hexSize = width < 640 ? 30 : width < 1024 ? 38 : 44;
  }, [width]);

  // ── Movement handler ────────────────────────────────────────────────
  const handleMove = useCallback(
    (direction: HexDirection) => {
      const s = stateRef.current;
      if (s.isMoving || s.isDead) return;

      if (!s.hasReceivedInput) {
        s.hasReceivedInput = true;
        onFirstInput();
      }

      const target = hexNeighbor(s.playerHex, direction);

      // Boundary check — stay within grid radius
      if (hexDistance({ q: 0, r: 0 }, target) > s.gridRadius) return;

      s.playerTargetHex = target;
      s.playerTargetPixel = hexToPixel(target, s.hexSize);
      s.isMoving = true;
      s.moveStartTime = performance.now();
    },
    [onFirstInput]
  );

  // ── Click-to-move handler ───────────────────────────────────────────
  const handleCanvasClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const s = stateRef.current;
      if (s.isMoving || s.isDead) return;

      const rect = canvas.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const clickY = e.clientY - rect.top;

      // Player screen position
      const offsetX = width / 2 - s.cameraX;
      const offsetY = height / 2 - s.cameraY;
      const px = s.playerPixel.x + offsetX;
      const py = s.playerPixel.y + offsetY;

      const dx = clickX - px;
      const dy = clickY - py;

      // Ignore clicks too close to the player
      if (dx * dx + dy * dy < 100) return;

      // Angle from player to click (radians, 0 = right, positive = down)
      const angle = Math.atan2(dy, dx);

      // Map to nearest of 6 hex directions (pointy-top)
      // Direction angles: 0=0°, 5=60°, 4=120°, 3=180°, 2=-120°, 1=-60°
      // Normalize to [0, 2PI)
      const a = ((angle % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
      let dir: HexDirection;
      if (a < Math.PI / 6 || a >= (11 * Math.PI) / 6) {
        dir = 0; // East
      } else if (a < Math.PI / 2) {
        dir = 5; // SE
      } else if (a < (5 * Math.PI) / 6) {
        dir = 4; // SW
      } else if (a < (7 * Math.PI) / 6) {
        dir = 3; // West
      } else if (a < (3 * Math.PI) / 2) {
        dir = 2; // NW
      } else {
        dir = 1; // NE
      }

      if (!s.hasReceivedInput) {
        s.hasReceivedInput = true;
        onFirstInput();
      }

      handleMove(dir);
    },
    [width, height, handleMove, onFirstInput]
  );

  // ── Input hook ──────────────────────────────────────────────────────
  useHexExplorerInput(isActive, handleMove);

  // ── Animation loop ──────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;

    function resize() {
      if (!canvas || !ctx) return;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    resize();

    let lastAgentUpdate = 0;

    function frame(now: number) {
      if (!ctx) return;
      const s = stateRef.current;
      s.time = now;
      const dt = 1 / 60; // normalized timestep

      const moveDuration = s.prefersReducedMotion ? 0 : 200; // ms

      // ── Update player position ────────────────────────────────────
      if (s.isMoving) {
        const elapsed = now - s.moveStartTime;
        const t = Math.min(elapsed / Math.max(moveDuration, 1), 1);
        const eased = t * (2 - t); // ease-out quad

        s.playerPixel.x = lerp(
          hexToPixel(s.playerHex, s.hexSize).x,
          s.playerTargetPixel.x,
          eased
        );
        s.playerPixel.y = lerp(
          hexToPixel(s.playerHex, s.hexSize).y,
          s.playerTargetPixel.y,
          eased
        );

        if (t >= 1) {
          s.isMoving = false;
          // Record trail
          s.trail.push({ ...s.playerHex });
          if (s.trail.length > 6) s.trail.shift();
          // Snap
          s.playerHex = { ...s.playerTargetHex };
          s.playerPixel = hexToPixel(s.playerHex, s.hexSize);
        }
      }

      // ── Update agents ─────────────────────────────────────────────
      if (now - lastAgentUpdate > 2500) {
        lastAgentUpdate = now;
        for (let i = 0; i < s.agents.length; i++) {
          const agent = s.agents[i];
          // Pick a random neighbor as next target
          const dir = Math.floor(Math.random() * 6) as HexDirection;
          const next = hexNeighbor(agent.coord, dir);
          if (hexDistance({ q: 0, r: 0 }, next) <= s.gridRadius) {
            agent.targetCoord = next;
            s.agentMoveTimers[i] = now;
          }
        }
      }

      // Lerp agents toward targets
      for (let i = 0; i < s.agents.length; i++) {
        const agent = s.agents[i];
        const targetPixel = hexToPixel(agent.targetCoord, s.hexSize);
        const agentLerpSpeed = s.prefersReducedMotion ? 1 : 0.03;
        agent.pixelPos.x = lerp(agent.pixelPos.x, targetPixel.x, agentLerpSpeed);
        agent.pixelPos.y = lerp(agent.pixelPos.y, targetPixel.y, agentLerpSpeed);

        // Snap when close
        const dx = targetPixel.x - agent.pixelPos.x;
        const dy = targetPixel.y - agent.pixelPos.y;
        if (dx * dx + dy * dy < 1) {
          agent.coord = { ...agent.targetCoord };
          agent.pixelPos = { ...targetPixel };
        }
      }

      // ── Update enemies (chase player) ──────────────────────────────
      if (s.hasReceivedInput && !s.isDead && now - s.lastEnemyMoveTime > 3000) {
        s.lastEnemyMoveTime = now;
        for (const enemy of s.enemies) {
          // 70% chance to chase, 30% random wander
          if (Math.random() < 0.7) {
            // Greedy: pick neighbor closest to player
            let bestDir: HexDirection = 0;
            let bestDist = Infinity;
            for (let d = 0; d < 6; d++) {
              const neighbor = hexNeighbor(enemy.coord, d as HexDirection);
              const dist = hexDistance(neighbor, s.playerHex);
              if (
                dist < bestDist &&
                hexDistance({ q: 0, r: 0 }, neighbor) <= s.gridRadius
              ) {
                bestDist = dist;
                bestDir = d as HexDirection;
              }
            }
            const next = hexNeighbor(enemy.coord, bestDir);
            enemy.targetCoord = next;
          } else {
            const dir = Math.floor(Math.random() * 6) as HexDirection;
            const next = hexNeighbor(enemy.coord, dir);
            if (hexDistance({ q: 0, r: 0 }, next) <= s.gridRadius) {
              enemy.targetCoord = next;
            }
          }
        }
      }

      // Lerp enemies toward targets
      for (const enemy of s.enemies) {
        const targetPixel = hexToPixel(enemy.targetCoord, s.hexSize);
        const eLerp = s.prefersReducedMotion ? 1 : 0.025;
        enemy.pixelPos.x = lerp(enemy.pixelPos.x, targetPixel.x, eLerp);
        enemy.pixelPos.y = lerp(enemy.pixelPos.y, targetPixel.y, eLerp);

        const edx = targetPixel.x - enemy.pixelPos.x;
        const edy = targetPixel.y - enemy.pixelPos.y;
        if (edx * edx + edy * edy < 1) {
          enemy.coord = { ...enemy.targetCoord };
          enemy.pixelPos = { ...targetPixel };
        }
      }

      // ── Collision: enemy catches player ─────────────────────────────
      if (!s.isDead && s.hasReceivedInput) {
        for (const enemy of s.enemies) {
          if (hexDistance(s.playerHex, enemy.coord) === 0) {
            s.isDead = true;
            s.deathFlashTime = now;
            break;
          }
        }
      }

      // ── Death reset after flash ─────────────────────────────────────
      if (s.isDead && now - s.deathFlashTime > 1200) {
        s.isDead = false;
        s.deathFlashTime = 0;
        s.playerHex = { q: 0, r: 0 };
        s.playerTargetHex = { q: 0, r: 0 };
        s.playerPixel = hexToPixel(s.playerHex, s.hexSize);
        s.playerTargetPixel = { ...s.playerPixel };
        s.isMoving = false;
        s.trail = [];
        // Reset enemies to starting positions
        for (let i = 0; i < s.enemies.length; i++) {
          const start = INITIAL_ENEMIES[i];
          s.enemies[i].coord = { ...start.startCoord };
          s.enemies[i].targetCoord = { ...start.startCoord };
          s.enemies[i].pixelPos = hexToPixel(start.startCoord, s.hexSize);
        }
        // Clear feature/agent UI
        s.activeFeature = null;
        s.activeAgent = null;
        onFeatureHexActivate(null);
        onAgentNearby(null, null);
      }

      // ── Camera follow (smooth lerp) ───────────────────────────────
      const camLerp = s.prefersReducedMotion ? 1 : 0.08;
      s.cameraX = lerp(s.cameraX, s.playerPixel.x, camLerp);
      s.cameraY = lerp(s.cameraY, s.playerPixel.y, camLerp);

      // ── Check feature hex proximity ───────────────────────────────
      let foundFeature: FeatureHexData | null = null;
      const playerKey = hexKey(s.playerHex);
      if (s.featureMap.has(playerKey)) {
        foundFeature = s.featureMap.get(playerKey)!;
      }
      if (foundFeature !== s.activeFeature) {
        s.activeFeature = foundFeature;
        onFeatureHexActivate(foundFeature);
      }

      // ── Check agent proximity ─────────────────────────────────────
      let nearestAgent: AgentData | null = null;
      let nearestAgentScreenPos: PixelCoord | null = null;
      for (const agent of s.agents) {
        if (hexDistance(s.playerHex, agent.coord) <= 2) {
          nearestAgent = agent;
          // Calculate screen position of agent
          nearestAgentScreenPos = {
            x: agent.pixelPos.x - s.cameraX + width / 2,
            y: agent.pixelPos.y - s.cameraY + height / 2,
          };
          break;
        }
      }
      if (nearestAgent !== s.activeAgent) {
        s.activeAgent = nearestAgent;
        // Rotate phrase when discovered
        if (nearestAgent) {
          nearestAgent.phrase = pick(AGENT_PHRASES);
        }
        onAgentNearby(nearestAgent, nearestAgentScreenPos);
      }

      // ── Draw ──────────────────────────────────────────────────────
      draw(ctx, s, width, height, now);

      animFrameRef.current = requestAnimationFrame(frame);
    }

    animFrameRef.current = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(animFrameRef.current);
    };
  }, [width, height, onFeatureHexActivate, onAgentNearby]);

  return (
    <canvas
      ref={canvasRef}
      style={{ width, height, display: "block", cursor: "pointer" }}
      onClick={handleCanvasClick}
      aria-hidden="true"
    />
  );
}

// ── Drawing ───────────────────────────────────────────────────────────

function draw(
  ctx: CanvasRenderingContext2D,
  s: ReturnType<typeof getState>,
  w: number,
  h: number,
  now: number
) {
  const halfW = w / 2;
  const halfH = h / 2;
  const offsetX = halfW - s.cameraX;
  const offsetY = halfH - s.cameraY;

  // 1. Background fill
  ctx.fillStyle = COLORS.bgVoid;
  ctx.fillRect(0, 0, w, h);

  // Viewport culling bounds (in world space, with margin)
  const margin = s.hexSize * 3;
  const viewLeft = s.cameraX - halfW - margin;
  const viewRight = s.cameraX + halfW + margin;
  const viewTop = s.cameraY - halfH - margin;
  const viewBottom = s.cameraY + halfH + margin;

  // 2. Draw hex grid
  ctx.lineWidth = 0.5;
  ctx.strokeStyle = COLORS.borderEtched;
  ctx.globalAlpha = 0.35;

  const allHexes = hexesInRange({ q: 0, r: 0 }, s.gridRadius);

  for (const hex of allHexes) {
    const center = hexToPixel(hex, s.hexSize);

    // Viewport culling
    if (
      center.x < viewLeft ||
      center.x > viewRight ||
      center.y < viewTop ||
      center.y > viewBottom
    )
      continue;

    const screenX = center.x + offsetX;
    const screenY = center.y + offsetY;

    // Distance from grid center for fog
    const dist = hexDistance({ q: 0, r: 0 }, hex);
    const fogAlpha = dist > s.gridRadius - 5
      ? Math.max(0, 1 - (dist - (s.gridRadius - 5)) / 5)
      : 1;

    const key = hexKey(hex);
    const isFeature = s.featureMap.has(key);

    // Draw hex outline
    const corners = hexCorners({ x: screenX, y: screenY }, s.hexSize);
    ctx.beginPath();
    ctx.moveTo(corners[0].x, corners[0].y);
    for (let i = 1; i < 6; i++) {
      ctx.lineTo(corners[i].x, corners[i].y);
    }
    ctx.closePath();

    if (isFeature) {
      const feature = s.featureMap.get(key)!;
      ctx.globalAlpha = 0.6 * fogAlpha;
      ctx.strokeStyle = featureColor(feature.type);
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.lineWidth = 0.5;
      ctx.strokeStyle = COLORS.borderEtched;
    } else {
      ctx.globalAlpha = 0.25 * fogAlpha;
      ctx.stroke();
    }

    // Draw fill character
    if (!isFeature) {
      const fillChar = s.hexFills.get(key) || ".";
      ctx.globalAlpha = 0.12 * fogAlpha;
      ctx.fillStyle = COLORS.dimText;
      ctx.font = `10px "Source Code Pro", monospace`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(fillChar, screenX, screenY);
    }

    // Draw feature symbol
    if (isFeature) {
      const feature = s.featureMap.get(key)!;
      ctx.globalAlpha = 0.85 * fogAlpha;
      ctx.fillStyle = featureColor(feature.type);
      ctx.font = `bold 11px "Source Code Pro", monospace`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(feature.symbol, screenX, screenY);
    }
  }

  // 3. Player trail
  ctx.globalAlpha = 1;
  for (let i = 0; i < s.trail.length; i++) {
    const trailHex = s.trail[i];
    const trailPixel = hexToPixel(trailHex, s.hexSize);
    const sx = trailPixel.x + offsetX;
    const sy = trailPixel.y + offsetY;
    const trailAlpha = ((i + 1) / s.trail.length) * 0.35;

    ctx.beginPath();
    ctx.arc(sx, sy, s.hexSize * 0.3, 0, Math.PI * 2);
    ctx.fillStyle = COLORS.accentEmber;
    ctx.globalAlpha = trailAlpha;
    ctx.fill();
  }

  // 4. Agents
  ctx.globalAlpha = 1;
  for (const agent of s.agents) {
    const ax = agent.pixelPos.x + offsetX;
    const ay = agent.pixelPos.y + offsetY;

    // Skip if off-screen
    if (ax < -50 || ax > w + 50 || ay < -50 || ay > h + 50) continue;

    ctx.save();
    ctx.fillStyle = COLORS.accentArcane;
    ctx.globalAlpha = 0.85;
    ctx.font = `bold 16px "Source Code Pro", monospace`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.shadowColor = COLORS.accentArcane;
    ctx.shadowBlur = 8;
    ctx.fillText(agent.glyph, ax, ay);
    ctx.restore();
  }

  // 5. Enemies
  ctx.globalAlpha = 1;
  for (const enemy of s.enemies) {
    const ex = enemy.pixelPos.x + offsetX;
    const ey = enemy.pixelPos.y + offsetY;

    if (ex < -50 || ex > w + 50 || ey < -50 || ey > h + 50) continue;

    ctx.save();
    ctx.fillStyle = COLORS.enemyRed;
    ctx.globalAlpha = 0.9;
    ctx.font = `bold 18px "Source Code Pro", monospace`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.shadowColor = COLORS.enemyRed;
    ctx.shadowBlur = 10;
    ctx.fillText("$", ex, ey);
    ctx.restore();
  }

  // 6. Player entity
  ctx.save();
  const px = s.playerPixel.x + offsetX;
  const py = s.playerPixel.y + offsetY;
  const pulse = Math.sin(now * 0.003) * 0.3 + 0.7;

  ctx.fillStyle = COLORS.accentEmber;
  ctx.globalAlpha = 1;
  ctx.font = `bold 20px "Source Code Pro", monospace`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.shadowColor = COLORS.accentEmber;
  ctx.shadowBlur = 15 * pulse;
  ctx.fillText("@", px, py);
  ctx.restore();

  // 7. Death flash overlay
  if (s.isDead && s.deathFlashTime > 0) {
    const elapsed = now - s.deathFlashTime;
    const flashAlpha = elapsed < 200
      ? Math.min(elapsed / 100, 0.6)
      : Math.max(0, 0.6 - (elapsed - 200) / 1000);
    ctx.save();
    ctx.globalAlpha = flashAlpha;
    ctx.fillStyle = COLORS.enemyRed;
    ctx.fillRect(0, 0, w, h);
    if (elapsed < 1000) {
      ctx.globalAlpha = Math.min(flashAlpha * 2, 1);
      ctx.fillStyle = "#ffffff";
      ctx.font = `bold 32px "Source Code Pro", monospace`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.shadowColor = COLORS.enemyRed;
      ctx.shadowBlur = 20;
      ctx.fillText("CAUGHT!", halfW, halfH);
    }
    ctx.restore();
  }

  // 8. Scanlines (subtle)
  ctx.save();
  ctx.globalAlpha = 0.03;
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 0.5;
  for (let y = 0; y < h; y += 3) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }
  ctx.restore();

  // 9. Vignette / fog overlay
  ctx.save();
  const grad = ctx.createRadialGradient(halfW, halfH, h * 0.25, halfW, halfH, h * 0.7);
  grad.addColorStop(0, "transparent");
  grad.addColorStop(0.6, "transparent");
  grad.addColorStop(1, COLORS.bgVoid);
  ctx.fillStyle = grad;
  ctx.globalAlpha = 1;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

/** Helper to type the state ref value. */
function getState() {
  return {
    hexSize: 44,
    gridRadius: 30,
    hexFills: new Map<string, string>(),
    playerHex: { q: 0, r: 0 },
    playerTargetHex: { q: 0, r: 0 },
    playerPixel: { x: 0, y: 0 },
    playerTargetPixel: { x: 0, y: 0 },
    isMoving: false,
    moveStartTime: 0,
    trail: [] as HexCoord[],
    cameraX: 0,
    cameraY: 0,
    agents: [] as AgentData[],
    agentMoveTimers: [] as number[],
    enemies: [] as EnemyData[],
    lastEnemyMoveTime: 0,
    deathFlashTime: 0,
    isDead: false,
    activeFeature: null as FeatureHexData | null,
    activeAgent: null as AgentData | null,
    time: 0,
    initialized: false,
    prefersReducedMotion: false,
    hasReceivedInput: false,
    featureMap: new Map<string, FeatureHexData>(),
  };
}

function featureColor(type: FeatureHexData["type"]): string {
  switch (type) {
    case "game":
      return COLORS.featureGame;
    case "lore":
      return COLORS.featureLore;
    case "agent":
      return COLORS.featureAgent;
    case "token":
      return COLORS.featureToken;
    case "community":
      return COLORS.featureCommunity;
  }
}
