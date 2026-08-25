import type { GameState } from "./game-state";
import { COLORS, featureColor } from "./colors";
import { hexToPixel, hexCorners, hexKey, hexesInRange, hexDistance } from "./hex-utils";

/** Render the entire game scene to a canvas 2D context. */
export function drawScene(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  w: number,
  h: number,
  now: number
): void {
  const halfW = w / 2;
  const halfH = h / 2;
  const offsetX = halfW - state.cameraX;
  const offsetY = halfH - state.cameraY;

  // 1. Background
  ctx.fillStyle = COLORS.bgVoid;
  ctx.fillRect(0, 0, w, h);

  // Viewport culling bounds (world space, with margin)
  const margin = state.hexSize * 3;
  const viewLeft = state.cameraX - halfW - margin;
  const viewRight = state.cameraX + halfW + margin;
  const viewTop = state.cameraY - halfH - margin;
  const viewBottom = state.cameraY + halfH + margin;

  // 2. Hex grid
  drawHexGrid(ctx, state, offsetX, offsetY, viewLeft, viewRight, viewTop, viewBottom);

  // 3. Player trail
  drawTrail(ctx, state, offsetX, offsetY);

  // 4. Agents
  drawAgents(ctx, state, offsetX, offsetY, w, h);

  // 5. Enemies
  drawEnemies(ctx, state, offsetX, offsetY, w, h);

  // 6. Player
  drawPlayer(ctx, state, offsetX, offsetY, now);

  // 7. Death flash
  if (state.isDead && state.deathFlashTime > 0) {
    drawDeathFlash(ctx, state, w, h, halfW, halfH, now);
  }

  // 8. Scanlines
  drawScanlines(ctx, w, h);

  // 9. Vignette
  drawVignette(ctx, w, h, halfW, halfH);
}

// ── Individual draw functions ──────────────────────────────────────────

function drawHexGrid(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  offsetX: number,
  offsetY: number,
  viewLeft: number,
  viewRight: number,
  viewTop: number,
  viewBottom: number
): void {
  ctx.lineWidth = 0.5;
  ctx.strokeStyle = COLORS.borderEtched;
  ctx.globalAlpha = 0.35;

  const allHexes = hexesInRange({ q: 0, r: 0 }, state.gridRadius);

  for (const hex of allHexes) {
    const center = hexToPixel(hex, state.hexSize);

    // Viewport culling
    if (center.x < viewLeft || center.x > viewRight || center.y < viewTop || center.y > viewBottom)
      continue;

    const screenX = center.x + offsetX;
    const screenY = center.y + offsetY;

    // Fog fade at edges
    const dist = hexDistance({ q: 0, r: 0 }, hex);
    const fogAlpha = dist > state.gridRadius - 5
      ? Math.max(0, 1 - (dist - (state.gridRadius - 5)) / 5)
      : 1;

    const key = hexKey(hex);
    const isFeature = state.featureMap.has(key);

    // Hex outline
    const corners = hexCorners({ x: screenX, y: screenY }, state.hexSize);
    ctx.beginPath();
    ctx.moveTo(corners[0].x, corners[0].y);
    for (let i = 1; i < 6; i++) {
      ctx.lineTo(corners[i].x, corners[i].y);
    }
    ctx.closePath();

    if (isFeature) {
      const feature = state.featureMap.get(key)!;
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

    // Fill character (empty hexes)
    if (!isFeature) {
      const fillChar = state.hexFills.get(key) || ".";
      ctx.globalAlpha = 0.12 * fogAlpha;
      ctx.fillStyle = COLORS.dimText;
      ctx.font = '10px "Source Code Pro", monospace';
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(fillChar, screenX, screenY);
    }

    // Feature symbol
    if (isFeature) {
      const feature = state.featureMap.get(key)!;
      ctx.globalAlpha = 0.85 * fogAlpha;
      ctx.fillStyle = featureColor(feature.type);
      ctx.font = 'bold 11px "Source Code Pro", monospace';
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(feature.symbol, screenX, screenY);
    }
  }
}

function drawTrail(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  offsetX: number,
  offsetY: number
): void {
  ctx.globalAlpha = 1;
  for (let i = 0; i < state.trail.length; i++) {
    const trailPixel = hexToPixel(state.trail[i], state.hexSize);
    const sx = trailPixel.x + offsetX;
    const sy = trailPixel.y + offsetY;
    const trailAlpha = ((i + 1) / state.trail.length) * 0.35;

    ctx.beginPath();
    ctx.arc(sx, sy, state.hexSize * 0.3, 0, Math.PI * 2);
    ctx.fillStyle = COLORS.accentEmber;
    ctx.globalAlpha = trailAlpha;
    ctx.fill();
  }
}

function drawAgents(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  offsetX: number,
  offsetY: number,
  w: number,
  h: number
): void {
  ctx.globalAlpha = 1;
  for (const agent of state.agents) {
    const ax = agent.pixelPos.x + offsetX;
    const ay = agent.pixelPos.y + offsetY;

    if (ax < -50 || ax > w + 50 || ay < -50 || ay > h + 50) continue;

    ctx.save();
    ctx.fillStyle = COLORS.accentArcane;
    ctx.globalAlpha = 0.85;
    ctx.font = 'bold 16px "Source Code Pro", monospace';
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.shadowColor = COLORS.accentArcane;
    ctx.shadowBlur = 8;
    ctx.fillText(agent.glyph, ax, ay);
    ctx.restore();
  }
}

function drawEnemies(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  offsetX: number,
  offsetY: number,
  w: number,
  h: number
): void {
  ctx.globalAlpha = 1;
  for (const enemy of state.enemies) {
    const ex = enemy.pixelPos.x + offsetX;
    const ey = enemy.pixelPos.y + offsetY;

    if (ex < -50 || ex > w + 50 || ey < -50 || ey > h + 50) continue;

    ctx.save();
    ctx.fillStyle = COLORS.enemyRed;
    ctx.globalAlpha = 0.9;
    ctx.font = 'bold 18px "Source Code Pro", monospace';
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.shadowColor = COLORS.enemyRed;
    ctx.shadowBlur = 10;
    ctx.fillText("$", ex, ey);
    ctx.restore();
  }
}

function drawPlayer(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  offsetX: number,
  offsetY: number,
  now: number
): void {
  ctx.save();
  const px = state.playerPixel.x + offsetX;
  const py = state.playerPixel.y + offsetY;
  const pulse = Math.sin(now * 0.003) * 0.3 + 0.7;

  ctx.fillStyle = COLORS.accentEmber;
  ctx.globalAlpha = 1;
  ctx.font = 'bold 20px "Source Code Pro", monospace';
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.shadowColor = COLORS.accentEmber;
  ctx.shadowBlur = 15 * pulse;
  ctx.fillText("@", px, py);
  ctx.restore();
}

function drawDeathFlash(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  w: number,
  h: number,
  halfW: number,
  halfH: number,
  now: number
): void {
  const elapsed = now - state.deathFlashTime;
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
    ctx.font = 'bold 32px "Source Code Pro", monospace';
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.shadowColor = COLORS.enemyRed;
    ctx.shadowBlur = 20;
    ctx.fillText("CAUGHT!", halfW, halfH);
  }
  ctx.restore();
}

function drawScanlines(ctx: CanvasRenderingContext2D, w: number, h: number): void {
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
}

function drawVignette(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  halfW: number,
  halfH: number
): void {
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
